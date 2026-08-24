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
  flowSteps,
  initialTickets,
  reportActions as initialReportActions,
  reportSections,
  roles,
  SPACE_ADVANCE_STEPS,
  stations,
} from '../data/demoData.js'

// Bump the persisted demo schema whenever the workflow contract changes.  A
// stale snapshot can contain tickets at an obsolete node and must never
// overwrite the canonical 13-step demonstration.
const STORAGE_KEY = 'yalong-ops-ui:demo:v2'
const STORAGE_VERSION = 4
const DEFAULT_ROLE = 'admin'

const AppContext = createContext(null)

const clone = (value) => JSON.parse(JSON.stringify(value))

function readPersistedState() {
  if (typeof window === 'undefined') return {}

  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    if (value?.version === STORAGE_VERSION) return value

    // v2 was written while the demo defaulted to a specialist role. Preserve
    // its ticket progress, but migrate the session to the administrator so
    // every approval node is immediately actionable without role switching.
    if (value?.version === 2 || value?.version === 3) {
      return { ...value, version: STORAGE_VERSION, role: DEFAULT_ROLE, taskGrouping: 'status' }
    }

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

function statusForStep(step) {
  if (!step || step.index === 13) return '已完成'
  if (step.approverRole) {
    return step.index === 8 ? '待现场工程师提交' : `待${step.executor}审批`
  }
  if (step.advanceMode === 'space') return 'Agent 待处理'
  return `${step.executor}处理中`
}

function stageForStep(stepIndex) {
  if (stepIndex <= 5) return 'defect'
  if (stepIndex <= 10) return 'dispatch'
  return 'closure'
}

const APPROVAL_STEPS = new Set([3, 5, 7, 8, 9, 12])

// A rejection is deliberately not a generic "previous step" operation.  The
// demo follows the exact return paths used by the operating procedure.
const REJECT_TARGETS = {
  5: 5,
  7: 7,
  8: 7,
  9: 8,
  12: 10,
}

function normalizeStepIndex(value, fallback = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(flowSteps.length, Math.max(1, Math.trunc(numeric)))
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
  if (!step?.approverRole) return false
  if (roleId === 'admin') return true
  if (roleId !== step.approverRole) return false

  // Keep the flow definition authoritative, while also honouring the role
  // catalogue when it declares an explicit approval scope.
  const role = roles.find((item) => item.id === roleId)
  return !Array.isArray(role?.approvalSteps) || role.approvalSteps.includes(step.index)
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

export function AppProvider({ children }) {
  const [persisted] = useState(readPersistedState)
  const [role, setRoleState] = useState(
    roles.some((item) => item.id === persisted.role) ? persisted.role : DEFAULT_ROLE,
  )
  const [taskGrouping, setTaskGroupingState] = useState(
    ['stage', 'status'].includes(persisted.taskGrouping) ? persisted.taskGrouping : 'status',
  )
  const [sidebarTab, setSidebarTab] = useState(
    ['tasks', 'chat'].includes(persisted.sidebarTab) ? persisted.sidebarTab : 'tasks',
  )
  const [tickets, setTickets] = useState(() =>
    Array.isArray(persisted.tickets)
      ? persisted.tickets.map((ticket) => ({
          ...ticket,
          currentStep: normalizeStepIndex(ticket.currentStep),
          history: historyWithStep(ticket.history, ticket.currentStep),
        }))
      : clone(initialTickets).map((ticket) => ({
          ...ticket,
          history: historyWithStep(ticket.history, ticket.currentStep),
        })),
  )
  const [reportActions, setReportActions] = useState(() =>
    Array.isArray(persisted.reportActions)
      ? persisted.reportActions
      : clone(initialReportActions),
  )
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        role,
        taskGrouping,
        sidebarTab,
        tickets,
        reportActions,
      }),
    )
  }, [reportActions, role, sidebarTab, taskGrouping, tickets])

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
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

  const setTaskGrouping = useCallback((nextGrouping) => {
    if (['stage', 'status'].includes(nextGrouping)) {
      setTaskGroupingState(nextGrouping)
    }
  }, [])

  const advanceTicket = useCallback(
    (ticketId, action = 'space') => {
      const actionType = typeof action === 'string' ? action : action?.type || 'space'
      const actionNote = typeof action === 'object' ? action.note : ''
      const ticket = tickets.find((item) => item.id === ticketId)
      if (!ticket) {
        showToast('未找到该任务', 'warning')
        return null
      }

      const currentStepIndex = normalizeStepIndex(ticket.currentStep)
      const currentStep = flowSteps[currentStepIndex - 1]
      if (!currentStep) {
        showToast('当前流程节点无效，请重置演示数据', 'warning')
        return null
      }
      if (isTerminalStatus(ticket.status) || isSuspendedStatus(ticket.status)) {
        showToast(isTerminalStatus(ticket.status) ? '任务已完成' : '任务已挂起，请先恢复', 'warning')
        return null
      }

      const approvalAction = actionType === 'approve' || actionType === 'reject'
      if (approvalAction && (!APPROVAL_STEPS.has(currentStepIndex) || !roleCanApprove(currentStep, role))) {
        showToast('当前角色无权处理该审批', 'warning')
        return null
      }

      if (actionType === 'suspend') {
        if (currentStepIndex !== 3 || !['technical', 'admin'].includes(role)) {
          showToast('仅第 3 步可由技术负责人挂起', 'warning')
          return null
        }
      } else if (actionType === 'space') {
        if (!SPACE_ADVANCE_STEPS.includes(currentStepIndex)) {
          showToast('当前节点暂不可推进', 'warning')
          return null
        }
      } else if (actionType === 'next') {
        // Keep the old action name from silently bypassing the demo's keyboard
        // gate.  TicketPage should translate a Space keypress to "space".
        showToast('当前节点由系统推进', 'warning')
        return null
      } else if (actionType === 'auto') {
        if (currentStepIndex !== 13 || currentStep.advanceMode !== 'auto') {
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
          stage: stageForStep(currentStepIndex),
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
        const targetStepIndex = REJECT_TARGETS[currentStepIndex]
        if (!targetStepIndex) {
          showToast('当前节点没有可用的退回路径', 'warning')
          return null
        }
        const targetStep = flowSteps[targetStepIndex - 1]
        updatedTicket = {
          ...ticket,
          currentStep: targetStepIndex,
          stage: stageForStep(targetStepIndex),
          assignee: targetStep.executor,
          status: '已退回重新处理',
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
              title: `${currentStep.name}已退回`,
              content: actionNote || '证据不充分，请补充后重新提交。',
              targetStep: targetStepIndex,
            }),
          ],
        }
      } else {
        // approve/space complete the current node and move one node forward;
        // the terminal step is completed by its explicit auto action.
        const nextStepIndex = Math.min(flowSteps.length, currentStepIndex + 1)
        const nextStep = flowSteps[nextStepIndex - 1]
        const completedAtStep13 = currentStepIndex === 13
        const completionHistory = [
          ...existingHistory,
          historyEntry({
            ticket,
            step: currentStepIndex,
            type: currentStep.executorType,
            actor: currentStep.executor,
            role: currentStep.executorId,
            time,
            title: `${currentStep.name}已完成`,
            content: actionNote || '当前环节已完成，任务自动进入下一步。',
          }),
        ]
        updatedTicket = {
          ...ticket,
          currentStep: completedAtStep13 ? 13 : nextStepIndex,
          stage: stageForStep(completedAtStep13 ? 13 : nextStepIndex),
          assignee: nextStep?.executor || '知识Agent',
          status: completedAtStep13
            ? '已完成'
            : nextStep?.index === 13
              ? `${nextStep.executor}处理中`
              : statusForStep(nextStep),
          completed: completedAtStep13,
          updatedAt: time,
          history: completionHistory,
        }
      }

      setTickets((current) =>
        current.map((item) => (item.id === ticketId ? updatedTicket : item)),
      )
      showToast(actionType === 'suspend' ? '任务已挂起' : actionType === 'reject' ? '任务已退回' : '任务流程已更新')
      return updatedTicket
    },
    [role, showToast, tickets],
  )

  const requestDrone = useCallback(
    (ticketId) => {
      const ticket = tickets.find((item) => item.id === ticketId)
      if (!ticket) {
        showToast('未找到该任务', 'warning')
        return null
      }
      const currentStepIndex = normalizeStepIndex(ticket.currentStep)
      if (currentStepIndex !== 3 || !['technical', 'admin'].includes(role)) {
        showToast('仅第 3 步可由技术负责人发起复检', 'warning')
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
        assignee: '感知Agent',
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
          ...historyWithStep(ticket.history, 3),
          historyEntry({
            ticket,
            step: 3,
            type: 'agent',
            actor: '感知Agent',
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
    [role, showToast, tickets],
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
      const currentStep = normalizeStepIndex(input.currentStep || (isInspection ? 1 : 5))
      const step = flowSteps[currentStep - 1] || flowSteps[0]
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
        status: input.status || (currentStep === 13 ? '已完成' : statusForStep(step)),
        currentStep,
        stage: stageForStep(currentStep),
        assignee: input.assignee || step.executor,
        completed: currentStep === 13 || isTerminalStatus(input.status),
        updatedAt: nowLabel(),
        description: input.description || '任务已由总控Agent创建，等待当前执行人处理。',
        evidence: input.evidence || [],
        history: historyWithStep(suppliedHistory, currentStep),
        purpose: input.purpose || '',
        scheduledAt: input.scheduledAt || null,
      }

      setTickets((current) => [ticket, ...current])
      setSidebarTab('tasks')
      showToast(`${ticket.type}已创建`)
      return ticket
    },
    [showToast],
  )

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
          currentStep: 5,
          description: '巡检中已完成感知核验与 AI 诊断，直接提交技术负责人批准工单生成。',
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

  const resetDemo = useCallback(() => {
    setRoleState(DEFAULT_ROLE)
    setTaskGroupingState('status')
    setTickets(
      clone(initialTickets).map((ticket) => ({
        ...ticket,
        history: historyWithStep(ticket.history, ticket.currentStep),
      })),
    )
    setReportActions(clone(initialReportActions))
    setSidebarTab('tasks')
    showToast('演示任务已复位')
  }, [showToast])

  const currentRole = useMemo(
    () => roles.find((item) => item.id === role) || roles[0],
    [role],
  )

  const value = useMemo(
    () => ({
      role,
      currentRole,
      setRole,
      taskGrouping,
      setTaskGrouping,
      sidebarTab,
      setSidebarTab,
      tickets,
      reportActions,
      toast,
      clearToast,
      advanceTicket,
      requestDrone,
      createTask,
      handleReportAction,
      resetDemo,
      showToast,
      roles,
      agents,
      stations,
      flowSteps,
      cockpitKpis,
      reportSections,
      chatSessions,
    }),
    [
      advanceTicket,
      clearToast,
      createTask,
      currentRole,
      handleReportAction,
      reportActions,
      requestDrone,
      resetDemo,
      role,
      setRole,
      setTaskGrouping,
      showToast,
      sidebarTab,
      taskGrouping,
      tickets,
      toast,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}

export { STORAGE_KEY }
