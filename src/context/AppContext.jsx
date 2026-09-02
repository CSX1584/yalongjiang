import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  agents,
  chatSessions,
  cockpitKpis,
  flowVariants,
  flowStepsV2,
  initialTickets,
  inspectionFlow,
  KOLA_CHOICE_REPLIES,
  KOLA_DEMO_STEPS,
  KOLA_TRIGGER,
  MERGED_TO_STANDARD_STEP,
  OPS_DEMO_TICKET_ID,
  reportActions as initialReportActions,
  reportSections,
  roles,
  STANDARD_TO_MERGED_STEP,
  stations,
} from '../data/demoData.js'

// Bump the persisted demo schema whenever the workflow contract changes.  A
// stale snapshot can contain tickets at an obsolete node and must never
// overwrite the canonical 13-step demonstration.
const STORAGE_KEY = 'yalong-ops-ui:demo:v2'
const STORAGE_VERSION = 14
const DEFAULT_ROLE = 'technical'
// 主题偏好独立持久化，不随「重置演示数据」清除
const THEME_KEY = 'yalong-ops-ui:theme'
// 界面模式偏好：lui 对话式 / gui 卡片式，独立持久化，不随「重置演示数据」清除
const UI_MODE_KEY = 'yalong-ops-ui:ui-mode'

// 对话窗指令：作为首条消息时不参与会话自动改名
const CHAT_COMMAND_CAPSULES = ['新建缺陷单', '巡检报告分析', '开始巡检']

// 对话窗气泡的 agent 署名：按工单步骤归属对应智能体（感知/诊断/缺陷环节统一为诊断agent）
const STEP_AGENT_NAME = {
  sense: '诊断agent',
  diagnose: '诊断agent',
  review: '诊断agent',
  defect: '诊断agent',
  'work-order': '派单Agent',
  'work-order-approval': '派单Agent',
  schedule: '派单Agent',
  'schedule-approval': '派单Agent',
  'permit-request': '派单Agent',
  'permit-approval': '派单Agent',
  execute: '执行Agent',
  validate: '验证Agent',
  learn: '知识Agent',
  collect: '巡检Agent',
  analyze: '巡检Agent',
}
const DEFAULT_AGENT_NAME = '诊断agent'

// agent 角色 → 对话气泡署名：按 entry.role 归因，步骤重排后署名不漂移
const ROLE_AGENT_NAME = {
  perception: '诊断agent',
  diagnosis: '诊断agent',
  dispatch: '派单Agent',
  execution: '执行Agent',
  validation: '验证Agent',
  knowledge: '知识Agent',
}

// 人员角色 id 集合：history 条目的 role 命中即视为人员发言（右侧气泡）
const STAFF_ROLE_IDS = new Set(roles.map((item) => item.id))

const AppContext = createContext(null)

const clone = (value) => JSON.parse(JSON.stringify(value))

// 智能体对话窗口初始会话：以演示会话为种子，消息格式对齐 AgentChatPanel
function seedChatThreads() {
  return chatSessions.map((session) => ({
    id: session.id,
    title: session.title,
    preview: session.preview || '',
    updatedAt: session.updatedAt,
    messages: (session.messages || []).map((message) => ({
      id: message.id,
      type: message.role === 'user' ? 'user' : 'agent',
      time: message.time,
      content: message.content,
    })),
  }))
}

// 两票会签角色与审批范围
const SIGN_ROLE_META = {
  control: { name: '工作许可人', scope: '工作票与工序单' },
  operations: { name: '运维负责人', scope: '操作票' },
}

function readPersistedState() {
  if (typeof window === 'undefined') return {}

  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    // 合并流程节点顺序调整后，旧快照的步骤索引已失效，直接丢弃
    if (value?.version === STORAGE_VERSION) return value
    return {}
  } catch {
    return {}
  }
}

function nowLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replaceAll('/', '-')
}

function statusForStep(step, lastIndex) {
  if (!step || step.index === lastIndex) return '已完成'
  if (Array.isArray(step.approverRoles) && step.approverRoles.length > 1) {
    return '待工作许可人与运维负责人会签'
  }
  if (step.approverRole) {
    return step.approverRole === 'field' ? '待现场工程师提交' : `待${step.executor}审批`
  }
  if (step.advanceMode === 'space') return 'Agent 待处理'
  return `${step.executor}处理中`
}

function stageForStep(step) {
  const stage = String(step?.stage ?? '')
  if (stage.includes('闭环')) return 'closure'
  if (stage.includes('派单')) return 'dispatch'
  return 'defect'
}

function normalizeStepIndex(value, fallback = 1, maxIndex = 13) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(maxIndex, Math.max(1, Math.trunc(numeric)))
}

function isTerminalStatus(status) {
  const value = String(status ?? '')
  return value === 'completed' || value.includes('已完成')
}

function isSuspendedStatus(status) {
  const value = String(status ?? '')
  return value === 'suspended' || value.includes('已挂起')
}

function roleCanApprove(step, roleId) {
  if (!step?.approverRole && !Array.isArray(step?.approverRoles)) return false
  if (roleId === 'admin') return true
  const approvers = Array.isArray(step.approverRoles) ? step.approverRoles : [step.approverRole]
  return approvers.includes(roleId)
}

/**
 * 两票批准节点的必需会签角色：工作许可人签工作票（必需），
 * 运维负责人签操作票（仅当操作票已生成）
 */
function requiredPermitSigners(step, ticket) {
  if (!Array.isArray(step?.approverRoles)) return null
  return step.approverRoles.filter((item) => item !== 'operations' || Boolean(ticket?.operationPermitEnabled))
}

function historyWithStep(history, fallbackStep = 1) {
  return (Array.isArray(history) ? history : []).map((entry) => ({
    ...entry,
    step: normalizeStepIndex(entry?.step ?? entry?.stepId, fallbackStep),
  }))
}

function historyEntry({
  ticket,
  step,
  type,
  actor,
  role,
  time,
  title,
  content,
  attachments = [],
  ...extra
}) {
  return {
    id: `${ticket.id}-${step}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    step,
    type,
    actor,
    role,
    time,
    title,
    content,
    attachments,
    ...extra,
  }
}

// 对话流「已深度思考」气泡：按工单提炼的 AI 诊断推理步骤（默认收起展示，步骤 1-n 纵向排列）
const DEEP_THINK_CHAT = {
  'DF-20260820-001': {
    title: '已深度思考 · 用时 2.3s',
    duration: 2300,
    lines: [
      '完成 3 项证据结构化：电流偏差 -23%、红外热斑温差 41.4℃、IV 阶梯特征 3 项',
      '检索 4 个候选病因推演：组件热斑先验 72% → 后验 91%（3/3 分支全命中）',
      '直流接头接触不良 22%、局部遮挡/积灰 8% 已排除',
    ],
  },
  'DF-20260820-002': {
    title: '已深度思考 · 用时 2.7s',
    duration: 2700,
    lines: [
      { text: '近 30 日 #7 方阵反灌告警 12 次，远高于站级均值 2 次，与 SCADA 采集数据交叉一致', nodeId: 'd-e1' },
      { text: '反灌事件 71% 集中于 #7 方阵早晚低辐照窗口，排除随机波动与遮挡干扰', nodeId: 'd-e2' },
      { text: '防反回路正向压降由基准 0.45V 升至 0.82V，超过 0.6V 衰减阈值', nodeId: 'd-e3' },
      { text: '#7 方阵回路损耗较健康组串高 1.9 倍，回路测试确认防反性能衰减', nodeId: 'd-e5' },
      { text: '反灌造成日发电损耗 1.8%（约 ¥940/日），建议纳入计划性检修处置', nodeId: 'd-e6' },
      { text: '防反二极管击穿关联全部 5 项证据，相邻组串经汇流母排反灌，后验置信度 87%', nodeId: 'd-c1' },
      { text: '组串极性接反：后验置信度 8%，万用表核相正常，排除', nodeId: 'd-c2' },
      { text: '组件 PID 衰减：后验置信度 5%，衰减曲线特征不符，排除', nodeId: 'd-c3' },
      { text: '采集模块故障：后验置信度 2%，换表复测数据一致，排除', nodeId: 'd-c4' },
    ],
  },
  'DF-20260820-003': {
    title: '已深度思考 · 用时 2.1s',
    duration: 2100,
    lines: [
      '完成 3 项证据结构化：交流侧峰值 1.18 p.u. 越限、有功 286→0 kW 跳变、接触器状态抖动',
      '候选病因推演：交流侧接触器抖动 → 后验 89%（分支命中）',
      '电网瞬时扰动、逆变器本体故障已排除',
    ],
  },
}

// 对话流各步骤思维链气泡：AI 在该环节完成的思考步骤（按工单数据插值，默认收起展示）
// lines 项为 { text, nodeId | nodeIds }：text 是该步的文字说明，命中的节点 id 在文字下方渲染联动胶囊
const STEP_CHAIN_COPY = {
  // 故障诊断（诊断+缺陷确认合并步）：AI 预填缺陷单，运维值班员确认后转工单
  diagnose: (ticket) => ({
    title: '已深度思考 · 用时 1.8s',
    duration: 1800,
    lines: [
      { text: '汇总诊断证据，生成缺陷描述', nodeId: 'd-c1' },
      { text: '预填缺陷类别、责任班组与设备 KKS 编码' },
      { text: '关联红外影像、SCADA 趋势等证据材料' },
      { text: `确认缺陷信息，生成缺陷单 ${ticket?.workflowIds?.defect ?? ''}`.trim(), nodeId: 'd-defect' },
      { text: '推送运维值班员确认' },
    ],
  }),
  'work-order-approval': (ticket) => ({
    title: '已深度思考 · 用时 2.5s',
    duration: 2500,
    lines: [
      { text: `按缺陷单生成工单 ${ticket?.workflowIds?.workOrder ?? ''}`.trim(), nodeId: 'd-order' },
      { text: '核定工单处置内容与责任班组，提交运维负责人批准' },
      { text: '评估停机影响，编排低辐照作业窗口', nodeId: 'd-sched' },
      { text: '匹配持证人员技能与作业力量', nodeId: 'd-skill' },
      { text: '按缺陷严重等级确定处置优先级', nodeId: 'd-sev' },
    ],
  }),
  'permit-request': (ticket) => ({
    title: '已深度思考 · 用时 3.1s',
    duration: 3100,
    lines: [
      { text: `生成电气工作票 ${ticket?.workflowIds?.workPermit ?? ''}`.trim(), nodeId: 'd-wp' },
      { text: `生成操作票 ${ticket?.workflowIds?.operationPermit ?? ''} 并核对安措`.trim(), nodeId: 'd-op' },
      { text: '校验负责人资质与作业窗口冲突' },
      { text: '提交现场工程师确认' },
    ],
  }),
  'permit-approval': () => ({
    title: '已深度思考 · 用时 2.2s',
    duration: 2200,
    lines: [
      { text: '核对工作票安措与现场设备状态，工作许可人签发', nodeId: 'd-wp-ok' },
      { text: '校验停电范围与挂牌上锁清单，运维负责人批准操作票', nodeId: 'd-op-ok' },
      { text: '两票一致性检查通过，提请会签' },
    ],
  }),
  execute: () => ({
    title: '已深度思考 · 用时 1.6s',
    duration: 1600,
    lines: [
      { text: '停电验电，落实安全措施', nodeId: 'd-x1' },
      { text: '更换防反二极管，推送作业指导卡与安全交底', nodeId: 'd-x2' },
      { text: '复测送电，回收现场照片与更换记录', nodeId: 'd-x3' },
    ],
  }),
  validate: () => ({
    title: '已深度思考 · 用时 2.9s',
    duration: 2900,
    lines: [
      { text: '组串电流回正，低辐照时段无反灌', nodeId: 'd-v1' },
      { text: '红外复测热斑消失，温差恢复至正常区间', nodeId: 'd-v2' },
      { text: '特征曲线复扫无异常，验证通过' },
    ],
  }),
  close: () => ({
    title: '已深度思考 · 用时 1.9s',
    duration: 1900,
    lines: [
      { text: '汇总全流程证据链与处置记录，核销工时与备件', nodeId: 'd-f1' },
      { text: '生成结案报告与停机损失核算' },
      { text: '提交运维负责人结案审批' },
    ],
  }),
  learn: (ticket) => ({
    title: '已深度思考 · 用时 2.4s',
    duration: 2400,
    lines: [
      { text: `提炼处置要点入库（案例 ${ticket?.workflowIds?.case ?? ''}），同类告警自动推荐诊断路径`.trim(), nodeId: 'd-l1' },
      { text: '更新故障树分支先验与备件定额策略', nodeId: 'd-l2' },
      { text: '推送相似工况电站巡检建议' },
    ],
  }),
}

export function AppProvider({ children }) {
  const [persisted] = useState(readPersistedState)
  const [role, setRoleState] = useState(
    roles.some((item) => item.id === persisted.role) ? persisted.role : DEFAULT_ROLE,
  )
  const [flowVariant, setFlowVariantState] = useState(
    flowVariants[persisted.flowVariant] ? persisted.flowVariant : 'v3',
  )
  const activeFlow = flowVariants[flowVariant]
  const activeSteps = activeFlow.steps
  const lastStepIndex = activeSteps.length
  const [sidebarTab, setSidebarTab] = useState(
    ['tasks', 'chat'].includes(persisted.sidebarTab) ? persisted.sidebarTab : 'tasks',
  )
  const [tickets, setTickets] = useState(() => {
    const stepCount = flowVariants[flowVariants[persisted.flowVariant] ? persisted.flowVariant : 'v3'].steps.length
    return Array.isArray(persisted.tickets)
      ? persisted.tickets.map((ticket) => ({
          ...ticket,
          currentStep: normalizeStepIndex(ticket.currentStep, 1, stepCount),
          history: historyWithStep(ticket.history, ticket.currentStep),
        }))
      : clone(initialTickets).map((ticket) => ({
          ...ticket,
          history: historyWithStep(ticket.history, ticket.currentStep),
        }))
  })
  const [reportActions, setReportActions] = useState(() =>
    Array.isArray(persisted.reportActions)
      ? persisted.reportActions
      : clone(initialReportActions),
  )
  // 重点风险分配结果 { [riskId]: ticketId }
  const [reportRiskAssignments, setReportRiskAssignments] = useState(() =>
    persisted.reportRiskAssignments && typeof persisted.reportRiskAssignments === 'object'
      ? persisted.reportRiskAssignments
      : {},
  )
  // 下季度计划批准结果 { [planId]: true }
  const [reportPlanApprovals, setReportPlanApprovals] = useState(() =>
    persisted.reportPlanApprovals && typeof persisted.reportPlanApprovals === 'object'
      ? persisted.reportPlanApprovals
      : {},
  )
  const [toast, setToast] = useState(null)
  // 界面主题：dark 深色 / light 浅色
  const [theme, setTheme] = useState(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark',
  )
  // 界面模式：lui 对话式 / gui 卡片式（仅影响工作台 Smart Assistant 面板）
  const [uiMode, setUiMode] = useState(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(UI_MODE_KEY) === 'gui' ? 'gui' : 'lui',
  )
  // 对话窗口收起状态：全局共享，跨页面保持
  const [qaCollapsed, setQaCollapsed] = useState(false)
  // 版本2：任务中心右侧对话窗口（dock）的会话状态
  const [chatThreads, setChatThreads] = useState(seedChatThreads)
  const [activeChatId, setActiveChatId] = useState('')
  const [chatDockOpen, setChatDockOpen] = useState(false)
  // 侧栏输入框发送后透传到对话窗输入框的预填文案（如「新建缺陷单」的故障信息示例）
  const [chatDraftSeed, setChatDraftSeed] = useState(null)
  // 巡检报告页勾选报告后透传给侧栏输入框的草稿（报告名称）；首次进入预制柯拉一期全链路演示的触发文案
  // 预制触发文案带 path 限定：只在总览页侧栏预填，工作台输入框保持空白
  const [sidebarDraftSeed, setSidebarDraftSeed] = useState(() => ({ text: KOLA_TRIGGER, ts: Date.now(), path: '/' }))
  // 对话指令：新建缺陷单表单请求 { stage: 'awaiting' | 'fill', text }
  const [defectFormRequest, setDefectFormRequest] = useState(null)
  // 巡检报告勾选结果与分析状态（idle | running | done）
  const [checkedReports, setCheckedReports] = useState([])
  const [inspectionAnalysis, setInspectionAnalysis] = useState('idle')
  // 柯拉一期全链路演示：{ threadId, stepIndex, ticketId, waiting: '' | 'choice' | 'typewriter' | 'submit' }
  const [kolaDemo, setKolaDemo] = useState(null)
  // 演示步骤要求的页面跳转，由 Shell 消费执行（ts 保证同路径也能重复触发）
  const [kolaNav, setKolaNav] = useState(null)
  // 巡检报告页右侧内容：list 报告勾选列表 / report 分析完成后的报告详情
  const [inspectionStage, setInspectionStage] = useState('list')
  // 分析完成后推送「巡检报告分析」待办卡片到任务中心，并记录发起分析的会话用于保留对话
  const [inspectionTaskPushed, setInspectionTaskPushed] = useState(false)
  const [inspectionThreadId, setInspectionThreadId] = useState('')
  const analysisTimerRef = useRef(null)
  // 缺陷单提交后的自动流转计时器链，resetDemo 时统一清理
  const defectAutoTimersRef = useRef([])
  // 运维负责人演示：工单批准后走对话演示流（ref 同步可读，掩码即时生效）
  const opsDemoRef = useRef(false)
  // 工单最新值镜像：首进编排的延迟收尾同步读取，避免空格推进后被旧快照回写
  const ticketsRef = useRef([])
  const toastTimer = useRef(null)

  useEffect(() => {
    ticketsRef.current = tickets
  }, [tickets])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        role,
        flowVariant,
        sidebarTab,
        tickets,
        reportActions,
        reportRiskAssignments,
        reportPlanApprovals,
      }),
    )
  }, [flowVariant, reportActions, reportPlanApprovals, reportRiskAssignments, role, sidebarTab, tickets])

  useEffect(() => {
    if (typeof window === 'undefined') return
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(UI_MODE_KEY, uiMode)
  }, [uiMode])

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      if (analysisTimerRef.current) window.clearTimeout(analysisTimerRef.current)
    },
    [],
  )

  const clearToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = null
    setToast(null)
  }, [])

  const showToast = useCallback((message, tone = 'success') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message, tone, type: tone })
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 1400)
  }, [])

  const setRole = useCallback((nextRole) => {
    const requested = typeof nextRole === 'string' ? nextRole : nextRole?.id
    const match = roles.find(
      (item) => item.id === requested || item.name === requested,
    )
    if (match) setRoleState(match.id)
  }, [])

  /**
   * 会话不存在则建档，但不打开对话窗口（任务完成后落入历史对话用）
   */
  const ensureChat = useCallback((thread) => {
    if (!thread?.id) return
    setChatThreads((current) =>
      current.some((item) => item.id === thread.id)
        ? current
        : [{ id: thread.id, title: thread.title || '新建对话', updatedAt: nowLabel(), messages: [] }, ...current],
    )
  }, [])

  /**
   * 打开对话窗口并定位会话；会话不存在则按传入信息建档
   */
  const openChat = useCallback((thread) => {
    if (!thread?.id) return
    ensureChat(thread)
    setActiveChatId(thread.id)
    setChatDockOpen(true)
  }, [ensureChat])

  const createChat = useCallback(() => {
    openChat({ id: `chat-${Date.now()}`, title: '新建对话' })
  }, [openChat])

  const closeChat = useCallback(() => setChatDockOpen(false), [])

  const seedChatDraft = useCallback((threadId, text) => {
    setChatDraftSeed(text ? { threadId, text } : null)
  }, [])

  const clearChatDraftSeed = useCallback(() => setChatDraftSeed(null), [])

  const seedSidebarDraft = useCallback((text) => {
    setSidebarDraftSeed(text ? { text, ts: Date.now() } : null)
  }, [])

  // 深度思考胶囊 → 右侧思维链节点联动（高亮 + 滚动定位）
  const [reasoningFocus, setReasoningFocus] = useState(null)
  const focusReasoningNode = useCallback((nodeId) => {
    setReasoningFocus(nodeId ? { nodeId, ts: Date.now() } : null)
  }, [])

  // 对话流步骤卡片「查看步骤」→ 右侧工单瀑布流对应步骤卡片滚动定位
  const [ticketStepFocus, setTicketStepFocus] = useState(null)
  const focusTicketStep = useCallback((stepIndex) => {
    setTicketStepFocus(stepIndex ? { stepIndex, ts: Date.now() } : null)
  }, [])

  /**
   * 更新指定会话的消息流；首条普通消息把「新建对话」改名为问题摘要，
   * 指令（新建缺陷单/巡检报告分析/开始巡检）不抢标题，由 AI 回复落流时统一改名
   */
  const updateChatMessages = useCallback((threadId, updater) => {
    setChatThreads((current) =>
      current.map((item) => {
        if (item.id !== threadId) return item
        const messages = typeof updater === 'function' ? updater(item.messages) : updater
        const firstUser = messages.find((message) => message.type === 'user')
        const isCommand = CHAT_COMMAND_CAPSULES.some((command) => firstUser?.content?.includes(command))
        return {
          ...item,
          messages,
          preview: messages[messages.length - 1]?.content?.slice(0, 30) ?? item.preview,
          updatedAt: nowLabel(),
          title: item.title === '新建对话' && firstUser && !isCommand ? firstUser.content.slice(0, 18) : item.title,
        }
      }),
    )
  }, [])

  /**
   * 工单任务流 → 左侧对话流增量同步：
   * history 条目转为「【标题】内容」气泡，agent 在左（按步骤署名对应智能体）、人员在右（真人角色名），
   * 思维链合并进正文同一条消息、agent 专属；
   * 当前待处理步骤追加进行式气泡，全部消息按 id 去重，用户问答记录不打乱
   */
  const syncTicketChat = useCallback(
    (ticket, { suppressActive = false } = {}) => {
      if (!ticket?.id) return
      const threadId = ticket.linkedChatId || `ticket-${ticket.id}`
      ensureChat({ id: threadId, title: ticket.title })
      updateChatMessages(threadId, (list) => {
        const next = [...list]
        const upsert = (message) => {
          const index = next.findIndex((item) => item.id === message.id)
          if (index >= 0) next[index] = message
          else next.push(message)
        }
        ;(Array.isArray(ticket.history) ? ticket.history : []).forEach((entry) => {
          // 人员判定：type 为 human 或 role 命中人员角色表（覆盖两票提交等 executorType 为 agent 但实操是人的环节）
          const isStaff = entry.type === 'human' || STAFF_ROLE_IDS.has(entry.role)
          const step = activeSteps[Number(entry.step) - 1]
          const chainFactory = step ? STEP_CHAIN_COPY[step.id] : null
          const think = !isStaff
            ? entry.role === 'diagnosis'
              ? DEEP_THINK_CHAT[ticket.id]
              : chainFactory
                ? chainFactory(ticket)
                : undefined
            : undefined
          upsert({
            id: `sync-${entry.id}`,
            type: isStaff ? 'staff' : 'agent',
            actor: isStaff ? entry.actor : (ROLE_AGENT_NAME[entry.role] ?? STEP_AGENT_NAME[step?.id] ?? entry.actor ?? DEFAULT_AGENT_NAME),
            time: entry.time,
            think,
            content: `【${entry.title}】${entry.content}`,
          })
        })
        // 进行式气泡按步骤独立成条：id 带步骤标识，同一步骤原位更新；
        // 步骤推进后旧气泡保留原位、新气泡追加到最底，出现过的气泡不消失
        const currentIndex = normalizeStepIndex(ticket.currentStep, 1, lastStepIndex)
        const currentStep = activeSteps[currentIndex - 1]
        // 运维负责人演示：关单后「案例沉淀」不出进行式气泡，知识Agent 气泡等空格触发才出现
        const maskActive = opsDemoRef.current && ticket.id === OPS_DEMO_TICKET_ID && currentStep?.advanceMode === 'auto'
        if (!suppressActive && !maskActive && currentStep && !ticket.completed && !isTerminalStatus(ticket.status)) {
          const chainFactory = STEP_CHAIN_COPY[currentStep.id]
          const think = chainFactory ? chainFactory(ticket) : undefined
          // 运维负责人演示：中间审批节点空格推进不出卡片，只在「工单结案」推关单审批卡
          const maskApproval = opsDemoRef.current && ticket.id === OPS_DEMO_TICKET_ID && currentStep.id !== 'close'
          upsert({
            id: `sync-active-${ticket.id}-${currentStep.id}`,
            type: 'agent',
            actor: STEP_AGENT_NAME[currentStep.id] ?? DEFAULT_AGENT_NAME,
            time: ticket.updatedAt,
            think,
            stepId: currentStep.id,
            content: `当前「${currentStep.name}」AI 已完成准备工作，待${currentStep.executor}处理。`,
            // 审批节点：对话流里挂审批卡，按钮直接推进流程（卡片状态由渲染方按工单实时数据推导）
            approval: currentStep.advanceMode === 'approval' && !maskApproval
              ? { ticketId: ticket.id, stepId: currentStep.id }
              : undefined,
          })
        }
        return next
      })
    },
    [activeSteps, ensureChat, lastStepIndex, updateChatMessages],
  )

  // ==================== 工作台工单对话首进编排 ====================
  // 运维负责人演示：标记演示进行中，中间审批节点不出卡片（空格推进），只在「工单结案」推关单审批卡
  const startOpsDemo = useCallback(() => {
    opsDemoRef.current = true
  }, [])

  // 思考动画播过一次的消息 id：重开对话窗不重复播放
  const animPlayedRef = useRef(new Set())
  const hasAnimPlayed = useCallback((id) => animPlayedRef.current.has(id), [])
  const markAnimPlayed = useCallback((id) => {
    if (id) animPlayedRef.current.add(id)
  }, [])

  // 首进编排定时器与已播工单记录：每张单首次进入播一次逐条落流
  const introTimersRef = useRef([])
  const ticketIntroPlayedRef = useRef(new Set())
  const [ticketIntroId, setTicketIntroId] = useState('')
  // 右侧卡片就绪的工单 id：首条「已深度思考」气泡播完 1s 后置位，TicketPage 据此延迟渲染卡片
  const [ticketCardsReadyId, setTicketCardsReadyId] = useState('')

  const clearIntroTimers = useCallback(() => {
    introTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    introTimersRef.current = []
  }, [])

  /**
   * 工作台打开工单对话：打开对话窗并同步工单消息。
   * 首次进入逐条落流（思考时长 + 间隔），右侧卡片同步生成（ticketIntroId 期间走生成动画）；
   * 非首次直接全量同步，不重播动画
   */
  const openTicketChat = useCallback(
    (ticket) => {
      if (!ticket?.id) return
      openChat({ id: ticket.linkedChatId || `ticket-${ticket.id}`, title: ticket.title })
      if (ticketIntroPlayedRef.current.has(ticket.id)) {
        syncTicketChat(ticket)
        return
      }
      ticketIntroPlayedRef.current.add(ticket.id)
      clearIntroTimers()
      setTicketIntroId(ticket.id)
      const entries = Array.isArray(ticket.history) ? ticket.history : []
      // 首条 agent 气泡的思考完成时刻 = 起始 400ms + 思考时长；卡片在其后 1s 才加载
      const firstAgentEntry = entries.find((entry) => !(entry.type === 'human' || STAFF_ROLE_IDS.has(entry.role)))
      const firstThink = firstAgentEntry
        ? firstAgentEntry.role === 'diagnosis'
          ? DEEP_THINK_CHAT[ticket.id]
          : STEP_CHAIN_COPY[activeSteps[Number(firstAgentEntry.step) - 1]?.id]?.(ticket)
        : null
      introTimersRef.current.push(window.setTimeout(() => {
        setTicketCardsReadyId(ticket.id)
      }, 400 + (firstThink?.duration ?? 800) + 1000))
      let cursor = 400
      entries.forEach((entry, index) => {
        introTimersRef.current.push(window.setTimeout(() => {
          syncTicketChat({ ...ticket, history: entries.slice(0, index + 1) }, { suppressActive: true })
        }, cursor))
        const isStaff = entry.type === 'human' || STAFF_ROLE_IDS.has(entry.role)
        const step = activeSteps[Number(entry.step) - 1]
        const think = !isStaff
          ? entry.role === 'diagnosis'
            ? DEEP_THINK_CHAT[ticket.id]
            : STEP_CHAIN_COPY[step?.id]?.(ticket)
          : null
        cursor += (isStaff ? 600 : (think?.duration ?? 800)) + 500
      })
      introTimersRef.current.push(window.setTimeout(() => {
        // 收尾同步读最新工单：播放期间用户按空格推进过，不能用开场快照回写进行式气泡
        const latest = ticketsRef.current.find((item) => item.id === ticket.id)
        syncTicketChat(latest ?? ticket)
        setTicketIntroId('')
      }, cursor))
    },
    [activeSteps, clearIntroTimers, openChat, syncTicketChat],
  )

  /**
   * 重命名会话标题（指令流程在 AI 回复落流时调用）
   */
  const renameChat = useCallback((threadId, title) => {
    if (!threadId || !title) return
    setChatThreads((current) =>
      current.map((item) => (item.id === threadId ? { ...item, title } : item)),
    )
  }, [])

  /**
   * 对话指令「新建缺陷单」：请求缺陷管理页打开空白表单等待填入
   */
  const requestDefectForm = useCallback(() => {
    setDefectFormRequest({ stage: 'awaiting', text: '' })
  }, [])

  /**
   * 空表单等待态下的缺陷信息：请求把文字直接填入表单输入框
   */
  const fillDefectForm = useCallback((text) => {
    setDefectFormRequest({ stage: 'fill', text: String(text ?? '') })
  }, [])

  const clearDefectFormRequest = useCallback(() => setDefectFormRequest(null), [])

  /**
   * 巡检报告勾选切换
   */
  const toggleReportChecked = useCallback((reportId) => {
    setCheckedReports((list) =>
      list.includes(reportId) ? list.filter((id) => id !== reportId) : [...list, reportId],
    )
  }, [])

  /**
   * 对话指令「开始巡检」（气泡卡片按钮触发）：2 秒模拟分析，完成后推送「巡检报告分析」待办卡片并记录发起会话
   */
  const startInspectionAnalysis = useCallback((threadId) => {
    if (analysisTimerRef.current) window.clearTimeout(analysisTimerRef.current)
    setInspectionThreadId(threadId || '')
    setInspectionStage('list')
    setInspectionAnalysis('running')
    analysisTimerRef.current = window.setTimeout(() => {
      setInspectionAnalysis('done')
      setInspectionTaskPushed(true)
      analysisTimerRef.current = null
    }, 2000)
  }, [])

  /**
   * 切换缺陷单流程版本，并按索引映射迁移在办任务的节点与历史记录
   * 映射规则：13 步 ↔ 9 步用换算表；同为 9 步的版本（merged/v3）步骤一一对应，恒等映射
   */
  const setFlowVariant = useCallback((nextVariant) => {
    if (!flowVariants[nextVariant]) return
    setFlowVariantState((previousVariant) => {
      if (previousVariant === nextVariant) return previousVariant

      const nextSteps = flowVariants[nextVariant].steps
      const fromCount = flowVariants[previousVariant].steps.length
      const stepMap = fromCount === nextSteps.length
        ? Object.fromEntries(nextSteps.map((step) => [step.index, step.index]))
        : nextSteps.length === flowStepsV2.length
          ? STANDARD_TO_MERGED_STEP
          : MERGED_TO_STANDARD_STEP
      const mapStep = (value) => stepMap[normalizeStepIndex(value, 1, Object.keys(stepMap).length)] ?? 1

      setTickets((current) =>
        current.map((ticket) => {
          // 巡检任务走独立 4 步流程，不参与缺陷单流程的节点映射
          if (ticket.flowType === 'inspection') return ticket
          const nextStepIndex = mapStep(ticket.currentStep)
          const nextStep = nextSteps[nextStepIndex - 1]
          const terminal = isTerminalStatus(ticket.status)
          const suspended = isSuspendedStatus(ticket.status)
          return {
            ...ticket,
            currentStep: nextStepIndex,
            stage: stageForStep(nextStep),
            assignee: terminal || suspended ? ticket.assignee : nextStep?.executor ?? ticket.assignee,
            status: terminal || suspended || String(ticket.status).includes('复检中')
              ? ticket.status
              : statusForStep(nextStep, nextSteps.length),
            history: (Array.isArray(ticket.history) ? ticket.history : []).map((entry) => ({
              ...entry,
              step: mapStep(entry?.step ?? entry?.stepId),
            })),
          }
        }),
      )
      return nextVariant
    })
  }, [])

  const advanceTicket = useCallback(
    (ticketId, action = 'space') => {
      const actionType = typeof action === 'string' ? action : action?.type || 'space'
      const actionNote = typeof action === 'object' ? action.note : ''
      const actionSignRole = typeof action === 'object' ? action.signRole : ''
      const ticket = tickets.find((item) => item.id === ticketId)
      if (!ticket) {
        showToast('未找到该任务', 'warning')
        return null
      }

      const currentStepIndex = normalizeStepIndex(ticket.currentStep, 1, lastStepIndex)
      const currentStep = activeSteps[currentStepIndex - 1]
      if (!currentStep) {
        showToast('当前流程节点无效，请重置演示数据', 'warning')
        return null
      }
      if (isTerminalStatus(ticket.status) || isSuspendedStatus(ticket.status)) {
        showToast(isTerminalStatus(ticket.status) ? '任务已完成' : '任务已挂起，请先恢复', 'warning')
        return null
      }

      const approvalAction = actionType === 'approve' || actionType === 'reject'
      if (approvalAction && (currentStep.advanceMode !== 'approval' || !roleCanApprove(currentStep, role))) {
        showToast('当前角色无权处理该审批', 'warning')
        return null
      }

      if (actionType === 'suspend') {
        if (currentStepIndex !== activeFlow.reviewStep || !['technical', 'admin'].includes(role)) {
          showToast(`仅第 ${activeFlow.reviewStep} 步可由技术负责人挂起`, 'warning')
          return null
        }
      } else if (actionType === 'space') {
        if (!activeFlow.spaceSteps.includes(currentStepIndex)) {
          showToast('当前节点暂不可推进', 'warning')
          return null
        }
        // 会签节点必须全部必需角色签署完成后才允许空格推进
        const pendingCosigners = requiredPermitSigners(currentStep, ticket)
          ?.filter((item) => !(ticket.permitSignoffs ?? {})[item])
        if (pendingCosigners?.length) {
          showToast(`请先完成${pendingCosigners.map((item) => SIGN_ROLE_META[item]?.name ?? item).join('、')}会签`, 'warning')
          return null
        }
      } else if (actionType === 'next') {
        // Keep the old action name from silently bypassing the demo's keyboard
        // gate.  TicketPage should translate a Space keypress to "space".
        showToast('当前节点由系统推进', 'warning')
        return null
      } else if (actionType === 'auto') {
        if (currentStepIndex !== lastStepIndex || currentStep.advanceMode !== 'auto') {
          showToast('当前节点不是自动完成节点', 'warning')
          return null
        }
      } else if (!['approve', 'reject', 'suspend'].includes(actionType)) {
        showToast('当前节点不支持该操作', 'warning')
        return null
      }

      const time = nowLabel()
      const actor = roles.find((item) => item.id === role)?.name || '管理员'
      const existingHistory = historyWithStep(ticket.history, currentStepIndex)
      let updatedTicket

      if (actionType === 'suspend') {
        updatedTicket = {
          ...ticket,
          currentStep: currentStepIndex,
          stage: stageForStep(currentStep),
          status: '已挂起',
          updatedAt: time,
          history: [
            ...existingHistory,
            historyEntry({
              ticket,
              step: currentStepIndex,
              type: 'human',
              actor,
              role,
              time,
              title: '任务已挂起',
              content: actionNote || '等待现场条件或资源就绪后恢复。',
            }),
          ],
        }
      } else if (actionType === 'reject') {
        const targetStepIndex = activeFlow.rejectTargets[currentStepIndex]
        if (!targetStepIndex) {
          showToast('当前节点没有可用的退回路径', 'warning')
          return null
        }
        const targetStep = activeSteps[targetStepIndex - 1]
        updatedTicket = {
          ...ticket,
          currentStep: targetStepIndex,
          stage: stageForStep(targetStep),
          assignee: targetStep.executor,
          status: '已退回重新处理',
          updatedAt: time,
          permitSignoffs: null,
          history: [
            ...existingHistory,
            historyEntry({
              ticket,
              step: currentStepIndex,
              type: 'human',
              actor,
              role,
              time,
              title: `${currentStep.name}已退回`,
              content: actionNote || '证据不充分，请补充后重新提交。',
              targetStep: targetStepIndex,
            }),
          ],
        }
      } else {
        // 两票批准节点为顺序会签：工作许可人先批工作票与工序单，
        // 操作票已生成时再由运维负责人批操作票，全部必需角色确认后才推进
        const requiredSigners = actionType === 'approve' ? requiredPermitSigners(currentStep, ticket) : null
        if (requiredSigners && requiredSigners.length) {
          const signoffs = { ...(ticket.permitSignoffs ?? {}) }
          const pendingSigners = requiredSigners.filter((item) => !signoffs[item])
          const signRole = actionSignRole || (role === 'admin' ? pendingSigners[0] : role)
          if (!requiredSigners.includes(signRole)) {
            showToast('该角色无需会签本节点', 'warning')
            return null
          }
          if (role !== 'admin' && role !== signRole) {
            showToast('当前角色无权代签该票证', 'warning')
            return null
          }
          if (signoffs[signRole]) {
            showToast(`${SIGN_ROLE_META[signRole]?.name ?? signRole}已确认，无需重复签署`, 'info')
            return null
          }
          // 顺序约束：工作票未批准前，运维负责人不能批操作票
          if (signRole === 'operations' && requiredSigners.includes('control') && !signoffs.control) {
            showToast('请先由工作许可人批准工作票与工序单', 'warning')
            return null
          }

          signoffs[signRole] = { time, actor: SIGN_ROLE_META[signRole]?.name ?? actor }
          const remaining = requiredSigners.filter((item) => !signoffs[item])
          const signerMeta = SIGN_ROLE_META[signRole] ?? { name: actor, scope: '票证' }
          const signHistory = [
            ...existingHistory,
            historyEntry({
              ticket,
              step: currentStepIndex,
              type: 'human',
              actor: signerMeta.name,
              role: signRole,
              time,
              title: `${signerMeta.name}已批准${signerMeta.scope}`,
              content: actionNote || `${signerMeta.scope}已确认无误，同意执行。`,
            }),
          ]

          if (remaining.length) {
            updatedTicket = {
              ...ticket,
              permitSignoffs: signoffs,
              status: `待${remaining.map((item) => SIGN_ROLE_META[item]?.name ?? item).join('与')}确认`,
              updatedAt: time,
              history: signHistory,
            }
            setTickets((current) =>
              current.map((item) => (item.id === ticketId ? updatedTicket : item)),
            )
            syncTicketChat(updatedTicket)
            return updatedTicket
          }

          // 会签全部完成后停在当前节点，等待空格推进
          updatedTicket = {
            ...ticket,
            permitSignoffs: signoffs,
            status: '两票已批准',
            updatedAt: time,
            history: signHistory,
          }
          setTickets((current) =>
            current.map((item) => (item.id === ticketId ? updatedTicket : item)),
          )
          syncTicketChat(updatedTicket)
          return updatedTicket
        }

        // approve/space complete the current node and move one node forward;
        // the terminal step is completed by its explicit auto action.
        const nextStepIndex = Math.min(lastStepIndex, currentStepIndex + 1)
        const nextStep = activeSteps[nextStepIndex - 1]
        const completedAtLastStep = currentStepIndex === lastStepIndex
        // 会签节点的签署消息已在会签过程中写入，空格推进时不再追加完成卡片
        const completionHistory = Array.isArray(currentStep.approverRoles)
          ? existingHistory
          : [
              ...existingHistory,
              historyEntry({
                ticket,
                step: currentStepIndex,
                type: currentStep.executorType,
                actor: currentStep.executor,
                role: currentStep.executorId,
                time,
                title: `${currentStep.name}已完成`,
                content: actionNote || (completedAtLastStep ? '已完成，工单闭环。' : `已完成，进入「${nextStep?.name}」。`),
              }),
            ]
        // 运维负责人演示：工单核定批准（任意入口）后追加派单Agent播报气泡，并标记演示进行中
        const isOpsApproval = ticket.id === OPS_DEMO_TICKET_ID && currentStep.id === 'work-order-approval' && actionType === 'approve'
        if (isOpsApproval) opsDemoRef.current = true
        const finalHistory = isOpsApproval
          ? [
              ...completionHistory,
              historyEntry({
                ticket,
                step: currentStepIndex,
                type: 'agent',
                actor: '派单Agent',
                role: 'dispatch',
                time,
                title: '工单核定已完成',
                content: `工单核定已完成，流程推进至「${nextStep?.name}」。`,
              }),
            ]
          : completionHistory
        updatedTicket = {
          ...ticket,
          currentStep: completedAtLastStep ? lastStepIndex : nextStepIndex,
          stage: stageForStep(completedAtLastStep ? currentStep : nextStep),
          assignee: nextStep?.executor || '知识Agent',
          status: completedAtLastStep
            ? '已完成'
            : nextStep?.index === lastStepIndex
              ? `${nextStep.executor}处理中`
              : statusForStep(nextStep, lastStepIndex),
          completed: completedAtLastStep,
          updatedAt: time,
          history: finalHistory,
        }
      }

      setTickets((current) =>
        current.map((item) => (item.id === ticketId ? updatedTicket : item)),
      )
      syncTicketChat(updatedTicket)
      return updatedTicket
    },
    [activeFlow, activeSteps, lastStepIndex, role, showToast, syncTicketChat, tickets],
  )

  /**
   * 局部更新任务字段，用于持久化操作票开关与票证内容编辑
   */
  const updateTicket = useCallback((ticketId, patch = {}) => {
    setTickets((current) =>
      current.map((item) => (item.id === ticketId ? { ...item, ...patch } : item)),
    )
  }, [])

  const requestDrone = useCallback(
    (ticketId) => {
      const ticket = tickets.find((item) => item.id === ticketId)
      if (!ticket) {
        showToast('未找到该任务', 'warning')
        return null
      }
      const currentStepIndex = normalizeStepIndex(ticket.currentStep, 1, lastStepIndex)
      if (currentStepIndex !== activeFlow.reviewStep || !['technical', 'admin'].includes(role)) {
        showToast(`仅第 ${activeFlow.reviewStep} 步可由技术负责人发起复检`, 'warning')
        return null
      }
      if (isTerminalStatus(ticket.status) || isSuspendedStatus(ticket.status)) {
        showToast('当前任务不可发起复检', 'warning')
        return null
      }
      if (ticket.droneRequested) {
        showToast('无人机复检已下发', 'info')
        return null
      }

      const time = nowLabel()
      const updatedTicket = {
        ...ticket,
        status: '无人机复检中',
        assignee: '异常感知',
        droneRequested: true,
        updatedAt: time,
        evidence: [
          ...(ticket.evidence || []),
          {
            id: `${ticket.id}-uav-${Date.now()}`,
            source: 'UAV-01',
            label: '精细化红外复检',
            value: '任务已下发',
            baseline: '预计 18 分钟完成',
            status: '执行中',
            time,
          },
        ],
        history: [
          ...historyWithStep(ticket.history, activeFlow.reviewStep),
          historyEntry({
            ticket,
            step: activeFlow.reviewStep,
            type: 'agent',
            actor: '异常感知',
            role: 'perception',
            time,
            title: '无人机复检已下发',
            content: 'UAV-01 将执行红外与可见光同步复检，结果将回传至当前复核环节。',
          }),
        ],
      }

      setTickets((current) =>
        current.map((item) => (item.id === ticketId ? updatedTicket : item)),
      )
      showToast('无人机复检任务已下发')
      return updatedTicket
    },
    [activeFlow, lastStepIndex, role, showToast, tickets],
  )

  const createTask = useCallback(
    (input = {}) => {
      const station =
        stations.find(
          (item) => item.id === input.stationId || item.name === input.station,
        ) || stations[0]
      const isInspection =
        input.kind === 'inspection' ||
        input.type === 'inspection' ||
        input.type === '巡检任务'
      // 外部传入的步骤号按标准流程（13步）表达，9 步流程（merged/v3）下需换算
      const requestedStep = normalizeStepIndex(input.currentStep || (isInspection ? 1 : 5), 1, 13)
      const currentStep = activeSteps.length === flowStepsV2.length
        ? STANDARD_TO_MERGED_STEP[requestedStep] ?? 1
        : requestedStep
      const step = activeSteps[currentStep - 1] || activeSteps[0]
      const suppliedHistory = Array.isArray(input.history)
        ? input.history
        : [
            {
              id: `create-${Date.now()}`,
              type: 'agent',
              actor: '总控Agent',
              role: 'orchestrator',
              time: nowLabel(),
              title: '任务已创建',
              content: input.description || '任务信息已完成 AI 预填并送入执行队列。',
              attachments: [],
            },
          ]
      const ticket = {
        id: input.id || `${isInspection ? 'INS' : 'DF'}-${Date.now().toString().slice(-10)}`,
        type: isInspection ? '巡检任务' : '缺陷单',
        title: input.title || `${station.shortName}${isInspection ? '专项巡检' : '现场确认'}`,
        station: station.name,
        stationId: station.id,
        deviceId: input.deviceId || null,
        severity: input.severity || '关注',
        status: input.status || (currentStep === lastStepIndex ? '已完成' : statusForStep(step, lastStepIndex)),
        currentStep,
        stage: stageForStep(step),
        assignee: input.assignee || step.executor,
        completed: currentStep === lastStepIndex || isTerminalStatus(input.status),
        updatedAt: nowLabel(),
        description: input.description || '任务已由总控Agent创建，等待当前执行人处理。',
        evidence: input.evidence || [],
        history: historyWithStep(suppliedHistory, currentStep),
        purpose: input.purpose || '',
        scheduledAt: input.scheduledAt || null,
      }

      // 巡检任务走独立的 4 步流程（计划/采集/分析/报告），从计划节点开始
      if (isInspection) {
        ticket.flowType = 'inspection'
        ticket.inspectionMode = ['drone', 'manual'].includes(input.inspectionMode) ? input.inspectionMode : 'drone'
        ticket.stationIds = Array.isArray(input.stationIds) && input.stationIds.length
          ? input.stationIds
          : [station.id]
        ticket.currentStep = normalizeStepIndex(input.currentStep, 1, inspectionFlow.length)
        const inspectionStep = inspectionFlow[ticket.currentStep - 1] || inspectionFlow[0]
        ticket.stage = 'inspection'
        ticket.assignee = input.assignee || inspectionStep.executor
        ticket.status = input.status || (ticket.currentStep === inspectionFlow.length ? '待运维值班员审批' : inspectionStep.approverRole ? `待${inspectionStep.executor}处理` : `${inspectionStep.executor}处理中`)
        ticket.completed = isTerminalStatus(input.status)
      }

      setTickets((current) => [ticket, ...current])
      setSidebarTab('tasks')
      showToast(`${ticket.type}已创建`)
      return ticket
    },
    [activeSteps, lastStepIndex, showToast],
  )

  /**
   * 新建缺陷单提交后自动流转：从缺陷确认开始每 2 秒自动完成一个节点，
   * 跑到「关单」节点停下，标记 closeOwnerRole 推送到运维值班员待办
   */
  const autoAdvanceDefect = useCallback(
    (ticketId) => {
      const closeIndex = activeSteps.findIndex((step) => step.id === 'close') + 1
      if (!closeIndex) return
      const advanceOne = () => {
        let reachedClose = false
        setTickets((current) =>
          current.map((ticket) => {
            if (ticket.id !== ticketId || ticket.flowType === 'inspection') return ticket
            const stepNow = normalizeStepIndex(ticket.currentStep, 1, activeSteps.length)
            if (stepNow >= closeIndex) return ticket
            const doneStep = activeSteps[stepNow - 1]
            const nextIndex = stepNow + 1
            const nextStep = activeSteps[nextIndex - 1]
            const isClose = nextIndex === closeIndex
            reachedClose = isClose
            return {
              ...ticket,
              currentStep: nextIndex,
              stage: stageForStep(nextStep),
              assignee: isClose ? '运维值班员' : nextStep.executor,
              status: isClose ? '待运维值班员关单' : statusForStep(nextStep, activeSteps.length),
              updatedAt: nowLabel(),
              closeOwnerRole: isClose ? 'technical' : ticket.closeOwnerRole,
              history: [
                ...(ticket.history ?? []),
                {
                  id: `${ticketId}-auto-${stepNow}-${Date.now()}`,
                  step: stepNow,
                  type: doneStep.executorType === 'agent' ? 'agent' : 'approval',
                  actor: doneStep.executor,
                  time: nowLabel(),
                  title: `${doneStep.name}已完成`,
                  content: isClose
                    ? '现场处置与复测验证全部完成，待运维值班员关单。'
                    : `${doneStep.name}已自动完成，流程推进至「${nextStep.name}」。`,
                  attachments: [],
                },
              ],
            }
          }),
        )
        if (!reachedClose) {
          defectAutoTimersRef.current.push(window.setTimeout(advanceOne, 2000))
        }
      }
      defectAutoTimersRef.current.push(window.setTimeout(advanceOne, 2000))
    },
    [activeSteps],
  )

  /**
   * 运维负责人演示：空格逐步推进工单（两票→作业→验证），每步完成气泡同步进对话流；
   * 两票提交落现场工程师、作业审批落工作许可人（右侧人员气泡）；
   * 跑到「工单结案」节点停下，关单批准后再按空格推进「案例沉淀」由知识Agent 收口
   */
  const advanceOpsTicket = useCallback(
    (ticketId) => {
      const closeIndex = activeSteps.findIndex((step) => step.id === 'close') + 1
      if (!closeIndex) return null
      const ticket = tickets.find((item) => item.id === ticketId)
      if (!ticket || ticket.flowType === 'inspection') return null
      const stepNow = normalizeStepIndex(ticket.currentStep, 1, activeSteps.length)
      if (stepNow < 3 || stepNow > activeSteps.length) return null
      const doneStep = activeSteps[stepNow - 1]
      // 「案例沉淀」为 auto 收口节点：复用 advanceTicket 的完成逻辑，知识Agent 气泡落流并完工单
      if (doneStep.advanceMode === 'auto') return advanceTicket(ticketId, 'auto')
      const nextIndex = stepNow + 1
      const nextStep = activeSteps[nextIndex - 1]
      const isClose = nextIndex === closeIndex
      // 演示气泡归属：两票提交=现场工程师、作业审批=工作许可人（右侧人员气泡），其余按节点执行者
      const isFieldSubmit = doneStep.id === 'permit-request'
      const isPermitApproval = doneStep.id === 'permit-approval'
      const isStaffStep = isFieldSubmit || isPermitApproval
      const updatedTicket = {
        ...ticket,
        currentStep: nextIndex,
        stage: stageForStep(nextStep),
        assignee: isClose ? '运维负责人' : nextStep.executor,
        status: isClose ? '待运维负责人关单' : statusForStep(nextStep, activeSteps.length),
        updatedAt: nowLabel(),
        closeOwnerRole: isClose ? 'operations' : ticket.closeOwnerRole,
        history: [
          ...(ticket.history ?? []),
          {
            id: `${ticketId}-ops-${stepNow}-${Date.now()}`,
            step: stepNow,
            type: isStaffStep ? 'human' : doneStep.executorType === 'agent' ? 'agent' : 'approval',
            actor: isFieldSubmit ? '现场工程师' : isPermitApproval ? SIGN_ROLE_META.control.name : doneStep.executor,
            time: nowLabel(),
            title: isPermitApproval ? '两票已批准' : `${doneStep.name}已完成`,
            content: isPermitApproval
              ? `工作许可人已批准${SIGN_ROLE_META.control.scope}，流程推进至「${nextStep.name}」。`
              : isClose
                ? '现场处置与复测验证全部完成，待运维负责人关单。'
                : `${doneStep.name}已完成，流程推进至「${nextStep.name}」。`,
            attachments: [],
          },
        ],
      }
      setTickets((current) =>
        current.map((item) => (item.id === ticketId ? updatedTicket : item)),
      )
      syncTicketChat(updatedTicket)
      return updatedTicket
    },
    [activeSteps, advanceTicket, syncTicketChat, tickets],
  )

  // 运维负责人演示：关单批准后由空格推进「案例沉淀」（见 advanceOpsTicket），不再自动完成

  // ==================== 柯拉一期多 Agent 全链路演示编排 ====================
  // 演示定时器与工单 id 引用：重置/结束时统一清理
  const kolaTimersRef = useRef([])
  const kolaTicketIdRef = useRef('')
  const kolaDemoRef = useRef(null)
  kolaDemoRef.current = kolaDemo

  const clearKolaTimers = useCallback(() => {
    kolaTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    kolaTimersRef.current = []
  }, [])

  // 手动切换角色/离开演示：清掉柯拉演示定时器并退出演示态
  const stopKolaDemo = useCallback(() => {
    clearKolaTimers()
    setKolaDemo(null)
  }, [clearKolaTimers])

  // 演示气泡统一入口：补 id/time 后追加到演示会话
  const postKolaMessages = useCallback(
    (threadId, messages) => {
      const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      updateChatMessages(threadId, (list) => [
        ...list,
        ...messages.map((message, index) => ({
          id: `kola-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          time: now,
          ...message,
        })),
      ])
    },
    [updateChatMessages],
  )

  // 单条消息动画耗时估算：思考计时 + 打勾逐项 700ms + 400ms 缓冲，消息间间隔 500ms
  const KOLA_TICK_MS = 700
  const KOLA_MSG_GAP = 500
  const kolaMessageDuration = (message) =>
    (message.think?.duration ?? 0) + (message.checklist?.length ?? 0) * KOLA_TICK_MS + 400

  /**
   * 执行一个演示步骤：queue 依次落流（前一条动画完成再发下一条），nav 在思考中间跳转，
   * effect 在动画结束 + effectDelay 后触发；动画期间 waiting='animating' 屏蔽空格，
   * 动画结束后按步骤类型落 waiting（choice 等选项 / alarm-typed 等检索打字回调）
   */
  const runKolaStep = useCallback(
    (step, demo) => {
      let cursor = 0
      step.queue.forEach((message, index) => {
        const post = () => postKolaMessages(demo.threadId, [{
          type: message.staff ? 'staff' : 'agent',
          actor: message.actor,
          content: message.content,
          think: message.think,
          checklist: message.checklist,
          defectCard: message.defectCard,
        }])
        if (cursor === 0) post()
        else kolaTimersRef.current.push(window.setTimeout(post, cursor))
        cursor += kolaMessageDuration(message) + (index < step.queue.length - 1 ? KOLA_MSG_GAP : 0)
      })
      const animEnd = cursor
      if (step.nav) {
        kolaTimersRef.current.push(window.setTimeout(() => {
          setKolaNav({ ...step.nav, ts: Date.now() })
        }, step.navDelay ?? 0))
      }
      const effect = step.effect
      if (effect) {
        kolaTimersRef.current.push(window.setTimeout(() => {
          if (effect === 'typewriter-defect') {
            setDefectFormRequest({ stage: 'typewriter' })
            setKolaDemo((current) => (current ? { ...current, waiting: 'typewriter' } : current))
            return
          }
          if (effect === 'submit-defect') {
            setDefectFormRequest({ stage: 'submit' })
            setKolaDemo((current) => (current ? { ...current, waiting: 'submit' } : current))
            return
          }
          if (effect?.type === 'advance-ticket') {
            if (!kolaTicketIdRef.current) {
              showToast('演示工单尚未生成', 'warning')
              return
            }
            const actions = Array.isArray(effect.action) ? effect.action : [effect.action]
            actions.forEach((action) => advanceTicket(kolaTicketIdRef.current, action))
          }
        }, animEnd + (step.effectDelay ?? 0)))
      }
      // 动画结束后落 waiting：选项步骤等点击、告警步骤等搜索打字完成回调
      kolaTimersRef.current.push(window.setTimeout(() => {
        setKolaDemo((current) => {
          if (!current || current.threadId !== demo.threadId || current.stepIndex !== demo.stepIndex) return current
          if (current.waiting !== 'animating') return current
          const lastWithCard = [...step.queue].reverse().find((message) => message.defectCard)
          const waiting = step.waitEvent === 'alarm-typed' ? 'alarm-typed' : lastWithCard ? 'choice' : ''
          return { ...current, waiting }
        })
      }, animEnd))
    },
    [advanceTicket, postKolaMessages, showToast],
  )

  /**
   * 演示入口：发送触发文案后由指令管道调用。
   * 演示要跨多个角色审批工单，切到管理员视角避免权限拦截；流程版本统一为 v3
   */
  const startKolaDemo = useCallback(
    (threadId) => {
      clearKolaTimers()
      kolaTicketIdRef.current = ''
      setRole('admin')
      setFlowVariant('v3')
      setKolaDemo({ threadId, stepIndex: 0, ticketId: '', waiting: '' })
    },
    [clearKolaTimers, setFlowVariant, setRole],
  )

  /**
   * 推进演示一步：空格调用（无参），选项点击传入选项 key。
   * animating（思考/打勾动画中）与 alarm-typing（检索打字中）阶段空格忽略；
   * alarm-typed（已到告警页）空格触发搜索打字；alarm-done（检索完成）空格推进下一步；
   * 选项步骤空格等同选 A；B/C/D 只回气泡不展开，停留在选项步骤
   */
  const advanceKolaDemo = useCallback(
    (choiceKey) => {
      const demo = kolaDemo
      if (!demo) return false
      if (demo.waiting === 'animating') {
        showToast('AI 正在思考，请稍候…', 'info')
        return true
      }
      // 告警页全量展示中：空格触发「柯拉一期」检索打字
      if (demo.waiting === 'alarm-typed') {
        setKolaDemo({ ...demo, waiting: 'alarm-typing' })
        return true
      }
      if (demo.waiting === 'alarm-typing') return true
      if (demo.waiting === 'typewriter') {
        showToast('AI 正在预填缺陷单，请稍候…', 'info')
        return true
      }
      if (demo.waiting === 'submit') return true
      if (demo.waiting === 'choice') {
        const key = choiceKey || 'A'
        const choiceStep = KOLA_DEMO_STEPS[demo.stepIndex - 1]
        const card = [...(choiceStep?.queue ?? [])].reverse().find((message) => message.defectCard)?.defectCard
        const choice = card?.choices?.find((item) => item.key === key)
        if (!choice) return true
        postKolaMessages(demo.threadId, [{ type: 'user', actor: '运维值班员', content: `${choice.key} · ${choice.label}` }])
        if (key !== 'A') {
          const reply = KOLA_CHOICE_REPLIES[key]
          if (reply) {
            window.setTimeout(() => {
              postKolaMessages(demo.threadId, [{ type: 'agent', actor: reply.actor, content: reply.content }])
            }, 420)
          }
          return true
        }
        // 选 A：立即执行下一步（打字机预填缺陷单）
        const nextStep = KOLA_DEMO_STEPS[demo.stepIndex]
        if (!nextStep) {
          setKolaDemo(null)
          return true
        }
        const nextDemo = { ...demo, stepIndex: demo.stepIndex + 1 }
        runKolaStep(nextStep, nextDemo)
        setKolaDemo({ ...nextDemo, waiting: 'animating' })
        return true
      }
      const step = KOLA_DEMO_STEPS[demo.stepIndex]
      if (!step) {
        setKolaDemo(null)
        return false
      }
      const nextDemo = { ...demo, stepIndex: demo.stepIndex + 1 }
      runKolaStep(step, nextDemo)
      const isLast = demo.stepIndex + 1 >= KOLA_DEMO_STEPS.length
      setKolaDemo(isLast ? null : { ...nextDemo, waiting: 'animating' })
      return true
    },
    [kolaDemo, postKolaMessages, runKolaStep, showToast],
  )

  // 告警页「柯拉一期」搜索打字完成回调：列表已刷新，落 alarm-done 等待空格推进下一步
  const kolaAlarmTyped = useCallback(() => {
    const demo = kolaDemoRef.current
    if (!demo) return
    const playing = KOLA_DEMO_STEPS[demo.stepIndex - 1]
    if (playing?.waitEvent !== 'alarm-typed') return
    if (demo.waiting !== 'alarm-typing') return
    setKolaDemo({ ...demo, waiting: 'alarm-done' })
  }, [])

  // 打字机预填完成回调：补一条提示气泡，解除等待，允许空格提交
  const kolaTypewriterDone = useCallback(() => {
    setKolaDemo((demo) => {
      if (!demo || demo.waiting !== 'typewriter') return demo
      postKolaMessages(demo.threadId, [{
        type: 'agent',
        actor: '派单Agent',
        content: '缺陷单 16 项字段已全部预填，请核对。',
      }])
      return { ...demo, waiting: '' }
    })
  }, [postKolaMessages])

  // 缺陷单提交完成回调：登记演示工单 id，后续步骤据此推进流程
  const registerKolaTicket = useCallback((ticketId) => {
    kolaTicketIdRef.current = ticketId
    setKolaDemo((demo) => (demo ? { ...demo, ticketId, waiting: demo.waiting === 'submit' ? '' : demo.waiting } : demo))
  }, [])

  const handleReportAction = useCallback(
    (actionId, payload = {}) => {
      const action = reportActions.find((item) => item.id === actionId)
      if (!action) {
        showToast('未找到该报告动作', 'warning')
        return null
      }

      if (action.ticketId) {
        setSidebarTab('tasks')
        showToast('已打开关联任务', 'info')
        const linkedTicket = tickets.find((ticket) => ticket.id === action.ticketId)
        return linkedTicket ? { ...linkedTicket, ticketId: linkedTicket.id } : null
      }

      if (action.type === 'watch' || action.type === 'dismiss') {
        const nextStatus = action.type === 'watch' ? '已加入' : '已关闭'
        setReportActions((current) =>
          current.map((item) =>
            item.id === actionId ? { ...item, status: nextStatus } : item,
          ),
        )
        showToast(action.type === 'watch' ? '已加入观察清单' : '建议已关闭')
        return null
      }

      const defaults = {
        defect: {
          title: '两河口 #3方阵 7号组串热斑处置',
          stationId: 'lianghekou',
          deviceId: 'LHK-PV-03-07',
          severity: '严重',
          currentStep: 4,
          description: '巡检中已完成感知核验与 AI 诊断，待运维值班员确认缺陷信息。',
        },
        onsite: {
          title: '两河口汇流箱 04 绝缘阻抗低现场确认',
          stationId: 'lianghekou',
          deviceId: 'LHK-CB-04',
          severity: '高',
          currentStep: 5,
          description: '巡检报告建议 72 小时内完成绝缘摇表复测。',
        },
        diagnosis: {
          title: '柯拉一期 #5方阵组串 IV 曲线诊断',
          stationId: 'kela',
          deviceId: 'KELA-PV-05-08',
          severity: '高',
          currentStep: 1,
          description: '组串电流失配率 19%，需执行 IV 曲线扫描确认根因。',
        },
        drone: {
          kind: 'inspection',
          type: '巡检任务',
          title: '扎拉山 #5/#6方阵无人机红外专项巡检',
          stationId: 'zhalashan',
          severity: '关注',
          currentStep: 1,
          purpose: '高风险方阵提频红外复测',
          description: '按下季度巡检计划生成，执行红外与可见光同步拍摄。',
        },
      }

      const ticket = createTask({ ...defaults[action.type], ...payload })
      setReportActions((current) =>
        current.map((item) =>
          item.id === actionId
            ? {
                ...item,
                status: action.type === 'drone' ? '已发起' : '已生成',
                ticketId: ticket.id,
              }
            : item,
        ),
      )
      return { ...ticket, ticketId: ticket.id }
    },
    [createTask, reportActions, showToast, tickets],
  )

  // 重点风险按问题分配处置任务，效果等同 AI 行动建议的一键生成
  const assignRiskAction = useCallback(
    (risk) => {
      if (!risk?.action) return null
      const existingId = reportRiskAssignments[risk.id]
      if (existingId) {
        setSidebarTab('tasks')
        const linked = tickets.find((item) => item.id === existingId)
        showToast('已打开关联任务', 'info')
        return linked ? { ...linked, ticketId: linked.id } : null
      }
      const ticket = createTask({ ...risk.action.task })
      setReportRiskAssignments((current) => ({ ...current, [risk.id]: ticket.id }))
      return { ...ticket, ticketId: ticket.id }
    },
    [createTask, reportRiskAssignments, showToast, tickets],
  )

  // 批准下季度巡检计划项
  const approvePlanItem = useCallback(
    (planId) => {
      setReportPlanApprovals((current) => ({ ...current, [planId]: true }))
      showToast('计划项已批准')
    },
    [showToast],
  )

  // 报告完成判定：全部重点风险已分配且全部计划项已批准
  const reportCompleted = useMemo(() => {
    const risks = reportSections.find((item) => item.id === 'priority-risks')?.items ?? []
    const plans = reportSections.find((item) => item.id === 'next-quarter')?.items ?? []
    if (!risks.length || !plans.length) return false
    return (
      risks.every((risk) => reportRiskAssignments[risk.id]) &&
      plans.every((plan) => reportPlanApprovals[plan.id])
    )
  }, [reportPlanApprovals, reportRiskAssignments])

  const resetDemo = useCallback(() => {
    setRoleState(DEFAULT_ROLE)
    setFlowVariantState('v3')
    setTickets(
      clone(initialTickets).map((ticket) => ({
        ...ticket,
        history: historyWithStep(ticket.history, ticket.currentStep),
      })),
    )
    setReportActions(clone(initialReportActions))
    setReportRiskAssignments({})
    setReportPlanApprovals({})
    setSidebarTab('tasks')
    setChatThreads(seedChatThreads())
    setActiveChatId('')
    setChatDockOpen(false)
    setDefectFormRequest(null)
    setCheckedReports([])
    if (analysisTimerRef.current) window.clearTimeout(analysisTimerRef.current)
    defectAutoTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    defectAutoTimersRef.current = []
    setInspectionAnalysis('idle')
    setInspectionStage('list')
    setInspectionTaskPushed(false)
    setInspectionThreadId('')
    setKolaDemo(null)
    setKolaNav(null)
    clearKolaTimers()
    kolaTicketIdRef.current = ''
    // 运维负责人演示标记一并复位
    opsDemoRef.current = false
    // 首进编排与思考动画播放记录一并复位，重置后可完整重播
    clearIntroTimers()
    ticketIntroPlayedRef.current.clear()
    animPlayedRef.current.clear()
    setTicketIntroId('')
    showToast('演示任务已复位')
  }, [clearIntroTimers, clearKolaTimers, showToast])

  const currentRole = useMemo(
    () => roles.find((item) => item.id === role) || roles[0],
    [role],
  )

  const value = useMemo(
    () => ({
      role,
      currentRole,
      setRole,
      theme,
      setTheme,
      uiMode,
      setUiMode,
      flowVariant,
      setFlowVariant,
      flowVariants,
      sidebarTab,
      setSidebarTab,
      tickets,
      reportActions,
      reportRiskAssignments,
      reportPlanApprovals,
      reportCompleted,
      assignRiskAction,
      approvePlanItem,
      toast,
      clearToast,
      qaCollapsed,
      setQaCollapsed,
      chatThreads,
      activeChatId,
      chatDockOpen,
      openChat,
      createChat,
      closeChat,
      chatDraftSeed,
      seedChatDraft,
      clearChatDraftSeed,
      sidebarDraftSeed,
      seedSidebarDraft,
      reasoningFocus,
      focusReasoningNode,
      ticketStepFocus,
      focusTicketStep,
      ensureChat,
      updateChatMessages,
      renameChat,
      openTicketChat,
      ticketIntroId,
      ticketCardsReadyId,
      hasAnimPlayed,
      markAnimPlayed,
      defectFormRequest,
      requestDefectForm,
      fillDefectForm,
      clearDefectFormRequest,
      checkedReports,
      toggleReportChecked,
      inspectionAnalysis,
      startInspectionAnalysis,
      inspectionStage,
      setInspectionStage,
      inspectionTaskPushed,
      inspectionThreadId,
      advanceTicket,
      updateTicket,
      requestDrone,
      syncTicketChat,
      createTask,
      autoAdvanceDefect,
      advanceOpsTicket,
      startOpsDemo,
      handleReportAction,
      kolaDemo,
      kolaNav,
      startKolaDemo,
      stopKolaDemo,
      advanceKolaDemo,
      kolaTypewriterDone,
      kolaAlarmTyped,
      registerKolaTicket,
      resetDemo,
      showToast,
      roles,
      agents,
      stations,
      flowSteps: activeSteps,
      spaceAdvanceSteps: activeFlow.spaceSteps,
      cockpitKpis,
      reportSections,
      chatSessions,
    }),
    [
      activeFlow,
      activeSteps,
      advanceOpsTicket,
      startOpsDemo,
      advanceTicket,
      approvePlanItem,
      assignRiskAction,
      autoAdvanceDefect,
      chatDockOpen,
      chatThreads,
      activeChatId,
      chatDraftSeed,
      checkedReports,
      clearChatDraftSeed,
      clearDefectFormRequest,
      clearToast,
      closeChat,
      createChat,
      createTask,
      currentRole,
      defectFormRequest,
      ensureChat,
      fillDefectForm,
      flowVariant,
      handleReportAction,
      inspectionAnalysis,
      inspectionStage,
      inspectionTaskPushed,
      inspectionThreadId,
      kolaDemo,
      kolaNav,
      startKolaDemo,
      stopKolaDemo,
      advanceKolaDemo,
      kolaTypewriterDone,
      kolaAlarmTyped,
      registerKolaTicket,
      openChat,
      openTicketChat,
      hasAnimPlayed,
      markAnimPlayed,
      ticketIntroId,
      ticketCardsReadyId,
      qaCollapsed,
      reportActions,
      reportCompleted,
      reportPlanApprovals,
      reportRiskAssignments,
      renameChat,
      reasoningFocus,
      focusReasoningNode,
      ticketStepFocus,
      focusTicketStep,
      requestDefectForm,
      requestDrone,
      resetDemo,
      role,
      seedChatDraft,
      seedSidebarDraft,
      setFlowVariant,
      setInspectionStage,
      setRole,
      showToast,
      sidebarDraftSeed,
      sidebarTab,
      startInspectionAnalysis,
      syncTicketChat,
      theme,
      tickets,
      toast,
      uiMode,
      toggleReportChecked,
      updateChatMessages,
      updateTicket,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}

// 无用导出（待确认后删除）：STORAGE_KEY 仅内部使用
// export { STORAGE_KEY }
