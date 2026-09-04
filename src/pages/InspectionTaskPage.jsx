import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ActivityIcon as Activity,
  ArrowLeft,
  Robot as Bot,
  Brain as BrainCircuit,
  ChatText as MessageSquareText,
  CheckCircle as CheckCircle2,
  ClipboardText,
  MapPin,
  ShieldCheck,
  User as UserRound,
  WarningCircle as CircleAlert,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import {
  AgentConversation,
  AgentConversationComposer,
  AgentConversationSuggestions,
} from '../components/AgentChatPanel'
import TaskFlow from '../components/TaskFlow'
import ReportContent from '../components/ReportContent'
import DroneRouteMap from '../components/DroneRouteMap'
import {
  MetricGrid,
  StageCard,
  StageHeader,
  KeyValueList,
  ConfidenceList,
  CheckList,
} from '../components/TicketStageContent'
import {
  buildInspectionContent,
  inspectionFlow,
  reportSections as demoReportSections,
  stations,
} from '../data/demoData'
import { Button, ToggleButton, ToggleButtonGroup } from '@heroui/react'

const MESSAGE_ICONS = {
  agent: Bot,
  approval: ShieldCheck,
  human: UserRound,
  user: MessageSquareText,
  system: Activity,
}

// 各步骤的对话建议胶囊：点击填入输入框
const QA_SUGGESTIONS = {
  plan: ['巡检路线是怎么规划的？', '本次巡检覆盖哪些电站和设备？'],
  collect: ['数据采集进度怎么样？', '红外与可见光数据都回传了吗？'],
  analyze: ['发现了哪些高风险问题？', '置信度最高的问题是什么？'],
  report: ['报告里有哪些待处置项？', '本季度巡检闭环率是多少？'],
}

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function contentLines(message) {
  const content = message?.content ?? ''
  if (Array.isArray(content)) return content.filter(Boolean).map(String)
  return content ? [String(content)] : []
}

/**
 * 空格推进监听：激活时按空格触发回调（忽略输入框与修饰键）
 */
function useSpaceAdvance(active, onAdvance) {
  useEffect(() => {
    if (!active) return undefined
    const handleKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const target = event.target
      const tagName = String(target?.tagName ?? '').toLowerCase()
      if (['input', 'textarea', 'select'].includes(tagName) || target?.isContentEditable) return
      event.preventDefault()
      onAdvance()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, onAdvance])
}

/**
 * 计划：AI 路线规划洞察条 + 指标 + 各站俯视航线图（多站 tab 切换），运维值班员确认路线
 */
function PlanStage({ step, content, routeTab, onSelectRoute, canConfirm, busy, onConfirm }) {
  const active = content.routes[routeTab] ?? content.routes[0]
  return (
    <section className="ticket-stage-content" aria-label="步骤 1 业务内容">
      <StageHeader index={1} contentIndex={1} stageMeta={step.stageMeta} />
      <div className="ticket-stage-content__body is-revealed">
        <div className="ticket-stage-review-result">
          <Bot size={17} />
          <div>
            <span>AI 路线规划</span>
            <p>巡检Agent 已根据所选电站与巡检方式生成路线方案，无人机在电站站控楼就地起降，请运维值班员确认后执行。</p>
          </div>
        </div>
        <MetricGrid items={content.planMetrics} />
        <StageCard title="巡检路线方案" eyebrow="待运维值班员确认" icon={MapPin}>
          {content.routes.length > 1 && (
            <ToggleButtonGroup
              className="route-tabs ops-heroui-toggle-group"
              aria-label="巡检路线方案"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([String(routeTab)])}
              onSelectionChange={(keys) => {
                const next = Number([...keys][0])
                if (Number.isInteger(next)) onSelectRoute(next)
              }}
              isDetached
            >
              {content.routes.map((item, index) => (
                <ToggleButton
                  className={index === routeTab ? 'is-active ops-heroui-toggle' : 'ops-heroui-toggle'}
                  id={String(index)}
                  key={item.station.id}
                >
                  {item.station.shortName}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
          {active && (
            <DroneRouteMap station={active.station} route={active.route} mode="plan" />
          )}
        </StageCard>
        {canConfirm && (
          <div className="inspection-task-actions">
            <Button className="button-primary ops-heroui-button" type="button" variant="primary" size="sm" isDisabled={busy} onPress={onConfirm}>
              <CheckCircle2 size={15} />确认路线，开始采集
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * 采集：无人机按已确认航线逐站飞行（俯视图动画），全部完成后按空格进入分析
 */
function CollectStage({ step, content, flightIndex, flightDone, onFlightDone }) {
  const routes = content.routes
  const viewIndex = flightDone ? 0 : flightIndex
  const active = routes[viewIndex] ?? routes[0]
  return (
    <section className="ticket-stage-content" aria-label="步骤 2 业务内容">
      <StageHeader index={2} contentIndex={2} stageMeta={step.stageMeta} />
      <div className="ticket-stage-content__body is-revealed">
        {active && (
          <StageCard
            title="无人机航线执行"
            eyebrow={flightDone ? '全部电站采集完成' : `正在采集 ${active.station.shortName}（${viewIndex + 1}/${routes.length}）`}
            icon={MapPin}
          >
            <DroneRouteMap
              key={active.station.id}
              station={active.station}
              route={active.route}
              mode={flightDone ? 'plan' : 'collect'}
              onDone={onFlightDone}
            />
          </StageCard>
        )}
        {flightDone && (
          <>
            <MetricGrid items={content.collectMetrics} />
            <StageCard title="数据回传清单" eyebrow="多源采集" icon={ClipboardText}>
              <CheckList items={content.collectChecklist} />
            </StageCard>
          </>
        )}
      </div>
    </section>
  )
}

/**
 * 分析：与缺陷单「故障诊断」同款布局（指标 + 置信度列表 + 结论卡），内容对齐巡检报告
 */
function AnalyzeStage({ step, content }) {
  return (
    <section className="ticket-stage-content" aria-label="步骤 3 业务内容">
      <StageHeader index={3} contentIndex={3} stageMeta={step.stageMeta} />
      <div className="ticket-stage-content__body is-revealed">
        <MetricGrid items={content.analyzeMetrics} />
        <div className="ticket-stage-grid ticket-stage-grid--two">
          <StageCard title="候选问题与置信度" eyebrow="巡检分析" icon={BrainCircuit}>
            <ConfidenceList threshold={content.analyzeThreshold} causes={content.analyzeCauses} />
            <p className="ticket-stage-note">{content.analyzeNote}</p>
          </StageCard>
          <StageCard title="分析结论" eyebrow="可解释输出" icon={ShieldCheck} className="is-emphasis">
            <div className="ticket-stage-callout">
              <strong>{content.analyzeConclusion[0]}</strong>
              <p>{content.analyzeConclusion[1]}</p>
            </div>
            <KeyValueList items={content.analyzeKv} />
          </StageCard>
        </div>
      </div>
    </section>
  )
}

/**
 * 报告：渲染 2026 Q3 智能巡检报告完整内容，交互全部保留
 */
function ReportStage({ step, sections }) {
  return (
    <section className="ticket-stage-content" aria-label="步骤 4 业务内容">
      <StageHeader index={4} contentIndex={4} stageMeta={step.stageMeta} />
      <div className="ticket-stage-content__body is-revealed">
        <ReportContent sections={sections} />
      </div>
    </section>
  )
}

export default function InspectionTaskPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const app = useApp()
  const { tickets, updateTicket } = app
  const ticket = useMemo(
    () => (tickets || []).find((item) => String(item.id) === String(ticketId)),
    [tickets, ticketId],
  )

  const steps = inspectionFlow
  const lastStepIndex = steps.length
  const currentStep = Math.min(lastStepIndex, Math.max(1, Number(ticket?.currentStep) || 1))
  const [selectedStep, setSelectedStep] = useState(currentStep)
  const [routeTab, setRouteTab] = useState(0)
  // 采集步骤：逐站飞行的航线索引与整体完成标记
  const [flightIndex, setFlightIndex] = useState(0)
  const [flightDone, setFlightDone] = useState(false)
  const [draft, setDraft] = useState('')
  const [qaMessages, setQaMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const streamRef = useRef(null)
  const qaReplyTimerRef = useRef(null)

  const stationList = useMemo(
    () => (ticket?.stationIds ?? [ticket?.stationId]).map((id) => stations.find((item) => item.id === id)).filter(Boolean),
    [ticket],
  )
  const content = useMemo(() => buildInspectionContent(ticket, stationList), [ticket, stationList])
  // 报告内容对齐本次巡检范围：只出现选中的电站
  const sections = useMemo(() => {
    const source = app.reportSections?.length ? app.reportSections : demoReportSections
    const ids = new Set(stationList.map((item) => item.id))
    const names = stationList.map((item) => item.shortName || item.name).filter(Boolean)
    const hit = (value) => names.some((name) => String(value ?? '').includes(name))
    return source.map((section) => {
      if (section.id === 'station-health') {
        return { ...section, items: section.items.filter((item) => ids.has(item.stationId)) }
      }
      if (section.id === 'problem-map') {
        return { ...section, items: section.items.filter((item) => (item.stations ?? []).some(hit)) }
      }
      if (section.id === 'priority-risks') {
        return { ...section, items: section.items.filter((item) => hit(item.station)) }
      }
      if (section.id === 'overview') {
        return {
          ...section,
          summary: `本次巡检覆盖 ${ids.size} 座电站，高风险问题已全部进入处置流程。`,
          metrics: section.metrics.map((metric) =>
            metric.label === '覆盖电站' ? { ...metric, value: String(ids.size) } : metric,
          ),
        }
      }
      return section
    })
  }, [app.reportSections, stationList])
  const completed = Boolean(ticket?.completed) || String(ticket?.status ?? '').includes('已完成')
  // 采集步骤整体完成：飞行动画结束或流程已越过采集节点
  const collectFinished = flightDone || currentStep > 2 || completed
  const selectedInfo = steps[selectedStep - 1] ?? steps[0]
  const history = Array.isArray(ticket?.history) ? ticket.history : []

  useEffect(() => {
    setSelectedStep(currentStep)
  }, [ticketId, currentStep])

  // 路由复用时清空上一个任务的本地问答和待回复，避免消息串到新任务。
  useEffect(() => {
    setDraft('')
    setQaMessages([])
    setBusy(false)
    if (qaReplyTimerRef.current) {
      window.clearTimeout(qaReplyTimerRef.current)
      qaReplyTimerRef.current = null
    }
  }, [ticketId])

  // 切换任务或回到采集节点时重置飞行进度
  useEffect(() => {
    setFlightIndex(0)
    setFlightDone(false)
  }, [ticketId, currentStep])

  // 对话气泡并入任务流：切换节点或追加问答后保持最新内容可见
  useEffect(() => {
    const stream = streamRef.current
    if (stream) stream.scrollTop = stream.scrollHeight
  }, [qaMessages.length, selectedStep, currentStep, ticketId])

  useEffect(() => () => {
    if (qaReplyTimerRef.current) window.clearTimeout(qaReplyTimerRef.current)
  }, [])

  // 单站航线飞完：还有下一站则切站续飞，全部飞完标记采集完成
  const handleFlightLegDone = useCallback(() => {
    const total = content.routes.length
    setFlightIndex((index) => {
      if (index + 1 < total) return index + 1
      setFlightDone(true)
      return index
    })
  }, [content.routes.length])

  // 采集完成后按空格推进到智能分析
  const advanceFromCollect = useCallback(() => {
    if (!ticket || busy || currentStep !== 2 || !flightDone) return
    updateTicket?.(ticket.id, {
      currentStep: 3,
      status: '巡检Agent 分析中',
      assignee: '巡检Agent',
      history: [
        ...(ticket.history ?? []),
        {
          id: `${ticket.id}-collect-${Date.now()}`,
          step: 2,
          type: 'agent',
          actor: '巡检Agent',
          role: 'perception',
          time: nowTime(),
          title: '数据采集已完成',
          content: `${stationList.length} 座电站巡检数据已全部回传归档，进入智能分析。`,
          attachments: [],
        },
      ],
    })
  }, [busy, currentStep, flightDone, stationList.length, ticket, updateTicket])

  // 分析完成后按空格推进到报告审批
  const advanceFromAnalyze = useCallback(() => {
    if (!ticket || busy || currentStep !== 3) return
    const step = steps[currentStep - 1]
    updateTicket?.(ticket.id, {
      currentStep: 4,
      status: '待运维值班员审批',
      assignee: '运维值班员',
      history: [
        ...(ticket.history ?? []),
        {
          id: `${ticket.id}-auto-${Date.now()}`,
          step: currentStep,
          type: 'agent',
          actor: '巡检Agent',
          role: step.executorId,
          time: nowTime(),
          title: '智能分析已完成',
          content: '候选问题与置信度分析完成，47 项异常全部归档，报告已自动汇总生成，待运维值班员审批。',
          attachments: [],
        },
      ],
    })
  }, [busy, currentStep, steps, ticket, updateTicket])

  // 采集飞完 / 分析就绪后，按空格推进到下一节点
  useSpaceAdvance(Boolean(ticket && !completed && currentStep === 2 && flightDone), advanceFromCollect)
  useSpaceAdvance(Boolean(ticket && !completed && currentStep === 3), advanceFromAnalyze)

  if (!ticket) {
    return (
      <div className="ticket-page ticket-page--empty">
        <CircleAlert size={26} aria-hidden="true" />
        <h1>任务不存在</h1>
        <p>{ticketId ? `未找到任务 ${ticketId}` : '当前没有可查看的任务'}</p>
        <button type="button" onClick={() => navigate('/')}>返回驾驶舱</button>
      </div>
    )
  }

  const confirmPlan = () => {
    if (busy) return
    setBusy(true)
    updateTicket?.(ticket.id, {
      currentStep: 2,
      status: '巡检Agent 采集中',
      assignee: '巡检Agent',
      history: [
        ...(ticket.history ?? []),
        {
          id: `${ticket.id}-plan-${Date.now()}`,
          step: 1,
          type: 'approval',
          actor: '运维值班员',
          role: 'technical',
          time: nowTime(),
          title: '巡检路线已确认',
          content: `运维值班员确认 ${stationList.length} 座电站的巡检路线方案，任务进入数据采集阶段。`,
          attachments: [],
        },
      ],
    })
    setBusy(false)
  }

  const activeAgent = selectedInfo.executorType === 'agent'
    ? { id: 'inspection-agent', name: '巡检Agent' }
    : { id: 'assistant', name: 'Smart Assistant' }
  const userRoleName = selectedInfo.executorType === 'human' ? selectedInfo.executor : '当前用户'

  const submitQuestion = () => {
    const text = draft.trim()
    if (!text) return
    setQaMessages((items) => [
      ...items,
      { id: `local-${Date.now()}`, type: 'user', actor: userRoleName, time: nowTime(), content: text },
    ])
    setDraft('')
    if (qaReplyTimerRef.current) window.clearTimeout(qaReplyTimerRef.current)
    qaReplyTimerRef.current = window.setTimeout(() => {
      setQaMessages((items) => [
        ...items,
        {
          id: `agent-${Date.now()}`,
          type: 'agent',
          actor: activeAgent.name,
          time: nowTime(),
          content: `问题已记录，${activeAgent.name} 将结合当前节点与已归档数据继续分析。`,
        },
      ])
      qaReplyTimerRef.current = null
    }, 420)
  }

  const visibleHistory = history.filter((item) => Number(item?.step) === selectedStep)

  const renderMessage = (message) => {
    const Icon = MESSAGE_ICONS[message.type] ?? MESSAGE_ICONS.system
    return (
      <article className={`ticket-message ticket-message--${message.type ?? 'system'}`} key={message.id}>
        <div className="ticket-message__rail">
          <span className="ticket-message__icon"><Icon size={15} aria-hidden="true" /></span>
          <span className="ticket-message__line" aria-hidden="true" />
        </div>
        <div className="ticket-message__body">
          <div className="ticket-message__meta">
            <strong>{message.actor ?? '流程引擎'}</strong>
            <time>{message.time ?? ''}</time>
          </div>
          <h3>{message.title ?? '流程更新'}</h3>
          {contentLines(message).map((line, index) => <p key={`${message.id}-line-${index}`}>{line}</p>)}
        </div>
      </article>
    )
  }

  const onCurrentStep = selectedStep === currentStep && !completed

  return (
    <div className="ticket-page">
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
          <div className="ticket-page__title-row">
            <h1>{ticket.title}</h1>
            <span className={`ticket-page__status ${completed ? 'is-completed' : 'is-running'}`}>
              <span aria-hidden="true" />
              {ticket.status || '进行中'}
            </span>
          </div>
        </div>
      </header>

      <div className="ticket-page__workspace">
        <section className="ticket-thread" aria-label="任务对话与证据流">
          <div className="ticket-thread__scope">
            <div>
              <span>节点 {String(selectedInfo.index).padStart(2, '0')}</span>
              <h2>{selectedInfo.name}</h2>
            </div>
            <div className="ticket-thread__scope-meta">
              <span>{selectedInfo.executor}</span>
              <span>{completed ? '已完成' : selectedInfo.index < currentStep ? '已完成' : selectedInfo.index === currentStep ? '进行中' : '未开始'}</span>
            </div>
          </div>

          <AgentConversation
            messages={qaMessages}
            streamClassName="ticket-thread__stream"
            streamRef={streamRef}
            autoScroll={false}
            empty={null}
            beforeMessages={(
              <>
                {visibleHistory.map(renderMessage)}
                {selectedInfo.id === 'plan' && (
                  <PlanStage
                    step={selectedInfo}
                    content={content}
                    routeTab={routeTab}
                    onSelectRoute={setRouteTab}
                    canConfirm={onCurrentStep && currentStep === 1}
                    busy={busy}
                    onConfirm={confirmPlan}
                  />
                )}
                {selectedInfo.id === 'collect' && (
                  <CollectStage
                    step={selectedInfo}
                    content={content}
                    flightIndex={flightIndex}
                    flightDone={collectFinished}
                    onFlightDone={handleFlightLegDone}
                  />
                )}
                {selectedInfo.id === 'analyze' && (
                  <AnalyzeStage step={selectedInfo} content={content} />
                )}
                {selectedInfo.id === 'report' && (
                  <ReportStage step={selectedInfo} sections={sections} />
                )}
              </>
            )}
            footer={(
              <div className="ticket-thread__chat-bar">
                <AgentConversationSuggestions
                  presets={QA_SUGGESTIONS[selectedInfo.id] ?? [`${selectedInfo.name}的进展如何？`, '有哪些需要我处理的事项？']}
                  onSuggestionSelect={(item) => setDraft(typeof item === 'string' ? item : item?.question ?? '')}
                />
                <AgentConversationComposer
                  draft={draft}
                  setDraft={setDraft}
                  submitMessage={submitQuestion}
                  placeholder="补充意见或向智能体提问"
                  ariaLabel="补充意见或向智能体提问"
                />
              </div>
            )}
          />
        </section>
      </div>

      {/* 步骤栏与时间轴固定在页面底部 */}
      <TaskFlow
        steps={steps}
        currentStep={currentStep}
        selectedStep={selectedStep}
        completed={completed}
        onSelect={setSelectedStep}
        history={history}
      />
    </div>
  )
}
