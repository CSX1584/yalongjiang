import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CaretLeft } from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { AgentConversation, useAgentChat } from './AgentChatPanel'
import { DECISION_COPY } from './ApprovalPanel'
import ComposerToolbar, { DEFECT_INFO_SAMPLE } from './ComposerToolbar'
import { INSPECTION_REPORTS } from '../pages/InspectionPage'

// 建议区胶囊：开始分析已下线，勾选报告后由气泡内的「开始巡检」卡片触发批量分析
export const SUGGESTION_PRESETS = []

// 从缺陷描述提取故障关键词，拼会话标题「新建{关键词}缺陷单」
const DEFECT_KEYWORDS = ['热斑', '脱网', '反灌', '失配', '通讯中断', '绝缘', '裂纹', '积灰']
function defectKeywordOf(text) {
  const hit = DEFECT_KEYWORDS.find((word) => String(text).includes(word))
  return hit || String(text).replace(/\s/g, '').slice(0, 6) || '设备'
}

/**
 * 对话指令解析（新建缺陷单/巡检报告分析/开始巡检）：左侧对话窗、侧栏输入框与右下角悬浮窗共用
 * 返回回复文案则替代兜底回复；threadId 可在调用时传入，指令回复落流会同步重命名会话
 */
export function useChatCommands(defaultThreadId) {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    defectFormRequest,
    requestDefectForm,
    fillDefectForm,
    checkedReports,
    startInspectionAnalysis,
    setInspectionStage,
    renameChat,
    startKolaDemo,
  } = useApp()

  return useCallback(
    (text, threadId = defaultThreadId) => {
      // 柯拉一期全链路演示触发：主控Agent开场气泡，后续步骤由空格/选项推进
      if (text.includes('柯拉一期')) {
        return {
          delay: 600,
          messages: [{
            actor: '主控Agent',
            content: '收到。我将联动感知、诊断、派单等智能体，对柯拉一期做全链路运行分析：先汇聚运行数据并下探数字孪生电站，再筛查近 30 天告警并给出诊断结论。按空格逐步推进。',
          }],
          act: () => {
            startKolaDemo(threadId)
            renameChat(threadId, '柯拉一期运行分析')
          },
        }
      }
      if (text.includes('新建缺陷单')) {
        requestDefectForm()
        // fromWorkbench 标记：指令跳转后对话窗保留在左侧，顶部导航保持 AI工作台高亮
        navigate('/production/defect', { state: { fromWorkbench: true } })
        // 回复后把故障信息示例预填进输入框，用户确认后发送即可触发填入
        return {
          reply: '已打开空白缺陷单，请描述缺陷信息，我会自动填入表单。',
          nextDraft: DEFECT_INFO_SAMPLE,
          act: () => renameChat(threadId, '新建缺陷单'),
        }
      }
      if (defectFormRequest?.stage === 'awaiting') {
        // 胶囊选中后直发场景：点击时未跳转（保持侧栏输入框可见），发送时再打开缺陷单页
        // fromWorkbench 标记：顶部导航保持 AI工作台高亮，不跳生产管理
        if (location.pathname !== '/production/defect') {
          navigate('/production/defect', { state: { fromWorkbench: true } })
        }
        // AI 模拟解析 2 秒，回复落流时同步把信息填入右侧缺陷单全部字段
        return {
          reply: 'AI 已完成解析，缺陷单全部字段已自动填入，请核对。',
          delay: 2000,
          act: () => {
            fillDefectForm(text)
            renameChat(threadId, `新建${defectKeywordOf(text)}缺陷单`)
          },
        }
      }
      if (text.includes('新建巡检任务')) {
        // 巡检任务走独立 4 步流程详情页，左侧导航保留、顶部导航保持 AI工作台高亮
        navigate('/inspection-task/INS-20260715-001')
        return {
          reply: '已打开「2026 Q3 巡检任务」，四步流程与当前进度已在右侧展示。',
          act: () => renameChat(threadId, '新建巡检任务'),
        }
      }
      // 报告分析模式：发送勾选的报告名称 → 右侧直接出分析结果，对话窗出巡检agent气泡
      const hitReport = INSPECTION_REPORTS.find((report) => text.includes(report.title))
      if (hitReport) {
        setInspectionStage('report')
        return {
          delay: 2000,
          messages: [
            {
              actor: '巡检Agent',
              think: {
                title: '已深度思考',
                lines: [
                  `读取「${hitReport.title}」：巡检周期 ${hitReport.period}，覆盖 ${hitReport.stations} 座电站`,
                  `交叉比对 ${hitReport.issues} 项异常的消缺闭环情况，闭环率 ${hitReport.closedRate}`,
                  '汇总发电效率、设备健康度与缺陷趋势，生成运营分析结论',
                ],
              },
            },
            { actor: '巡检Agent', content: `报告分析完成，「${hitReport.title}」分析结果已在右侧生成，请查阅。`, action: { label: '开始巡检', sendText: '开始巡检' } },
          ],
          act: () => renameChat(threadId, '巡检报告分析'),
        }
      }
      if (text.includes('巡检报告分析')) {
        setInspectionStage('list')
        // fromWorkbench 标记：指令跳转后顶部导航保持 AI工作台高亮
        navigate('/inspection', { state: { fromWorkbench: true } })
        return {
          reply: '已打开巡检报告列表，请勾选报告并发送报告名称，然后点击回复中的「开始巡检」卡片，我会进行批量分析。',
          act: () => renameChat(threadId, '巡检报告分析'),
        }
      }
      if (text.includes('开始巡检')) {
        if (checkedReports.length === 0) return '请先在巡检报告页面勾选需要分析的报告。'
        // 记录当前会话，分析完成后推送待办卡片，点击卡片保留本段对话
        startInspectionAnalysis(threadId)
        return {
          reply: `已勾选 ${checkedReports.length} 份报告，开始巡检分析，完成后将推送报告卡片到任务中心待办。`,
          act: () => renameChat(threadId, '巡检报告分析'),
        }
      }
      return null
    },
    [checkedReports.length, defectFormRequest, fillDefectForm, location.pathname, navigate, renameChat, requestDefectForm, setInspectionStage, startInspectionAnalysis, startKolaDemo, defaultThreadId],
  )
}

// 两票会签的分阶段签署卡文案：工作许可人批工作票 → 运维负责人批操作票
const CHAT_SIGN_META = {
  control: { name: '工作许可人', label: '批准工作票', copy: '工作票与工序单已生成并核对安措，待工作许可人批准。' },
  operations: { name: '运维负责人', label: '批准操作票', copy: '工作票已批准，操作票待运维负责人批准后生效。' },
}

/**
 * 对话流里的流程步骤卡：只存 ticketId/stepId，实时从上下文推导当前步骤状态
 * 普通审批节点渲染总览主控agent同款缺陷单卡片（查看步骤联动右侧瀑布流定位 + 确认推进）；
 * 两票会签节点渲染同款分阶段签署卡：批准工作票 → 工作许可人气泡 → 操作票审批卡 → 运维负责人气泡
 * 工单已推进或完结后卡片自动隐藏，避免历史消息里的过期按钮可点
 */
function ChatApprovalCard({ ticketId, stepId }) {
  const { tickets, role, flowSteps, advanceTicket, focusTicketStep } = useApp()
  const [busy, setBusy] = useState('')
  const ticket = tickets.find((item) => item.id === ticketId)
  const step = flowSteps.find((item) => item.id === stepId)
  if (!ticket || !step) return null
  const currentStep = flowSteps[Math.min(flowSteps.length, Math.max(1, Number(ticket.currentStep) || 1)) - 1]
  if (ticket.completed || currentStep?.id !== stepId) return null
  const approverRoles = Array.isArray(step.approverRoles)
    ? step.approverRoles
    : step.approverRole ? [step.approverRole] : []
  const canProcess = !approverRoles.length || role === 'admin' || approverRoles.includes(role)

  const run = (action) => {
    if (busy) return
    setBusy(typeof action === 'string' ? action : action?.type ?? '')
    Promise.resolve(advanceTicket(ticket.id, action)).finally(() => setBusy(''))
  }

  // 会签节点：分阶段签署卡，当前待签角色决定卡片内容；全部签完后隐藏卡片等空格推进
  if (Array.isArray(step.approverRoles)) {
    const workSigned = Boolean(ticket.permitSignoffs?.control)
    const opsPending = Boolean(ticket.operationPermitEnabled) && !ticket.permitSignoffs?.operations
    const pendingRole = !workSigned ? 'control' : opsPending ? 'operations' : ''
    if (!pendingRole) return null
    const meta = CHAT_SIGN_META[pendingRole]
    const allowed = role === 'admin' || role === pendingRole
    return (
      <div className="chat-defect-card">
        <div className="chat-defect-card__head">
          <strong>{ticket.title}</strong>
          <span className="chat-defect-card__status">当前步骤 · {step.name} 待{meta.name}会签</span>
        </div>
        <div className="chat-defect-card__rows">
          <div className="chat-defect-card__row">
            <span>处理人</span>
            <p>{meta.name}</p>
          </div>
          <div className="chat-defect-card__row">
            <span>步骤说明</span>
            <p>{meta.copy}</p>
          </div>
        </div>
        <div className="chat-defect-card__actions">
          <button type="button" onClick={() => focusTicketStep?.(step.index)}>查看步骤</button>
          <button
            className="is-primary"
            type="button"
            disabled={!allowed || Boolean(busy)}
            onClick={() => run({ type: 'approve', signRole: pendingRole })}
          >
            {busy ? '处理中' : meta.label}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-defect-card">
      <div className="chat-defect-card__head">
        <strong>{ticket.title}</strong>
        <span className="chat-defect-card__status">当前步骤 · {step.name} 待处理</span>
      </div>
      <div className="chat-defect-card__rows">
        <div className="chat-defect-card__row">
          <span>处理人</span>
          <p>{step.executor}</p>
        </div>
        <div className="chat-defect-card__row">
          <span>步骤说明</span>
          <p>{step.stageMeta?.copy ?? `AI 已完成准备工作，待${step.executor}处理。`}</p>
        </div>
      </div>
      <div className="chat-defect-card__actions">
        <button type="button" onClick={() => focusTicketStep?.(step.index)}>查看步骤</button>
        <button
          className="is-primary"
          type="button"
          disabled={!canProcess || Boolean(busy)}
          onClick={() => run('approve')}
        >
          {busy === 'approve' ? '处理中' : DECISION_COPY[step.id]?.approve ?? '去确认'}
        </button>
      </div>
    </div>
  )
}

/**
 * 版本2 覆盖在任务中心上的智能体对话窗口：会话消息由 AppContext 持有，切换不丢记录
 */
export default function ChatDock() {
  const {
    chatDockOpen,
    activeChatId,
    chatThreads,
    closeChat,
    updateChatMessages,
    chatDraftSeed,
    clearChatDraftSeed,
  } = useApp()
  const thread = chatThreads.find((item) => item.id === activeChatId)
  const threadId = thread?.id
  const setMessages = useCallback(
    (updater) => {
      if (threadId) updateChatMessages(threadId, updater)
    },
    [threadId, updateChatMessages],
  )
  const resolveReply = useChatCommands(threadId)
  // 侧栏输入框发送时透传的预填文案，对话窗挂载后消费一次
  const seedDraft = chatDraftSeed?.threadId === threadId ? chatDraftSeed.text : ''
  const chat = useAgentChat(setMessages, resolveReply, SUGGESTION_PRESETS, seedDraft)

  useEffect(() => {
    if (seedDraft) clearChatDraftSeed()
  }, [seedDraft, clearChatDraftSeed])

  if (!chatDockOpen) return null

  return (
    <aside className="chat-dock ticket-qa" aria-label="智能体对话">
      <header className="ticket-qa__header">
        {/* 返回按钮放在标题前面，点击回到任务中心 */}
        <button
          className="ticket-qa__collapse"
          type="button"
          onClick={closeChat}
          aria-label="返回任务中心"
          title="返回任务中心"
        >
          <CaretLeft size={15} />
        </button>
        <span className="chat-dock__title">
          {thread?.title || '智能体对话'}
        </span>
      </header>
      {thread ? (
        <AgentConversation
          messages={thread.messages}
          {...chat}
          renderToolbar={({ sendDisabled, onSend }) => (
            <ComposerToolbar setDraft={chat.setDraft} sendDisabled={sendDisabled} onSend={onSend} />
          )}
          renderApproval={(approval) => <ChatApprovalCard {...approval} />}
        />
      ) : (
        <div className="ticket-qa__empty">从左侧选择或新建一条对话</div>
      )}
    </aside>
  )
}
