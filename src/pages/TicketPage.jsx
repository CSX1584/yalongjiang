import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle as CheckCircle2,
  GitBranch,
  WarningCircle as CircleAlert,
  X,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import ReasoningChain, { REASONING_NODE_STEP } from '../components/ReasoningChain'
import TaskFlow from '../components/TaskFlow'
import TicketStageContent from '../components/TicketStageContent'
import { resolveStepRole } from '../data/demoData'

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
  return (Array.isArray(source) ? source : []).map((item, offset) => ({
    ...item,
    index: Number(item.index ?? item.step ?? item.order) || offset + 1,
    shortLabel: item.shortLabel ?? item.short ?? item.name,
    name: item.name ?? item.label ?? `步骤 ${offset + 1}`,
    executor: item.executor ?? item.owner ?? '',
  }))
}

function fallbackHistory(ticket) {
  const evidenceCount = Array.isArray(ticket?.evidence) ? ticket.evidence.length : 0
  return [
    {
      id: 'event-detected',
      step: 1,
      type: 'system',
      actor: '异常感知',
      time: ticket?.updatedAt ?? '08:42',
      title: '异常事件已触发',
      content: ticket?.description ?? '实时监测数据超过告警阈值，已自动创建诊断任务。',
    },
    {
      id: 'event-diagnosed',
      step: 2,
      type: 'agent',
      actor: 'AI 诊断',
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

// 合并流程三票（热斑/反灌/脱网）走页签布局：左侧步骤页签 + 右侧推理链入口
function isRefluxTicket(ticket) {
  const key = `${ticket?.id ?? ''} ${ticket?.title ?? ''}`
  return ['DF-20260820-001', 'DF-20260820-002', 'DF-20260820-003'].some((id) => key.includes(id))
    || key.includes('反灌') || key.includes('热斑') || key.includes('脱网')
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
  const { tickets, role, setRole, advanceTicket, requestDrone, showToast, flowSteps, spaceAdvanceSteps, reasoningFocus, ticketStepFocus, flowVariant, flowVariants, ticketIntroId, ticketCardsReadyId } = useApp()
  const ticket = useMemo(() => findTicket(tickets, activeId), [activeId, tickets])
  const steps = useMemo(() => buildSteps(flowSteps), [flowSteps])
  const lastStepIndex = steps.length
  const currentStep = Math.min(lastStepIndex, Math.max(1, Number(ticket?.currentStep) || 1))
  // 缺陷单内容所在步骤：合并流程在故障诊断列，标准流程在缺陷单生成列
  const defectStepIndex = steps.find((step) => step.id === 'defect' || step.combined === 'diagnose-defect')?.index ?? currentStep
  const [selectedStep, setSelectedStep] = useState(currentStep)
  // 作业审批节点的会签分支：'' 不区分分支，'control' 工作票 / 'operations' 操作票
  const [selectedBranch, setSelectedBranch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const streamRef = useRef(null)
  // 瀑布流卡片锚点：步骤号 → 卡片容器，思维链/对话流节点点击后滚动定位
  const cardRefs = useRef(new Map())
  const autoRequestRef = useRef('')

  const status = ticketStatusMeta(ticket?.status)
  const completed = Boolean(ticket?.completed) || ['completed', 'complete', '已完成'].includes(String(ticket?.status ?? ''))
  // 合并流程三票走页签布局：左侧步骤页签 + 内容区 + 右侧推理链入口
  const reasoningMode = isRefluxTicket(ticket)

  // 页签状态：openTabs 已打开页签（步骤号升序）、activeTab 当前页签、tabLoading 切换时先播骨架动画
  const [openTabs, setOpenTabs] = useState([])
  const [activeTab, setActiveTab] = useState(null)
  const [tabLoading, setTabLoading] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)
  const tabTimerRef = useRef(0)
  // 已播过骨架动画的页签：同一会话内每个步骤只在第一次进入时播
  const loadedTabsRef = useRef(new Set())

  /** 页签内容区先播三卡骨架动画再出内容，每个页签仅首次进入时播 */
  const playTabLoading = useCallback((index) => {
    if (loadedTabsRef.current.has(index)) return
    loadedTabsRef.current.add(index)
    setTabLoading(true)
    window.clearTimeout(tabTimerRef.current)
    tabTimerRef.current = window.setTimeout(() => setTabLoading(false), 900)
  }, [])

  /** 打开（若未打开）并激活页签 */
  const activateTab = useCallback((index) => {
    setOpenTabs((tabs) => (tabs.includes(index) ? tabs : [...tabs, index].sort((a, b) => a - b)))
    setActiveTab(index)
    playTabLoading(index)
  }, [playTabLoading])

  /** 关闭页签只是关闭内容；关的是当前页签则激活剩余最后一个 */
  const closeTab = (index) => {
    const next = openTabs.filter((tab) => tab !== index)
    setOpenTabs(next)
    if (activeTab === index) setActiveTab(next[next.length - 1] ?? null)
  }

  const runAction = useCallback(async (action) => {
    if (!ticket || busy) return
    const isObject = typeof action === 'object' && action !== null
    const busyKey = isObject && action.type === 'approve' && action.signRole
      ? `sign-${action.signRole}`
      : isObject ? action.type : action
    setBusy(busyKey)
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
    setSelectedBranch('')
  }, [activeId, currentStep])

  // 进入工单：默认选中缺陷单卡片（覆盖上面的 currentStep 默认选中；推进步骤时仍跟随最新步骤）
  useEffect(() => {
    setSelectedStep(defectStepIndex)
    setSelectedBranch('')
  }, [activeId, defectStepIndex])

  // 卡片滚动定位：切工单瞬时定位，推进步骤/点击节点平滑滚动
  const lastTicketRef = useRef('')
  const scrollToStep = useCallback((index, behavior = 'smooth') => {
    cardRefs.current.get(index)?.scrollIntoView({ behavior, block: 'start' })
  }, [])

  // 步骤栏/思维链选择：记录选中态；页签布局下打开对应页签，瀑布流布局下滚动定位
  const handleSelectStep = useCallback((index, _step, branch = '') => {
    setSelectedStep(index)
    setSelectedBranch(branch)
    if (reasoningMode) activateTab(index)
    else scrollToStep(index)
  }, [activateTab, reasoningMode, scrollToStep])

  // 页签初始化与推进联动：换工单重置为全部已解锁页签并激活缺陷单步骤；同单推进时新步骤自动增加页签并激活
  const tabInitRef = useRef('')
  useEffect(() => {
    if (!reasoningMode || !ticket) return
    const key = `${activeId}:${currentStep}:${completed}`
    if (tabInitRef.current === key) return
    const prevId = tabInitRef.current.split(':')[0]
    tabInitRef.current = key
    const unlocked = steps.filter((s) => completed || s.index <= currentStep).map((s) => s.index)
    if (prevId !== activeId) {
      loadedTabsRef.current = new Set()
      setOpenTabs(unlocked)
      setActiveTab(defectStepIndex)
      playTabLoading(defectStepIndex)
    } else {
      setOpenTabs((tabs) => Array.from(new Set([...tabs, ...unlocked])).sort((a, b) => a - b))
      setActiveTab(currentStep)
      playTabLoading(currentStep)
    }
  }, [activeId, completed, currentStep, defectStepIndex, playTabLoading, reasoningMode, steps, ticket])

  // 卸载时清理骨架动画定时器
  useEffect(() => () => window.clearTimeout(tabTimerRef.current), [])

  // 对话胶囊点击：选中节点所属步骤，下方展开该步骤详情（节点高亮由 ReasoningChain 处理）
  useEffect(() => {
    const stepId = reasoningFocus?.nodeId ? REASONING_NODE_STEP[reasoningFocus.nodeId] : null
    if (!stepId) return
    const target = steps.find((step) => step.id === stepId)
    if (target) handleSelectStep(target.index, target)
  }, [handleSelectStep, reasoningFocus, steps])

  // 对话流步骤卡片「查看步骤」点击：滚动定位到对应步骤卡片
  useEffect(() => {
    if (!ticketStepFocus?.stepIndex) return
    const target = steps.find((step) => step.index === ticketStepFocus.stepIndex)
    if (target) handleSelectStep(target.index, target)
  }, [handleSelectStep, steps, ticketStepFocus])

  // 全局角色跟随当前节点归属角色切换，保证审批权限与界面显示的角色一致
  useEffect(() => {
    if (!ticket || completed) return
    const nextRoleId = resolveStepRole(steps[currentStep - 1], ticket).id
    if (nextRoleId && nextRoleId !== role) setRole(nextRoleId)
  }, [completed, currentStep, role, setRole, steps, ticket])

  // 换工单瞬移定位到缺陷单卡片；同单流程推进平滑滚动到最新卡片
  useEffect(() => {
    const switched = lastTicketRef.current !== activeId
    lastTicketRef.current = activeId
    scrollToStep(switched ? defectStepIndex : currentStep, switched ? 'auto' : 'smooth')
  }, [activeId, currentStep, defectStepIndex, scrollToStep])

  useEffect(() => {
    if (!ticket || completed) return undefined

    const handleKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      if (!spaceAdvanceSteps.includes(currentStep) || drawerOpen || busy) return
      const target = event.target
      const tagName = String(target?.tagName ?? '').toLowerCase()
      if (['input', 'textarea', 'select'].includes(tagName) || target?.isContentEditable) return
      event.preventDefault()
      runAction('space')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [busy, completed, currentStep, drawerOpen, runAction, spaceAdvanceSteps, ticket])

  useEffect(() => {
    if (!ticket || completed || currentStep !== lastStepIndex || busy) return
    const requestKey = `${ticket.id}:${lastStepIndex}`
    if (autoRequestRef.current === requestKey) return
    autoRequestRef.current = requestKey
    const timer = window.setTimeout(() => runAction('auto'), 1900)
    return () => window.clearTimeout(timer)
  }, [busy, completed, currentStep, lastStepIndex, runAction, ticket])

  const history = useMemo(() => {
    if (!ticket) return []
    return Array.isArray(ticket.history) && ticket.history.length
      ? ticket.history
      : fallbackHistory(ticket)
  }, [ticket])

  const evidence = useMemo(() => collectEvidence(ticket, history), [history, ticket])

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

  return (
    <div className={`ticket-page${reasoningMode ? ' ticket-page--reasoning' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}>
      {!reasoningMode && (
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
          </div>
        </header>
      )}

      {reasoningMode ? (
        <div className="ticket-page__workspace ticket-page__workspace--tabs">
          {/* 顶部页签行：页签从左到右排列（新页签向右追加），右侧 AI 推理链入口 */}
          <div className="ticket-tabs-bar">
            <nav className="ticket-tabs" aria-label="流程步骤页签">
              {openTabs.map((tabIndex) => {
                const stepInfo = steps.find((item) => item.index === tabIndex)
                if (!stepInfo) return null
                const active = activeTab === stepInfo.index
                return (
                  <div
                    className={`ticket-tabs__tab${active ? ' is-active' : ''}`}
                    key={stepInfo.id ?? stepInfo.index}
                  >
                    <button
                      type="button"
                      className="ticket-tabs__tab-main"
                      onClick={() => handleSelectStep(stepInfo.index, stepInfo)}
                    >
                      <span className="ticket-tabs__tab-name">{stepInfo.shortLabel ?? stepInfo.name}</span>
                    </button>
                    <button
                      type="button"
                      className="ticket-tabs__tab-close"
                      onClick={() => closeTab(stepInfo.index)}
                      aria-label={`关闭${stepInfo.shortLabel ?? stepInfo.name}页签`}
                      title="关闭页签"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )
              })}
            </nav>
            <button
              type="button"
              className={`ticket-tabs-bar__chain${chainOpen ? ' is-active' : ''}`}
              onClick={() => setChainOpen((value) => !value)}
              aria-expanded={chainOpen}
              title="AI 推理链"
            >
              <GitBranch size={14} aria-hidden="true" />
              <span>AI 推理链</span>
            </button>
          </div>

          {/* 推理链展开：点击入口后在页签行下方向下展开横向思维导图 */}
          {chainOpen && (
            <div className="ticket-chain-panel">
              <ReasoningChain
                completed={completed}
                currentStep={currentStep}
                focusNode={reasoningFocus}
                initialOpen
                onSelect={handleSelectStep}
                selectedStep={selectedStep}
                steps={steps}
              />
            </div>
          )}

          {/* 内容区：切换/打开页签先播三卡骨架动画，再渲染对应步骤卡片 */}
          <section className="ticket-tab-panel" aria-label="步骤内容">
            {activeTab == null || !openTabs.includes(activeTab) ? (
              <div className="ticket-tab-panel__empty">
                从顶部页签选择步骤，或在左侧对话中点击「查看步骤」重新打开
              </div>
            ) : tabLoading ? (
              <div className="ticket-thread__skeleton" aria-hidden="true">
                <span /><span /><span />
              </div>
            ) : (
              <div className="ticket-thread__card" data-step={activeTab}>
                <TicketStageContent
                  step={steps.find((stepInfo) => stepInfo.index === activeTab)}
                  ticket={ticket}
                  currentStep={currentStep}
                  completed={completed}
                  branchRole={activeTab === selectedStep ? selectedBranch : ''}
                />
              </div>
            )}
          </section>
        </div>
      ) : (
      <div className="ticket-page__workspace">
        <section className="ticket-thread" aria-label="任务对话与证据流">
          {/* 瀑布流：已解锁步骤卡片依次叠放，新步骤追加在下方，审批面板跟随当前步骤卡片；首进编排期间卡片逐块生成。
              卡片在左侧首条「已深度思考」气泡播完 1s 后（ticketCardsReadyId 置位）才渲染，之前显示骨架占位 */}
          <div className={`ticket-thread__stream${ticketIntroId === ticket?.id ? ' ticket-thread__stream--intro' : ''}`} ref={streamRef}>
            {ticketIntroId === ticket?.id && ticketCardsReadyId !== ticket?.id ? (
              <div className="ticket-thread__skeleton" aria-hidden="true">
                <span /><span /><span />
              </div>
            ) : (
              steps
                .filter((stepInfo) => completed || stepInfo.index <= currentStep)
                .map((stepInfo) => (
                  <div
                    className="ticket-thread__card"
                    data-step={stepInfo.index}
                    key={stepInfo.id ?? stepInfo.index}
                    ref={(el) => {
                      if (el) cardRefs.current.set(stepInfo.index, el)
                      else cardRefs.current.delete(stepInfo.index)
                    }}
                  >
                    <TicketStageContent
                      step={stepInfo}
                      ticket={ticket}
                      currentStep={currentStep}
                      completed={completed}
                      branchRole={stepInfo.index === selectedStep ? selectedBranch : ''}
                    />
                  </div>
                ))
            )}
          </div>

        </section>
      </div>
      )}

      {/* 步骤栏与时间轴固定在页面底部；版本3 不渲染 */}
      {!flowVariants[flowVariant]?.hideTaskFlow && (
        <TaskFlow
          steps={steps}
          currentStep={currentStep}
          selectedStep={selectedStep}
          completed={completed}
          onSelect={handleSelectStep}
          history={ticket?.history}
          signoffs={ticket?.permitSignoffs}
          selectedBranch={selectedBranch}
        />
      )}

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
