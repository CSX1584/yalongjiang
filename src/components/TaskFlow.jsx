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
export const DEFAULT_FLOW_STEPS = flowSteps

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
  'permit-request': { Icon: FileArrowUp, tone: 'cyan' },
  'permit-approval': { Icon: SealCheck, tone: 'green' },
  execute: { Icon: Wrench, tone: 'orange' },
  validate: { Icon: TestTube, tone: 'teal' },
  close: { Icon: LockKey, tone: 'slate' },
  learn: { Icon: Books, tone: 'violet' },
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
  const source = Array.isArray(steps) ? steps : []

  return DEFAULT_FLOW_STEPS.map((fallback, offset) => {
    const supplied = source.find((step) => Number(step.index ?? step.step ?? step.order) === fallback.index)
      ?? source[offset]
      ?? {}

    return {
      ...fallback,
      ...supplied,
      index: fallback.index,
      id: supplied.id ?? fallback.id,
      shortLabel: supplied.shortLabel ?? supplied.short ?? fallback.shortLabel,
      name: supplied.name ?? supplied.label ?? fallback.name,
      executor: supplied.executor ?? supplied.owner ?? fallback.executor,
      executorType: supplied.executorType ?? supplied.type ?? fallback.executorType,
    }
  })
}

export function TaskFlow({
  steps,
  currentStep = 1,
  selectedStep = currentStep,
  completed = false,
  onSelect,
}) {
  const normalizedSteps = normalizeSteps(steps)
  const activeIndex = Math.min(13, Math.max(1, Number(currentStep) || 1))

  return (
    <section className="task-flow" aria-label="工单任务流">
      <div className="task-flow__track">
        {normalizedSteps.map((step, offset) => {
          const status = normalizeStatus(step.status, step.index, activeIndex, completed)
          const { label: statusLabel } = STATUS_META[status]
          const isHuman = step.executorType === 'human'
          const { Icon: AgentIcon, tone } = STEP_ICON_META[step.id] ?? { Icon: ListChecks, tone: 'slate' }
          const StepIcon = isHuman ? User : AgentIcon
          const connectorStatus = status === 'done' ? 'done' : status === 'current' ? 'current' : 'pending'
          const selected = Number(selectedStep) === step.index || selectedStep === step.id

          return (
            <button
              className={`task-flow__step task-flow__step--${status} task-flow__step--executor-${isHuman ? 'human' : 'agent'} task-flow__step--tone-${tone}${selected ? ' is-selected' : ''}${step.advanceMode === 'space' ? ' is-space' : ''}${step.approverRole ? ' is-approval' : ''}`}
              type="button"
              key={step.id}
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
          )
        })}
      </div>
    </section>
  )
}

export default TaskFlow
