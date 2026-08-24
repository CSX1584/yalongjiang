import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ActivityIcon as Activity,
  ArrowLeft,
  Robot as Bot,
  CheckCircle as CheckCircle2,
  CaretRight as ChevronRight,
  WarningCircle as CircleAlert,
  FileMagnifyingGlass as FileSearch,
  ChatText as MessageSquareText,
  Paperclip,
  PaperPlaneTilt as Send,
  ShieldCheck,
  User as UserRound,
  X,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { flowSteps, SPACE_ADVANCE_STEPS } from '../data/demoData'
import ApprovalPanel from '../components/ApprovalPanel'
import TaskFlow, { DEFAULT_FLOW_STEPS } from '../components/TaskFlow'
import TicketStageContent from '../components/TicketStageContent'

const STATUS_META = {
  in_progress: { label: '进行中', className: 'is-running' },
  running: { label: '进行中', className: 'is-running' },
  pending: { label: '待处理', className: 'is-pending' },
  suspended: { label: '已挂起', className: 'is-suspended' },
  completed: { label: '已完成', className: 'is-completed' },
  已挂起: { label: '已挂起', className: 'is-suspended' },
  已完成: { label: '已完成', className: 'is-completed' },
  无人机复检中: { label: '复检中', className: 'is-running' },
  已退回重新处理: { label: '已退回', className: 'is-pending' },
}

const MESSAGE_ICONS = {
  agent: Bot,
  approval: ShieldCheck,
  evidence: FileSearch,
  human: UserRound,
  user: MessageSquareText,
  system: Activity,
}

function findTicket(tickets, activeId) {
  if (Array.isArray(tickets)) {
    return activeId
      ? tickets.find((item) => String(item.id) === String(activeId))
      : tickets[0]
  }

  if (!tickets || typeof tickets !== 'object') return null
  if (activeId && tickets[activeId]) return tickets[activeId]
  return activeId
    ? Object.values(tickets).find((item) => String(item.id) === String(activeId))
    : Object.values(tickets)[0]
}

function buildSteps(source) {
  const supplied = Array.isArray(source) ? source : []
  return DEFAULT_FLOW_STEPS.map((fallback, offset) => {
    const item = supplied.find((step) => Number(step.index ?? step.step ?? step.order) === fallback.index)
      ?? supplied[offset]
      ?? {}
    return {
      ...fallback,
      ...item,
      index: fallback.index,
      shortLabel: item.shortLabel ?? item.short ?? fallback.shortLabel,
      name: item.name ?? item.label ?? fallback.name,
      executor: item.executor ?? item.owner ?? fallback.executor,
    }
  })
}

function fallbackHistory(ticket) {
  const evidenceCount = Array.isArray(ticket?.evidence) ? ticket.evidence.length : 0
  return [
    {
      id: 'event-detected',
      step: 1,
      type: 'system',
      actor: '感知 Agent',
      time: ticket?.updatedAt ?? '08:42',
      title: '异常事件已触发',
      content: ticket?.description ?? '实时监测数据超过告警阈值，已自动创建诊断任务。',
    },
    {
      id: 'event-diagnosed',
      step: 2,
      type: 'agent',
      actor: '诊断 Agent',
      time: '08:45',
      title: '诊断结论与设备数据完成对齐',
      content: '异常位置、趋势变化和同类设备基线已完成交叉验证，证据链已归档。',
      attachmentCount: evidenceCount,
    },
    {
      id: 'event-review',
      step: 3,
      type: 'approval',
      actor: ticket?.assignee ?? '技术负责人',
      time: '08:48',
      title: '等待人工复核',
      content: '请确认诊断结论，或选择挂起、无人机复检分支补充现场证据。',
    },
  ]
}

function contentLines(message) {
  const content = message.content ?? message.text ?? message.description ?? ''
  if (Array.isArray(content)) return content.filter(Boolean).map(String)
  return content ? [String(content)] : []
}

function collectEvidence(ticket, history) {
  const items = []
  const add = (item, sourceLabel = '证据归档') => {
    if (!item) return
    if (typeof item === 'string') {
      items.push({ id: `${sourceLabel}-${items.length}`, title: item, source: sourceLabel })
      return
    }
    items.push({
      ...item,
      id: item.id ?? `${sourceLabel}-${items.length}`,
      title: item.title ?? item.name ?? item.label ?? '现场证据',
      source: item.source ?? sourceLabel,
      summary: item.summary ?? item.content ?? item.description ?? item.value ?? '',
    })
  }

  ;(Array.isArray(ticket?.evidence) ? ticket.evidence : []).forEach((item) => add(item))
  history.forEach((message) => {
    ;(Array.isArray(message.attachments) ? message.attachments : []).forEach((item) => {
      add(item, message.actor ?? '流程节点')
    })
  })

  return items.filter((item, index) => items.findIndex((other) => other.id === item.id) === index)
}

function statusForSelected(stepIndex, currentStep, completed) {
  if (completed || stepIndex < currentStep) return '已完成'
  if (stepIndex === currentStep) return '进行中'
  return '未开始'
}

function ticketStatusMeta(status) {
  if (STATUS_META[status]) return STATUS_META[status]
  const value = String(status ?? '')
  if (value.includes('已挂起')) return STATUS_META.已挂起
  if (value.includes('已完成')) return STATUS_META.已完成
  if (value.includes('已退回')) return STATUS_META.已退回重新处理
  if (value.includes('待') || value.includes('审批') || value.includes('处理中') || value.includes('复检中')) {
    return STATUS_META.in_progress
  }
  return STATUS_META.in_progress
}

function severityTone(severity) {
  const value = String(severity ?? '').toLowerCase()
  if (value.includes('严重') || value.includes('紧急') || value === 'urgent' || value === 'critical') return 'urgent'
  if (value.includes('高') || value.includes('预警') || value === 'warning') return 'warning'
  return 'info'
}

export default function TicketPage() {
  const { ticketId, id } = useParams()
  const activeId = ticketId || id
  const navigate = useNavigate()
  const { tickets, role, advanceTicket, requestDrone, showToast } = useApp()
  const ticket = useMemo(() => findTicket(tickets, activeId), [activeId, tickets])
  const steps = useMemo(() => buildSteps(flowSteps), [])
  const currentStep = Math.min(13, Math.max(1, Number(ticket?.currentStep) || 1))
  const [selectedStep, setSelectedStep] = useState(currentStep)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [localMessages, setLocalMessages] = useState([])
  const [busy, setBusy] = useState('')
  const streamRef = useRef(null)
  const qaStreamRef = useRef(null)
  const qaReplyTimerRef = useRef(null)
  const autoRequestRef = useRef('')

  const status = ticketStatusMeta(ticket?.status)
  const completed = Boolean(ticket?.completed) || ['completed', 'complete', '已完成'].includes(String(ticket?.status ?? ''))

  const runAction = useCallback(async (action) => {
    if (!ticket || busy) return
    setBusy(action)
    try {
      if (action === 'drone') {
        await requestDrone?.(ticket.id)
        setDrawerOpen(true)
      } else {
        await advanceTicket?.(ticket.id, action)
      }
    } catch (error) {
      showToast?.(error?.message ?? '操作未完成，请重试')
    } finally {
      setBusy('')
    }
  }, [advanceTicket, busy, requestDrone, showToast, ticket])

  useEffect(() => {
    setSelectedStep(currentStep)
  }, [activeId, currentStep])

  useEffect(() => {
    const stream = streamRef.current
    if (stream) stream.scrollTop = 0
  }, [activeId, currentStep, selectedStep])

  useEffect(() => {
    const stream = qaStreamRef.current
    if (stream && localMessages.length) stream.scrollTop = stream.scrollHeight
  }, [localMessages.length])

  useEffect(() => () => {
    if (qaReplyTimerRef.current) window.clearTimeout(qaReplyTimerRef.current)
  }, [])

  useEffect(() => {
    if (!ticket || completed) return undefined

    const handleKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      if (!SPACE_ADVANCE_STEPS.includes(currentStep) || drawerOpen || busy) return
      const target = event.target
      const tagName = String(target?.tagName ?? '').toLowerCase()
      if (['input', 'textarea', 'select'].includes(tagName) || target?.isContentEditable) return
      event.preventDefault()
      runAction('space')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [busy, completed, currentStep, drawerOpen, runAction, ticket])

  useEffect(() => {
    if (!ticket || completed || currentStep !== 13 || busy) return
    const requestKey = `${ticket.id}:13`
    if (autoRequestRef.current === requestKey) return
    autoRequestRef.current = requestKey
    const timer = window.setTimeout(() => runAction('auto'), 1900)
    return () => window.clearTimeout(timer)
  }, [busy, completed, currentStep, runAction, ticket])

  const history = useMemo(() => {
    if (!ticket) return []
    return Array.isArray(ticket.history) && ticket.history.length
      ? ticket.history
      : fallbackHistory(ticket)
  }, [ticket])

  const evidence = useMemo(() => collectEvidence(ticket, history), [history, ticket])
  const selectedInfo = steps[selectedStep - 1] ?? steps[0]
  const currentInfo = {
    ...steps[currentStep - 1],
    nextName: steps[currentStep]?.name ?? '流程完成',
  }
  const canProcessCurrentStep = !currentInfo.approverRole || role === currentInfo.approverRole || role === 'admin'
  const visibleHistory = history.filter((item) => Number(item.step ?? item.stepId) === selectedStep)

  if (!ticket) {
    return (
      <div className="ticket-page ticket-page--empty">
        <CircleAlert size={26} aria-hidden="true" />
        <h1>工单不存在</h1>
        <p>{activeId ? `未找到工单 ${activeId}` : '当前没有可查看的工单'}</p>
        <button type="button" onClick={() => navigate('/')}>返回驾驶舱</button>
      </div>
    )
  }

  const submitInstruction = () => {
    const text = draft.trim()
    if (!text) return
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    setLocalMessages((items) => [
      ...items,
      {
        id: `local-${Date.now()}`,
        type: 'user',
        actor: '当前用户',
        time: now,
        title: '补充指令',
        content: text,
        step: currentStep,
      },
    ])
    setDraft('')
    if (qaReplyTimerRef.current) window.clearTimeout(qaReplyTimerRef.current)
    qaReplyTimerRef.current = window.setTimeout(() => {
      setLocalMessages((items) => [
        ...items,
        {
          id: `agent-${Date.now()}`,
          type: 'agent',
          actor: 'Smart Assistant',
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          title: '智能体回复',
          content: '补充指令已记录，我会结合当前节点和已有证据继续分析。',
          step: currentStep,
        },
      ])
      qaReplyTimerRef.current = null
    }, 420)
  }

  return (
    <div className={`ticket-page${drawerOpen ? ' is-drawer-open' : ''}`}>
      <header className="ticket-page__header">
        <button
          className="ticket-page__back"
          type="button"
          onClick={() => navigate('/')}
          aria-label="返回驾驶舱"
          title="返回驾驶舱"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="ticket-page__identity">
          <div className="ticket-page__breadcrumb">
            <span>运维工单</span>
            <ChevronRight size={12} aria-hidden="true" />
            <span>{ticket.id}</span>
          </div>
          <div className="ticket-page__title-row">
            <h1>{ticket.title}</h1>
            <span className={`ticket-page__status ${status.className}`}>
              <span aria-hidden="true" />
              {status.label}
            </span>
            {ticket.severity && (
              <span className={`ticket-page__severity is-${severityTone(ticket.severity)}`}>
                <CircleAlert size={12} aria-hidden="true" />
                {ticket.severity}
              </span>
            )}
          </div>
          <div className="ticket-page__meta">
            <span>{ticket.station ?? ticket.stationName ?? '雅砻江光风储电站'}</span>
            <span>{ticket.assignee ?? '集控运维组'}</span>
            <span>更新 {ticket.updatedAt ?? '刚刚'}</span>
          </div>
        </div>
        <button
          className="ticket-page__evidence-button"
          type="button"
          onClick={() => setDrawerOpen(true)}
        >
          <FileSearch size={16} aria-hidden="true" />
          证据链
          <span>{evidence.length}</span>
        </button>
      </header>

      <TaskFlow
        steps={steps}
        currentStep={currentStep}
        selectedStep={selectedStep}
        completed={completed}
        onSelect={setSelectedStep}
      />

      <div className="ticket-page__workspace">
        <section className="ticket-thread" aria-label="任务对话与证据流">
          <div className="ticket-thread__scope">
            <div>
              <span>节点 {String(selectedInfo.index).padStart(2, '0')}</span>
              <h2>{selectedInfo.name}</h2>
            </div>
            <div className="ticket-thread__scope-meta">
              <span>{selectedInfo.executor}</span>
              <span>{statusForSelected(selectedInfo.index, currentStep, completed)}</span>
            </div>
          </div>

          <div className="ticket-thread__stream" ref={streamRef}>
            {visibleHistory.map((message) => {
              const Icon = MESSAGE_ICONS[message.type] ?? MESSAGE_ICONS.system
              const lines = contentLines(message)
              const attachmentCount = Number(message.attachmentCount)
                || (Array.isArray(message.attachments) ? message.attachments.length : 0)

              return (
                <article className={`ticket-message ticket-message--${message.type ?? 'system'}`} key={message.id}>
                  <div className="ticket-message__rail">
                    <span className="ticket-message__icon"><Icon size={15} aria-hidden="true" /></span>
                    <span className="ticket-message__line" aria-hidden="true" />
                  </div>
                  <div className="ticket-message__body">
                    <div className="ticket-message__meta">
                      <strong>{message.actor ?? message.role ?? '流程引擎'}</strong>
                      <time>{message.time ?? message.at ?? ''}</time>
                    </div>
                    <h3>{message.title ?? '流程更新'}</h3>
                    {lines.map((line, index) => <p key={`${message.id}-line-${index}`}>{line}</p>)}
                    {attachmentCount > 0 && (
                      <button
                        className="ticket-message__evidence"
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                      >
                        <Paperclip size={13} aria-hidden="true" />
                        {attachmentCount} 项证据
                        <ChevronRight size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
            <TicketStageContent
              step={selectedInfo}
              ticket={ticket}
              currentStep={currentStep}
              completed={completed}
            />
            {selectedInfo.index === currentStep && (
              <ApprovalPanel
                className="approval-panel--inline"
                ticket={ticket}
                step={currentInfo}
                busy={busy}
                disabled={completed}
                canProcess={canProcessCurrentStep}
                onApprove={() => runAction('approve')}
                onReject={() => runAction('reject')}
                onSuspend={() => runAction('suspend')}
                onDrone={() => runAction('drone')}
                onAdvance={() => runAction('space')}
              />
            )}
          </div>

        </section>

        <aside className="ticket-qa" aria-label="独立问答">
          <header className="ticket-qa__header">
            <span className="ticket-qa__brand" role="img" aria-label="Smart Assistant" />
            <span className="ticket-qa__attachment-count" aria-label="问答附件 0 项">
              <Paperclip size={14} aria-hidden="true" />
              0
            </span>
          </header>

          <div className="ticket-qa__stream" ref={qaStreamRef}>
            {localMessages.length === 0 ? (
              <div className="ticket-qa__empty">暂无问答记录</div>
            ) : localMessages.map((message) => (
              <article className={`ticket-qa__message ticket-qa__message--${message.type ?? 'system'}`} key={message.id}>
                <div>
                  <strong>{message.actor}</strong>
                  <time>{message.time}</time>
                </div>
                {contentLines(message).map((line, index) => (
                  <p key={`${message.id}-qa-${index}`}>{line}</p>
                ))}
              </article>
            ))}
          </div>

          <div className="ticket-composer ticket-qa__composer">
            <button
              className="ticket-composer__evidence"
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="打开证据链"
              title="打开证据链"
            >
              <Paperclip size={17} />
            </button>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submitInstruction()
                }
              }}
              rows={1}
              placeholder="补充处置意见或向智能体提问"
              aria-label="补充处置意见"
            />
            <button
              className="ticket-composer__send"
              type="button"
              disabled={!draft.trim()}
              onClick={submitInstruction}
              aria-label="发送"
              title="发送"
            >
              <Send size={17} />
            </button>
          </div>
        </aside>
      </div>

      {drawerOpen && (
        <div className="evidence-drawer-layer">
          <button
            className="evidence-drawer-layer__scrim"
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="关闭证据链"
          />
          <aside className="evidence-drawer" aria-label="工单证据链">
            <header className="evidence-drawer__header">
              <div>
                <span>Evidence chain</span>
                <h2>证据链</h2>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="关闭" title="关闭">
                <X size={18} />
              </button>
            </header>
            <div className="evidence-drawer__summary">
              <CheckCircle2 size={16} aria-hidden="true" />
              <div>
                <strong>{evidence.length} 项证据已关联</strong>
                <span>{ticket.id} · 数据、图像与流程记录</span>
              </div>
            </div>
            <div className="evidence-drawer__list">
              {evidence.length === 0 && <p className="evidence-drawer__empty">暂无已归档证据</p>}
              {evidence.map((item, index) => (
                <article className="evidence-item" key={item.id}>
                  <div className="evidence-item__index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="evidence-item__body">
                    <span>{item.type ?? item.source ?? '证据归档'}</span>
                    <h3>{item.title}</h3>
                    {item.summary && <p>{String(item.summary)}</p>}
                    {item.baseline && <p className="evidence-item__baseline">基线 {item.baseline}</p>}
                    {item.status && <em>{item.status}</em>}
                    {(item.time || item.at) && <time>{item.time ?? item.at}</time>}
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
