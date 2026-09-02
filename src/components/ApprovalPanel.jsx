import {
  CheckCircle as CheckCircle2,
  ArrowBendDownLeft as CornerDownLeft,
  Pause,
  Airplane as Plane,
} from '@phosphor-icons/react'

// 按流程节点 id 配置审批按钮文案，兼容标准流程与合并流程
export const DECISION_COPY = {
  review: {
    approve: '确认缺陷',
  },
  diagnose: {
    approve: '确认缺陷并转工单',
    suspend: '确认并挂起',
  },
  'work-order': {
    approve: '批准工单生成',
    reject: '退回补充诊断',
  },
  'schedule-approval': {
    approve: '批准排程',
    reject: '返回调整',
  },
  'work-order-approval': {
    approve: '批准工单',
    reject: '返回调整',
  },
  'permit-request': {
    approve: '提交两票申请',
    reject: '返回工单',
  },
  'permit-approval': {
    approve: '批准两票',
    reject: '返回修改',
  },
  close: {
    approve: '批准关闭',
    reject: '返回返工',
  },
}

// 可以挂起 / 发起无人机复检的复核类节点
const REVIEW_STEP_IDS = new Set(['review', 'diagnose'])

function isInactiveStatus(status) {
  const value = String(status ?? '')
  return ['completed', 'suspended', '已完成', '已挂起'].some((item) => value === item)
}

// 两票会签角色的按钮文案
const SIGN_BUTTONS = {
  control: { label: '批准工作票', done: '工作票已批准' },
  operations: { label: '批准操作票', done: '操作票已批准' },
}

export function ApprovalPanel({
  ticket,
  step,
  busy = '',
  disabled = false,
  canProcess = true,
  role = '',
  className = '',
  branchRole = '',
  onApprove,
  onSign,
  onReject,
  onSuspend,
  onDrone,
}) {
  const isApprovalStep = step?.advanceMode === 'approval' && Boolean(step?.approverRole)
  const inactive = disabled || !canProcess || isInactiveStatus(ticket?.status) || Boolean(busy)
  const dronePending = Boolean(ticket?.droneRequested)
  const copy = DECISION_COPY[step?.id] ?? {}
  const isReviewStep = REVIEW_STEP_IDS.has(step?.id)
  // 顺序会签节点：工作许可人先批工作票，批准后"批准工作票"按钮消失，
  // 仅在生成操作票时出现"批准操作票"按钮；未生成操作票时批完工作票直接进入下一步
  // branchRole：步骤栏会签分支过滤，点哪个分支只出现哪个角色的批准按钮
  const workPermitSigned = Boolean(ticket?.permitSignoffs?.control)
  const signRoles = Array.isArray(step?.approverRoles)
    ? step.approverRoles.filter((item) => {
        if (branchRole && item !== branchRole) return false
        if (item === 'operations') return Boolean(ticket?.operationPermitEnabled) && workPermitSigned
        return !workPermitSigned
      })
    : null

  // Space-gated and automatic nodes keep their existing progression logic in
  // TicketPage, but do not expose a prompt or a duplicate task panel in the
  // customer-facing demo.
  if (!isApprovalStep) return null

  // 会签节点全部必需角色签完后隐藏整个处置面板，等待空格推进
  const requiredSigners = Array.isArray(step?.approverRoles)
    ? step.approverRoles.filter((item) => item !== 'operations' || Boolean(ticket?.operationPermitEnabled))
    : null
  if (requiredSigners?.length && requiredSigners.every((item) => Boolean(ticket?.permitSignoffs?.[item]))) {
    return null
  }

  return (
    <aside className={`approval-panel${className ? ` ${className}` : ''}`} aria-label="当前节点处置">
      <div className="approval-panel__decision">
        <div className="approval-panel__actions">
          {signRoles ? (
            signRoles.map((signRole) => {
              const signed = Boolean(ticket?.permitSignoffs?.[signRole])
              const allowed = role === 'admin' || role === signRole
              const meta = SIGN_BUTTONS[signRole]
              return (
                <button
                  className={`approval-panel__action approval-panel__action--approve${signed ? ' is-signed' : ''}`}
                  type="button"
                  key={signRole}
                  disabled={disabled || isInactiveStatus(ticket?.status) || Boolean(busy) || signed || !allowed}
                  onClick={() => onSign?.(signRole)}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {busy === `sign-${signRole}` ? '处理中' : signed ? meta.done : meta.label}
                </button>
              )
            })
          ) : (
            <button
              className="approval-panel__action approval-panel__action--approve"
              type="button"
              disabled={inactive}
              onClick={onApprove}
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              {busy === 'approve' ? '处理中' : copy.approve ?? '确认并继续'}
            </button>
          )}

          {copy.reject && (
            <button
              className="approval-panel__action approval-panel__action--reject"
              type="button"
              disabled={inactive}
              onClick={onReject}
            >
              <CornerDownLeft size={16} aria-hidden="true" />
              {busy === 'reject' ? '处理中' : copy.reject}
            </button>
          )}

          {isReviewStep && (
            <>
              <button
                className="approval-panel__action approval-panel__action--suspend"
                type="button"
                disabled={inactive}
                onClick={onSuspend}
              >
                <Pause size={16} aria-hidden="true" />
                {busy === 'suspend' ? '处理中' : copy.suspend ?? '确认并挂起'}
              </button>
              <button
                className="approval-panel__action approval-panel__action--drone"
                type="button"
                disabled={inactive || dronePending}
                onClick={onDrone}
              >
                <Plane size={16} aria-hidden="true" />
                {busy === 'drone' ? '调度中' : dronePending ? '复检已下发' : '无人机复检'}
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default ApprovalPanel
