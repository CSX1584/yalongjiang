import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  Books,
  CaretDown,
  CaretLeft as ChevronLeft,
  ChatsCircle,
  CheckCircle,
  ClockCounterClockwise,
  Command,
  Gauge,
  List as Menu,
  ArrowCounterClockwise as RotateCcw,
  FlowArrow,
  Gear as Settings,
  User as UserRound,
  X,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { cockpitKpis, flowVariants, inspectionFlow, OPS_DEMO_TICKET_ID, resolveStepRole, roles, stations } from '../data/demoData'
import ChatDock, { SUGGESTION_PRESETS, useChatCommands } from './ChatDock'
import { DefectActionCard, KpiCardGrid } from './AgentChatPanel'
import ComposerToolbar from './ComposerToolbar'
import CockpitPage from '../pages/CockpitPage'

const roleList = Array.isArray(roles) ? roles : Object.values(roles || {})

// 一级导航模块（总览在前，生产管理/智能巡检带下拉子菜单）
const MODULE_NAV_BEFORE = [
  { label: '告警管理', path: '/alarm' },
  { label: '诊断预警', path: '/diagnosis' },
]
const MODULE_NAV_AFTER = [
  { label: '能效管理', path: '/energy' },
  { label: '智能安防', path: '/security' },
]
const MODULE_NAV = [...MODULE_NAV_BEFORE, ...MODULE_NAV_AFTER]

// 生产管理下拉子菜单
const PRODUCTION_MENU = [
  { label: '生产报表', path: '/production/report' },
  { label: '设备管理', path: '/production/device' },
  { label: '运行管理', path: '/production/operation' },
  { label: '检修管理', path: '/production/maintenance' },
  { label: '缺陷管理', path: '/production/defect' },
  { label: '计划管理', path: '/production/plan' },
  { label: '物资管理', path: '/production/material' },
  { label: '项目管理', path: '/production/project' },
  { label: '移动应用', path: '/production/mobile' },
]

// 智能巡检下拉子菜单
const INSPECTION_MENU = [{ label: '巡检报告', path: '/inspection' }]

// 巡检任务走独立 4 步流程，其余任务走缺陷单流程
function flowOf(ticket, defectFlow) {
  return ticket?.flowType === 'inspection' ? inspectionFlow : defectFlow
}

// 工单是否已流转到关单节点（会话联动缺陷单只在该节点进入待办）
function atCloseStep(ticket, defectFlow) {
  return flowOf(ticket, defectFlow)[Number(ticket?.currentStep ?? 1) - 1]?.id === 'close'
}

// 巡检任务详情页路由
function ticketPath(ticket) {
  return ticket?.flowType === 'inspection' ? `/inspection-task/${ticket.id}` : `/ticket/${ticket.id}`
}

// 严重度归一化：紧急/预警/关注三档
function severityKeyOf(ticket) {
  return ['urgent', 'critical', '严重'].includes(ticket?.severity)
    ? 'urgent'
    : ['warning', '高', '中'].includes(ticket?.severity)
      ? 'warning'
      : 'info'
}

// 取任务当前节点归属的展示角色（与审批权限共用 resolveStepRole 同一数据源）
function ownerRoleOf(ticket, flowSteps) {
  const steps = flowOf(ticket, flowSteps)
  const step = steps?.[Number(ticket?.currentStep ?? 1) - 1]
  return resolveStepRole(step, ticket)
}

function TopBar({ onOpenSidebar }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const {
    role,
    setRole,
    flowVariant,
    setFlowVariant,
    resetDemo,
    showToast,
    theme,
    setTheme,
    closeChat,
    stopKolaDemo,
  } = useApp()
  const [prodMenuOpen, setProdMenuOpen] = useState(false)
  const [inspectionMenuOpen, setInspectionMenuOpen] = useState(false)
  const path = location.pathname
  // 工作台上下文：从任务中心/对话进入的详情与报告页，顶部导航保持 AI工作台高亮；
  // 仅弹窗新建巡检任务（fromCreate）允许跳到智能巡检
  const workbenchContext =
    path.startsWith('/workbench') ||
    path.startsWith('/agent') ||
    path.startsWith('/ticket/') ||
    path.startsWith('/chat') ||
    (path.startsWith('/inspection-task/') && !location.state?.fromCreate) ||
    (path === '/inspection' && location.state?.fromWorkbench) ||
    (path === '/production/defect' && location.state?.fromWorkbench)
  // 模块路径命中时总览不再高亮（含AI工作台）
  const isModulePath =
    !workbenchContext &&
    (path.startsWith('/workbench') ||
      path.startsWith('/production') ||
      path.startsWith('/inspection') ||
      MODULE_NAV.some((item) => path.startsWith(item.path)))

  const handleReset = () => {
    resetDemo?.()
    setSettingsOpen(false)
    showToast?.('演示数据已复位', 'success')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button sidebar-open" type="button" onClick={onOpenSidebar} title="展开任务中心">
          <Menu size={18} />
        </button>
        <button className="brand-lockup" type="button" onClick={() => navigate('/')}>
          <span className="brand-mark" aria-hidden="true"><img src="/logo.svg" alt="" /></span>
          <span className="brand-copy">
            <strong>FUSIONSOLAR</strong>
            <span>雅砻江运维智能体</span>
          </span>
        </button>
      </div>

      <nav className="topnav" aria-label="一级导航">
        <button
          className={isModulePath || workbenchContext ? '' : 'is-active'}
          type="button"
          onClick={() => navigate('/')}
        >
          总览
        </button>
        <div
          className="topnav-dropdown"
          onMouseEnter={() => setProdMenuOpen(true)}
          onMouseLeave={() => setProdMenuOpen(false)}
        >
          <button
            className={location.pathname.startsWith('/production') && !workbenchContext ? 'is-active' : ''}
            type="button"
            onClick={() => setProdMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={prodMenuOpen}
          >
            生产管理
            <CaretDown size={12} aria-hidden="true" />
          </button>
          {prodMenuOpen ? (
            <div className="topnav-menu" role="menu">
              {PRODUCTION_MENU.map((item) => (
                <button
                  className={location.pathname === item.path ? 'is-active' : ''}
                  key={item.path}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProdMenuOpen(false)
                    navigate(item.path)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {MODULE_NAV_BEFORE.map((item) => (
          <button
            className={location.pathname.startsWith(item.path) ? 'is-active' : ''}
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
        <div
          className="topnav-dropdown"
          onMouseEnter={() => setInspectionMenuOpen(true)}
          onMouseLeave={() => setInspectionMenuOpen(false)}
        >
          <button
            className={path.startsWith('/inspection') && !workbenchContext ? 'is-active' : ''}
            type="button"
            onClick={() => setInspectionMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={inspectionMenuOpen}
          >
            智能巡检
            <CaretDown size={12} aria-hidden="true" />
          </button>
          {inspectionMenuOpen ? (
            <div className="topnav-menu" role="menu">
              {INSPECTION_MENU.map((item) => (
                <button
                  className={location.pathname === item.path ? 'is-active' : ''}
                  key={item.path}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setInspectionMenuOpen(false)
                    navigate(item.path)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {MODULE_NAV_AFTER.map((item) => (
          <button
            className={location.pathname.startsWith(item.path) ? 'is-active' : ''}
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
        {/* AI工作台排在智能安防右侧（一级导航最末位） */}
        <button
          className={workbenchContext ? 'is-active' : ''}
          type="button"
          onClick={() => navigate('/workbench')}
        >
          AI工作台
        </button>
      </nav>

      <div className="topbar-actions">
        <button className="icon-button has-badge" type="button" title="通知" onClick={() => showToast?.('3 条运维事件待关注', 'warning')}>
          <Bell size={17} /><span className="notification-badge">3</span>
        </button>
        <button className={`icon-button ${settingsOpen ? 'is-active' : ''}`} type="button" title="系统设置" onClick={() => setSettingsOpen((open) => !open)}>
          <Settings size={18} />
        </button>
      </div>

      {settingsOpen ? (
        <div className="settings-panel" role="dialog" aria-label="系统设置">
          <div className="settings-heading">
            <div><span className="eyebrow">WORKSPACE</span><h2>演示控制</h2></div>
            <button className="icon-button" type="button" title="关闭" onClick={() => setSettingsOpen(false)}><X size={16} /></button>
          </div>
          <section className="settings-section">
            <span className="settings-label">当前角色</span>
            <div className="role-options">
              {roleList.map((item) => (
                <button
                  className={role === item.id ? 'is-selected' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setRole(item.id)
                    setSettingsOpen(false)
                    // 手动切换角色：关对话窗、停演示编排，回总览页按新角色刷新待办
                    closeChat?.()
                    stopKolaDemo?.()
                    navigate('/')
                  }}
                >
                  <span>{item.name}</span>
                  <small>{item.scope || item.description}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="settings-section">
            <span className="settings-label">缺陷单流程</span>
            <div className="segmented-control wide">
              {Object.values(flowVariants).map((variant) => (
                <button
                  className={flowVariant === variant.id ? 'is-selected' : ''}
                  key={variant.id}
                  type="button"
                  onClick={() => {
                    setFlowVariant(variant.id)
                    showToast?.(`已切换至${variant.label}`)
                  }}
                >
                  {variant.label}
                </button>
              ))}
            </div>
          </section>
          <section className="settings-section">
            <span className="settings-label">外观</span>
            <div className="segmented-control wide">
              <button
                className={theme === 'dark' ? 'is-selected' : ''}
                type="button"
                onClick={() => setTheme('dark')}
              >
                深色
              </button>
              <button
                className={theme === 'light' ? 'is-selected' : ''}
                type="button"
                onClick={() => setTheme('light')}
              >
                浅色
              </button>
            </div>
          </section>
          <button className="reset-button" type="button" onClick={handleReset}><RotateCcw size={15} />重置演示数据</button>
        </div>
      ) : null}
    </header>
  )
}

function TaskCard({ ticket, active, onClick }) {
  const { flowSteps } = useApp()
  const station = stations.find((item) => item.id === ticket.stationId)
  const currentStep = flowOf(ticket, flowSteps)[Number(ticket.currentStep) - 1]
  const severityKey = severityKeyOf(ticket)
  const statusKey = String(ticket.status).includes('完成')
    ? 'completed'
    : String(ticket.status).includes('挂起')
      ? 'suspended'
      : 'running'
  const severityLabel = severityKey === 'urgent' ? '紧急' : severityKey === 'warning' ? '预警' : '关注'

  return (
    <button className={`task-card ${active ? 'is-active' : ''}`} type="button" onClick={onClick}>
      <div className="task-card-title">
        <span className={`severity-dot severity-${severityKey}`} aria-hidden="true" />
        <strong>{ticket.title}</strong>
        <span className={`status-text status-${statusKey}`}>{ticket.statusLabel || ticket.status || '待审批'}</span>
      </div>
      <div className="task-card-meta"><span>{currentStep?.name || ticket.stepLabel || '异常复核'}</span><span>{station?.shortName || ticket.station || '雅砻江流域'}</span></div>
      <div className="task-card-owner"><UserRound size={14} /><span>{ticket.assignee || '技术负责人'}</span><time>{ticket.updatedAt || '08:24'}</time><span className="sr-only">{severityLabel}</span></div>
    </button>
  )
}

// 巡检报告分析待办卡：合成任务对象复用 TaskCard，样式与缺陷单卡片一致
const INSPECTION_ANALYSIS_TASK = {
  id: 'inspection-report-analysis',
  title: '巡检报告分析',
  flowType: 'inspection',
  currentStep: 4,
  status: '待查看',
  statusLabel: '待查看',
  severity: 'warning',
  assignee: '运维值班员',
  updatedAt: '刚刚',
  stationId: stations[0]?.id,
}

// 运维值班员视角默认进待办的工单：三张缺陷确认卡免「按 1 揭示」
const DUTY_DEFAULT_TICKET_IDS = ['DF-20260820-001', 'DF-20260820-002', 'DF-20260820-003']

// 模块页主控agent总结：按当前模块给出电站概况文案，KPI 取 cockpitKpis 关键四项
const MODULE_SUMMARY_KPI_IDS = ['generation', 'power', 'availability', 'alerts']
const MODULE_SUMMARIES = {
  overview: '雅砻江流域各电站运行平稳：今日发电 32.14 GWh（较昨日 +4.8%），实时功率 4.14 GW，设备可用率 98.76%。当前未闭环告警 12 条（3 条严重）、在办任务 7 项；两河口 #3方阵组串热斑缺陷单已生成，待确认。',
  production: '在办任务 7 项（3 项待审批），今日已闭环 18 项；两河口 #3方阵组串热斑缺陷单已生成，待值班员确认后转工单处置。',
  alarm: '当前未闭环告警 12 条，其中严重 3 条：两河口组串热斑、柯拉逆变器脱网、扎拉山组串反灌。AI 已完成聚类与初诊，热斑缺陷单已生成待确认。',
  diagnosis: '近 24h 完成 26 项诊断分析：组件热斑、防反回路衰减、接触器抖动各 1 例达到确诊阈值；热斑缺陷单已生成，待确认。',
  inspection: '本季度无人机巡检覆盖 7 座电站，发现 23 项异常、闭环率 87%；两河口热斑经红外复核确认，缺陷单已生成待确认。',
  energy: '今日发电 32.14 GWh，能效环比 +4.8%；热斑组串日发电损耗约 1.8%，及时处理每日可挽回约 0.4 MWh。',
  security: '安防态势平稳：电子围栏、门禁与烟火识别均无未处置事件；直流侧热斑存在起火风险，建议 48 小时内消缺。',
}

function moduleKeyOf(path) {
  if (path.startsWith('/alarm')) return 'alarm'
  if (path.startsWith('/diagnosis')) return 'diagnosis'
  if (path.startsWith('/inspection')) return 'inspection'
  if (path.startsWith('/energy')) return 'energy'
  if (path.startsWith('/security')) return 'security'
  if (path.startsWith('/production')) return 'production'
  return 'overview'
}

/**
 * 模块页 Smart Assistant：主控agent对电站情况的总结（文字 + KPI 卡片），
 * 不放预置待办事项；下方挂一张缺陷单确认卡（故障原因 / 处理代价 / 操作按钮）。
 * 运维负责人视角：推送「工单核定」待办卡（点卡片看新建工单页，点按钮批准；
 * 批准后空格逐步推进，到「工单结案」出关单卡，关单后出知识Agent案例卡）
 */
function ModuleAssistant({ pathname, onOpenTicket }) {
  const { tickets, role, flowSteps, advanceTicket, openTicketChat, updateChatMessages, startOpsDemo } = useApp()
  const navigate = useNavigate()
  const ticket = (tickets || []).find((item) => item.id === 'DF-20260820-001')
  // 热斑缺陷卡默认隐藏，按数字键 2 揭示
  const [cardRevealed, setCardRevealed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== '2' || event.repeat || event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const target = event.target
      const tagName = String(target?.tagName ?? '').toLowerCase()
      if (['input', 'textarea', 'select'].includes(tagName) || target?.isContentEditable) return
      setCardRevealed(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 运维负责人待办工单：停「工单结案」时按钮变关单，结案后进案例沉淀
  const opsTicket = (tickets || []).find((item) => item.id === OPS_DEMO_TICKET_ID)
  const isOps = role === 'operations'
  const closeIndex = flowSteps.findIndex((step) => step.id === 'close') + 1
  const opsStep = Number(opsTicket?.currentStep ?? 0)
  const opsPending = isOps && opsTicket && !opsTicket.completed && opsStep <= closeIndex
  const opsAtClose = opsPending && opsStep === closeIndex
  const knowledgeDone = isOps && opsTicket && (opsTicket.completed || opsStep > closeIndex)

  // 工单批准：推进「工单核定」节点并起步负责人对话演示流——新建对话窗口，
  // 清掉即时全量同步，由首进编排逐条落流（运维负责人批准气泡 + 派单Agent核定播报均在 advanceTicket 内落 history），后续空格逐步推进
  const approveWorkOrder = () => {
    const updated = advanceTicket(opsTicket.id, 'approve')
    if (!updated) return
    startOpsDemo()
    updateChatMessages(updated.linkedChatId || `ticket-${updated.id}`, [])
    openTicketChat(updated)
  }

  const kpis = MODULE_SUMMARY_KPI_IDS
    .map((id) => cockpitKpis.find((kpi) => kpi.id === id))
    .filter(Boolean)
  const summary = MODULE_SUMMARIES[moduleKeyOf(pathname)] ?? MODULE_SUMMARIES.overview

  // 知识Agent 案例沉淀卡：工单结案后推送
  const knowledgeNotice = knowledgeDone ? (
    <div className="assistant-notice assistant-notice--knowledge">
      <span className="assistant-notice__avatar" aria-hidden="true"><Books size={15} /></span>
      <div className="assistant-notice__main">
        <strong>知识Agent</strong>
        <div className="assistant-notice__bubble">
          <p>案例沉淀完成：处置要点已入库，同类告警自动推荐诊断路径；故障树分支先验与备件定额策略已更新。</p>
          <div className="knowledge-card">
            <strong>案例 CA-2026-0147</strong>
            <span>光伏组串热斑识别与更换 · 两河口 #3方阵 7号组串</span>
          </div>
        </div>
      </div>
    </div>
  ) : null

  // 运维负责人视角：主控agent不推送流域总结与KPI，只挂工单审批卡（热斑缺陷卡同款样式）
  if (isOps) {
    return (
      <>
        <div className="assistant-notice">
          <span className="assistant-notice__avatar" aria-hidden="true"><Command size={15} /></span>
          <div className="assistant-notice__main">
            <strong>主控Agent</strong>
            <div className="assistant-notice__bubble">
              {!opsTicket || opsTicket.completed ? (
                <p>{knowledgeDone ? '工单已结案，处置案例已沉淀知识库。' : '当前没有待审批工单。'}</p>
              ) : opsStep <= 2 ? (
                <>
                  <p>检测到以下工单待审批，请及时处理：</p>
                  <DefectActionCard
                    ticket={opsTicket}
                    status="消缺工单已生成 · 待批准"
                    cause="连接件接触电阻升高致局部热斑：红外温差 38℃、组串电流偏低 23%"
                    cost="2 人 × 2h · 备件组件 3 块 · 不处理日损耗约 0.4 MWh"
                    viewLabel="查看工单"
                    confirmLabel="工单批准"
                    onView={() => navigate('/production/work-order')}
                    onConfirm={approveWorkOrder}
                  />
                </>
              ) : (
                <p>
                  {opsAtClose
                    ? `「${opsTicket.title}」结案申请已推送，请在左侧对话窗审批关单。`
                    : `「${opsTicket.title}」已批准，AI 正在推进两票与现场作业，进度见左侧对话窗。`}
                </p>
              )}
            </div>
          </div>
        </div>
        {knowledgeNotice}
      </>
    )
  }

  return (
    <>
      <div className="assistant-notice">
        <span className="assistant-notice__avatar" aria-hidden="true"><Command size={15} /></span>
        <div className="assistant-notice__main">
          <strong>主控Agent</strong>
          <div className="assistant-notice__bubble">
            <p>{summary}</p>
            <KpiCardGrid items={kpis} />
          </div>
          {cardRevealed && ticket && !ticket.completed && (
            <DefectActionCard
              ticket={ticket}
              cause="连接件接触电阻升高致局部热斑：红外温差 38℃、组串电流偏低 23%"
              cost="2 人 × 2h · 备件组件 3 块 · 不处理日损耗约 0.4 MWh"
              onView={onOpenTicket}
              onConfirm={onOpenTicket}
            />
          )}
        </div>
      </div>
    </>
  )
}

/**
 * 版本2 侧栏底部对话输入框：发送后新建会话并打开对话窗口，指令胶囊点击填入输入框
 */
function SidebarComposer() {
  const { openChat, updateChatMessages, seedChatDraft, sidebarDraftSeed } = useApp()
  const location = useLocation()
  const [draft, setDraft] = useState('')
  const resolveCommand = useChatCommands()
  const replyTimerRef = useRef(null)

  // 巡检报告页勾选报告后透传的报告名称，填入输入框；带 path 的种子（柯拉触发文案）只在指定页面预填
  useEffect(() => {
    if (sidebarDraftSeed?.text && (!sidebarDraftSeed.path || sidebarDraftSeed.path === location.pathname)) {
      setDraft(sidebarDraftSeed.text)
    }
  }, [sidebarDraftSeed, location.pathname])

  // 注意：发送后指令会跳转页面导致本组件卸载，回复计时器不能随卸载清理，
  // 否则 act（填入缺陷单/重命名会话）与 AI 回复永远不会落流（消息存 AppContext，卸载后写入安全）

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    const threadId = `chat-${Date.now()}`
    const commandResult = resolveCommand(text, threadId)
    const command = typeof commandResult === 'string' ? { reply: commandResult } : (commandResult ?? null)
    openChat({ id: threadId, title: '新建对话' })
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    updateChatMessages(threadId, (list) => [...list, { id: `user-${Date.now()}`, type: 'user', time: now, content: text }])
    setDraft('')
    // 指令回复要求的输入框预填（如缺陷信息示例）透传给刚打开的对话窗口
    if (command?.nextDraft) seedChatDraft(threadId, command.nextDraft)
    replyTimerRef.current = window.setTimeout(() => {
      command?.act?.()
      // 指令可携带多条回复气泡（含思维链/指定 actor），否则单条文本回复
      const replies = command?.messages
        ? command.messages.map((message, index) => ({
            id: `agent-${Date.now()}-${index}`,
            type: 'agent',
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            ...message,
          }))
        : [{
            id: `agent-${Date.now()}`,
            type: 'agent',
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            content: command?.reply ?? '已收到，诊断agent将结合缺陷单字段与历史工单继续分析。',
          }]
      updateChatMessages(threadId, (list) => [...list, ...replies])
      replyTimerRef.current = null
    }, command?.delay ?? 420)
  }

  return (
    <div className="sidebar-composer">
      {SUGGESTION_PRESETS.length > 0 && (
        <div className="sidebar-composer__capsules">
          {SUGGESTION_PRESETS.map((item) => (
            <button key={item.question} type="button" onClick={() => setDraft(item.question)}>
              {item.question}
            </button>
          ))}
        </div>
      )}
      <div className="ticket-composer sidebar-composer__box ticket-composer--stacked">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder="向智能体提问"
          aria-label="向智能体提问"
        />
        <ComposerToolbar setDraft={setDraft} sendDisabled={!draft.trim()} onSend={submit} />
      </div>
    </div>
  )
}

function Sidebar({ collapsed, onCollapse, onExpand }) {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    role,
    tickets,
    flowSteps,
    chatThreads,
    activeChatId,
    chatDockOpen,
    openChat,
    openTicketChat,
    syncTicketChat,
    updateChatMessages,
    inspectionTaskPushed,
    inspectionThreadId,
    inspectionStage,
    setInspectionStage,
  } = useApp()
  // 面板内容：assistant = Smart Assistant（主控agent气泡 + 待办卡片），history = 历史对话列表
  const [v2View, setV2View] = useState('assistant')
  // 任务中心卡片默认隐藏，按数字键 1 揭示
  const [tasksRevealed, setTasksRevealed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== '1' || event.repeat || event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const target = event.target
      const tagName = String(target?.tagName ?? '').toLowerCase()
      if (['input', 'textarea', 'select'].includes(tagName) || target?.isContentEditable) return
      setTasksRevealed(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 点击任务卡片：跳转详情并打开对话窗口（首进逐条落流+思考动画，联动工单复用原会话），对话窗覆盖在任务中心上
  const openTicket = (ticket) => {
    navigate(ticketPath(ticket))
    openTicketChat?.(ticket)
  }

  // 点击历史会话：关联了工单的会话跳到工单详情看全部步骤，对话记录保留
  const openThread = (thread) => {
    const linked = (tickets || []).find((ticket) => ticket.linkedChatId === thread.id)
    if (linked) navigate(ticketPath(linked))
    openChat(thread)
  }

  // 点击「巡检报告分析」待办卡：保留发起分析时的会话，AI 补报告完成气泡，右侧显示报告内容
  // fromWorkbench 标记：顶部导航保持 AI工作台高亮
  const openInspectionTask = () => {
    navigate('/inspection', { state: { fromWorkbench: true } })
    setInspectionStage('report')
    const threadId = inspectionThreadId || activeChatId
    if (!threadId) return
    openChat({ id: threadId })
    updateChatMessages(threadId, (list) => [
      ...list,
      {
        id: `agent-${Date.now()}`,
        type: 'agent',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        content: '报告分析完成，已生成 AI 智能巡检运营报告 · 2026 Q3，请查阅。',
      },
    ])
  }

  const activeTicketId = location.pathname.startsWith('/ticket/')
    ? location.pathname.split('/ticket/')[1]
    : location.pathname.startsWith('/inspection-task/')
      ? location.pathname.split('/inspection-task/')[1]
      : ''
  const activeTicket = (tickets || []).find((item) => item.id === activeTicketId)
  // 查看某工单时，左侧只显示归属该节点角色的工单
  const activeRoleId = activeTicket ? ownerRoleOf(activeTicket, flowSteps).id : ''
  const effectiveRole = activeRoleId || role

  // 模块页（总览/生产/告警/诊断/巡检/能效/安防等）：assistant 面板显示主控agent电站总结，不显示预置待办
  const moduleView =
    !location.pathname.startsWith('/workbench') &&
    !location.pathname.startsWith('/agent') &&
    !location.pathname.startsWith('/ticket/') &&
    !location.pathname.startsWith('/chat') &&
    !(location.pathname.startsWith('/inspection-task/') && !location.state?.fromCreate) &&
    !(location.pathname === '/inspection' && location.state?.fromWorkbench) &&
    !(location.pathname === '/production/defect' && location.state?.fromWorkbench)

  const filteredTickets = useMemo(() => {
    return (tickets || []).filter((ticket) => {
      // 会话联动的缺陷单：流转中途不进待办，到关单节点才推送进来
      if (ticket.linkedChatId && !atCloseStep(ticket, flowSteps)) return false
      const status = String(ticket.status || '')
      if (!status.includes('待')) return false
      // 待办只显示当前节点归属当前角色的卡（admin 全见）
      return effectiveRole === 'admin' || ownerRoleOf(ticket, flowSteps).id === effectiveRole
    })
  }, [effectiveRole, flowSteps, tickets])

  // 主控agent气泡里的三张默认缺陷单卡片（运维值班员与演示管理员视角可见）
  const noticeTickets = effectiveRole === 'technical' || effectiveRole === 'admin'
    ? DUTY_DEFAULT_TICKET_IDS
        .map((id) => (tickets || []).find((ticket) => ticket.id === id))
        .filter(Boolean)
    : []

  // 历史对话：与待办互斥——非当前角色待办的任务落到历史区；任务线程由任务卡代表，纯会话列表排除之
  // 会话联动工单：流转中途由改名后的会话代表，不进历史工单列表；到关单进待办后，原会话从历史撤下
  const todoTicketIds = new Set(filteredTickets.map((ticket) => ticket.id))
  const todoThreadIds = new Set(filteredTickets.map((ticket) => ticket.linkedChatId).filter(Boolean))
  const historyTickets = (tickets || []).filter((ticket) => !todoTicketIds.has(ticket.id) && !ticket.linkedChatId)
  const chatOnlyThreads = chatThreads.filter(
    (thread) => !String(thread.id).startsWith('ticket-') && !todoThreadIds.has(thread.id),
  )

  // 版本2 导航栏：AI工作台常驻，收起态独占左列，展开态与面板并排
  const v2Rail = (
    <aside className="sidebar sidebar--mini sidebar--rail">
      <button
        className={`icon-button rail-orb ${!collapsed && v2View === 'assistant' ? 'is-active' : ''}`}
        type="button"
        onClick={() => {
          setV2View('assistant')
          onExpand()
        }}
        title="对话"
        aria-label="展开 Smart Assistant"
      >
        <ChatsCircle size={18} />
      </button>
      <button
        className={`icon-button rail-history ${!collapsed && v2View === 'history' ? 'is-active' : ''}`}
        type="button"
        onClick={() => {
          setV2View('history')
          onExpand()
        }}
        title="历史对话"
        aria-label="历史对话"
      >
        <ClockCounterClockwise size={18} />
      </button>
      {/* AI智能体聚合主图入口：从顶部导航下沉到工作台左侧导航栏 */}
      <button
        className={`icon-button rail-agent ${location.pathname.startsWith('/agent') ? 'is-active' : ''}`}
        type="button"
        onClick={() => navigate('/agent/orchestrator')}
        title="AI智能体"
        aria-label="AI智能体"
      >
        <FlowArrow size={18} />
      </button>
    </aside>
  )

  // 收起态仅显示导航栏
  if (collapsed) {
    return v2Rail
  }

  const expandedAside = (
      <aside className="sidebar sidebar--v2">
        <>
            <div className="sidebar-v2-head">
              <span className="ticket-qa__brand" role="img" aria-label="Smart Assistant" />
              <button className="icon-button sidebar-collapse" type="button" onClick={onCollapse} title="收起面板"><ChevronLeft size={17} /></button>
            </div>
            <div className={`task-list ${v2View === 'assistant' ? 'task-list--assistant' : ''}`}>
              {v2View === 'assistant' ? (
                moduleView ? (
                  <ModuleAssistant pathname={location.pathname} onOpenTicket={openTicket} />
                ) : (
                <>
                  {/* 主控agent 提示气泡：三张默认缺陷单卡片直接放进气泡 */}
                  <div className="assistant-notice">
                    <span className="assistant-notice__avatar" aria-hidden="true"><Command size={15} /></span>
                    <div className="assistant-notice__main">
                      <strong>主控Agent</strong>
                      <div className="assistant-notice__bubble">
                        <p>检测到以下缺陷单待确认，请及时处理：</p>
                        {noticeTickets.length > 0 && (
                          <div className="assistant-notice__cards">
                            {noticeTickets.map((ticket) => (
                              <TaskCard ticket={ticket} active={location.pathname === ticketPath(ticket)} key={ticket.id} onClick={() => openTicket(ticket)} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* 会话联动工单的关单卡免「按 1 揭示」门禁，直接显示 */}
                  {filteredTickets.filter((ticket) => ticket.linkedChatId).map((ticket) => (
                    <TaskCard ticket={ticket} active={location.pathname === ticketPath(ticket)} key={ticket.id} onClick={() => openTicket(ticket)} />
                  ))}
                  {tasksRevealed && inspectionTaskPushed && (
                    <TaskCard
                      ticket={INSPECTION_ANALYSIS_TASK}
                      active={location.pathname === '/inspection' && inspectionStage === 'report'}
                      onClick={openInspectionTask}
                    />
                  )}
                  {(() => {
                    // 三张默认缺陷单已在主控agent气泡里，下方列表排除避免重复
                    const gatedTickets = filteredTickets.filter((ticket) => !ticket.linkedChatId && !DUTY_DEFAULT_TICKET_IDS.includes(ticket.id))
                    const visibleTickets = tasksRevealed ? gatedTickets : []
                    if (visibleTickets.length) {
                      return visibleTickets.map((ticket) => (
                        <TaskCard ticket={ticket} active={location.pathname === ticketPath(ticket)} key={ticket.id} onClick={() => openTicket(ticket)} />
                      ))
                    }
                    return filteredTickets.length ? null : <div className="sidebar-empty"><Gauge size={22} /><span>当前没有待办任务</span></div>
                  })()}
                </>
                )
              ) : (
                <>
                  {chatOnlyThreads.map((thread) => (
                    <button
                      className={`task-card ${chatDockOpen && thread.id === activeChatId ? 'is-active' : ''}`}
                      key={thread.id}
                      type="button"
                      onClick={() => openThread(thread)}
                    >
                      <div className="task-card-title">
                        <span className="severity-dot severity-info" aria-hidden="true" />
                        <strong>{thread.title}</strong>
                      </div>
                    </button>
                  ))}
                  {historyTickets.map((ticket) => (
                    <button
                      className={`task-card ${location.pathname === ticketPath(ticket) ? 'is-active' : ''}`}
                      key={ticket.id}
                      type="button"
                      onClick={() => openTicket(ticket)}
                    >
                      <div className="task-card-title">
                        <span className={`severity-dot severity-${severityKeyOf(ticket)}`} aria-hidden="true" />
                        <strong>{ticket.title}</strong>
                      </div>
                    </button>
                  ))}
                  {!chatOnlyThreads.length && !historyTickets.length ? (
                    <div className="sidebar-empty"><Gauge size={22} /><span>暂无历史记录</span></div>
                  ) : null}
                </>
              )}
            </div>
        </>

        {v2View === 'assistant' ? <SidebarComposer /> : null}
      </aside>
  )

  return <div className="sidebar-v2-wrap">{v2Rail}{expandedAside}</div>
}

function Toast() {
  const { toast, clearToast } = useApp()

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => clearToast?.(), 1400)
    return () => window.clearTimeout(timer)
  }, [clearToast, toast])

  return toast ? <div className={`ops-toast toast-${toast.type || toast.tone || 'info'}`}><span className="toast-indicator" />{toast.message || toast}</div> : null
}

export default function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const cockpitActive = location.pathname === '/'
  const { chatDockOpen, kolaDemo, kolaNav, advanceKolaDemo, role, tickets, flowSteps, advanceOpsTicket } = useApp()
  // 与 TopBar 一致的工作台上下文判断
  const workbenchContext =
    location.pathname.startsWith('/workbench') ||
    location.pathname.startsWith('/agent') ||
    location.pathname.startsWith('/ticket/') ||
    location.pathname.startsWith('/chat') ||
    (location.pathname.startsWith('/inspection-task/') && !location.state?.fromCreate) ||
    (location.pathname === '/inspection' && location.state?.fromWorkbench) ||
    (location.pathname === '/production/defect' && location.state?.fromWorkbench)
  // 全页面保留左侧导航栏：模块页默认收起为导航栏，工作台上下文默认展开面板；
  // 运维负责人演示默认展开；柯拉演示跨页跳转期间保持展开不消失
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => !workbenchContext && role !== 'operations' && !kolaDemo)

  useEffect(() => {
    setSidebarCollapsed(!workbenchContext && role !== 'operations' && !kolaDemo)
  }, [location.pathname, workbenchContext, role, kolaDemo])

  // 柯拉一期全链路演示：步骤要求的页面跳转
  useEffect(() => {
    if (!kolaNav) return
    navigate(kolaNav.path, kolaNav.state ? { state: kolaNav.state } : undefined)
  }, [kolaNav, navigate])

  // 柯拉一期全链路演示：空格推进下一步（输入框聚焦时不拦截）
  useEffect(() => {
    if (!kolaDemo) return undefined
    const onKeyDown = (event) => {
      if (event.key !== ' ' && event.code !== 'Space') return
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      advanceKolaDemo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [kolaDemo, advanceKolaDemo])

  // 运维负责人演示：工单批准后空格逐步推进至关单，关单批准后再按空格推进「案例沉淀」（输入框聚焦时不拦截）
  useEffect(() => {
    if (role !== 'operations') return undefined
    const onKeyDown = (event) => {
      if (event.key !== ' ' && event.code !== 'Space') return
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const ticket = (tickets || []).find((item) => item.id === OPS_DEMO_TICKET_ID)
      if (!ticket || ticket.completed) return
      const stepNow = Number(ticket.currentStep)
      // 放行到末步「案例沉淀」；「工单结案」停留时仍由审批卡按钮关单，不经空格
      if (stepNow <= 2 || stepNow > flowSteps.length) return
      const closeIndex = flowSteps.findIndex((step) => step.id === 'close') + 1
      if (stepNow === closeIndex) return
      event.preventDefault()
      advanceOpsTicket(ticket.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [role, tickets, flowSteps, advanceOpsTicket])

  // 对话窗口打开时覆盖左侧列，点击返回回到面板
  const dockVisible = chatDockOpen

  // 展开态：左侧为 导航栏 + 面板 双列，需加宽左列
  const railVisible = !sidebarCollapsed

  return (
    <div className={`app-shell is-v2 ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${dockVisible ? 'chat-dock-open' : ''} ${railVisible ? 'sidebar-with-rail' : ''}`}>
      <TopBar onOpenSidebar={() => setSidebarCollapsed(false)} />
      <Sidebar collapsed={sidebarCollapsed} onCollapse={() => setSidebarCollapsed(true)} onExpand={() => setSidebarCollapsed(false)} />
      {dockVisible ? <ChatDock /> : null}
      <main className="app-main">
        {cockpitActive ? <CockpitPage active /> : <Outlet />}
      </main>
      <Toast />
    </div>
  )
}
