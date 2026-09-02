import {
  Brain,
  Books,
  Bug,
  CalendarDots,
  ClipboardText,
  FileArrowUp,
  ListChecks,
  LockKey,
  MagnifyingGlass,
  Pulse,
  SealCheck,
  TestTube,
  User,
  Wrench,
} from '@phosphor-icons/react'
import { flowSteps } from '../data/demoData.js'

// Keep one canonical workflow definition.  The stage page and the task-flow
// strip must never drift into two subtly different sets of labels/executors.
const DEFAULT_FLOW_STEPS = flowSteps

const STATUS_META = {
  done: { label: '已完成' },
  current: { label: '进行中' },
  pending: { label: '未开始' },
}

// Each workflow node keeps its business meaning visible even after it has
// completed. Status is communicated by the node treatment (fill/opacity/ring)
// while the icon identifies the operation itself.
const STEP_ICON_META = {
  sense: { Icon: Pulse, tone: 'blue' },
  diagnose: { Icon: Brain, tone: 'violet' },
  review: { Icon: MagnifyingGlass, tone: 'amber' },
  defect: { Icon: Bug, tone: 'red' },
  'work-order': { Icon: ClipboardText, tone: 'blue' },
  schedule: { Icon: CalendarDots, tone: 'purple' },
  'schedule-approval': { Icon: SealCheck, tone: 'gold' },
  'work-order-approval': { Icon: SealCheck, tone: 'gold' },
  'permit-request': { Icon: FileArrowUp, tone: 'cyan' },
  'permit-approval': { Icon: SealCheck, tone: 'green' },
  execute: { Icon: Wrench, tone: 'orange' },
  validate: { Icon: TestTube, tone: 'teal' },
  close: { Icon: LockKey, tone: 'slate' },
  learn: { Icon: Books, tone: 'violet' },
  plan: { Icon: CalendarDots, tone: 'blue' },
  collect: { Icon: Pulse, tone: 'cyan' },
  analyze: { Icon: Brain, tone: 'violet' },
  report: { Icon: Books, tone: 'gold' },
}

function normalizeStatus(status, index, currentStep, completed) {
  if (completed) return 'done'
  const value = String(status ?? '')
  if (status === 'done' || status === 'completed' || value.includes('已完成')) return 'done'
  if (status === 'current' || status === 'running' || status === 'waiting_human') return 'current'
  if (status === 'pending' || status === 'skipped') return 'pending'
  if (index < currentStep) return 'done'
  if (index === currentStep) return 'current'
  return 'pending'
}

function normalizeSteps(steps) {
  const source = Array.isArray(steps) && steps.length ? steps : DEFAULT_FLOW_STEPS

  return source.map((supplied, offset) => ({
    ...supplied,
    index: Number(supplied.index ?? supplied.step ?? supplied.order) || offset + 1,
    id: supplied.id ?? `step-${offset + 1}`,
    shortLabel: supplied.shortLabel ?? supplied.short ?? supplied.name,
    name: supplied.name ?? supplied.label ?? `步骤 ${offset + 1}`,
    executor: supplied.executor ?? supplied.owner ?? '',
    executorType: supplied.executorType ?? supplied.type ?? 'agent',
  }))
}

// 多会签角色的步骤在节点下方渲染分支按钮：一个角色一个分支，带各自票种名称
const BRANCH_META = {
  control: { name: '工作许可人', doc: '工作票' },
  operations: { name: '运维负责人', doc: '操作票' },
}

export function TaskFlow({
  steps,
  currentStep = 1,
  selectedStep = currentStep,
  completed = false,
  onSelect,
  history = [],
  signoffs,
  selectedBranch = '',
}) {
  const normalizedSteps = normalizeSteps(steps)
  const activeIndex = Math.min(normalizedSteps.length, Math.max(1, Number(currentStep) || 1))

  // 步骤完成时间点：取该步骤最后一条 history 记录的时间
  const stepTimes = {}
  ;(Array.isArray(history) ? history : []).forEach((entry) => {
    const stepIndex = Number(entry?.step)
    if (stepIndex) stepTimes[stepIndex] = entry.time ?? ''
  })

  const statusOf = (step) => normalizeStatus(step.status, step.index, activeIndex, completed)

  return (
    <section className="task-flow" aria-label="工单任务流">
      <div className="task-flow__track">
        {normalizedSteps.map((step, offset) => {
          const status = statusOf(step)
          const { label: statusLabel } = STATUS_META[status]
          const isHuman = step.executorType === 'human'
          const { Icon: AgentIcon, tone } = STEP_ICON_META[step.id] ?? { Icon: ListChecks, tone: 'slate' }
          const StepIcon = isHuman ? User : AgentIcon
          const connectorStatus = status === 'done' ? 'done' : status === 'current' ? 'current' : 'pending'
          const selected = Number(selectedStep) === step.index || selectedStep === step.id
          const branches = Array.isArray(step.approverRoles) && step.approverRoles.length > 1
            ? step.approverRoles
            : null

          return (
            <div className="task-flow__cell" key={step.id}>
              <button
                className={`task-flow__step task-flow__step--${status} task-flow__step--executor-${isHuman ? 'human' : 'agent'} task-flow__step--tone-${tone}${selected ? ' is-selected' : ''}${step.advanceMode === 'space' ? ' is-space' : ''}${step.approverRole ? ' is-approval' : ''}`}
                type="button"
                onClick={() => onSelect?.(step.index, step)}
                aria-current={status === 'current' ? 'step' : undefined}
                aria-pressed={selected}
                data-advance-mode={step.advanceMode ?? 'auto'}
                title={`${step.index}. ${step.name} · ${step.executor} · ${statusLabel}`}
              >
                {offset > 0 && (
                  <span
                    className={`task-flow__connector task-flow__connector--${connectorStatus}`}
                    data-status={connectorStatus}
                    aria-hidden="true"
                  />
                )}
                <span className="task-flow__node" aria-hidden="true">
                  <StepIcon size={14} weight="regular" />
                </span>
                <span className="task-flow__copy">
                  <span className="task-flow__name">
                    <span className="task-flow__index">{String(step.index).padStart(2, '0')}</span>
                    {step.shortLabel}
                  </span>
                  <span className="task-flow__executor">{step.executor}</span>
                </span>
                <span className="sr-only">{statusLabel}</span>
              </button>
              {branches ? (
                <span className="task-flow__branches">
                  {branches.map((branchRole) => {
                    const meta = BRANCH_META[branchRole] ?? { name: branchRole, doc: '' }
                    const signed = Boolean(signoffs?.[branchRole])
                    const branchSelected = selected && selectedBranch === branchRole
                    return (
                      <button
                        className={`task-flow__branch${signed ? ' is-signed' : ''}${branchSelected ? ' is-selected' : ''}`}
                        type="button"
                        key={branchRole}
                        onClick={() => onSelect?.(step.index, step, branchRole)}
                        aria-pressed={branchSelected}
                        title={`${meta.name} · ${meta.doc}${signed ? ' · 已批准' : ' · 待批准'}`}
                      >
                        <span className="task-flow__branch-dot" aria-hidden="true" />
                        {meta.name} · {meta.doc}
                      </button>
                    )
                  })}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      {/* 时间轴：与步骤轨道同 grid 列对齐，已完成步骤标注完成时间点 */}
      <div className="task-flow__timeline" aria-hidden="true">
        {normalizedSteps.map((step) => {
          const status = statusOf(step)
          const time = status === 'done' ? stepTimes[step.index] : ''
          return (
            <span className={`task-flow__timeline-cell task-flow__timeline-cell--${status}`} key={step.id}>
              <span className="task-flow__timeline-dot" />
              <span className="task-flow__timeline-time">
                {status === 'done' ? (time || '已完成') : status === 'current' ? '进行中' : ''}
              </span>
            </span>
          )
        })}
      </div>
    </section>
  )
}

export default TaskFlow
