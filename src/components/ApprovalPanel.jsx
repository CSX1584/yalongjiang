import {
  CheckCircle as CheckCircle2,
  ArrowBendDownLeft as CornerDownLeft,
  Pause,
  Airplane as Plane,
  ShieldCheck,
} from '@phosphor-icons/react'

const APPROVAL_STEPS = new Set([3, 5, 7, 8, 9, 12])

const DECISION_COPY = {
  3: {
    approve: '确认缺陷',
    copy: '确认诊断结论后生成缺陷单，也可以挂起或下发无人机复检。',
  },
  5: {
    approve: '批准工单生成',
    reject: '退回补充诊断',
    copy: '确认根因、处置措施和验收标准后，批准生成现场工单。',
  },
  7: {
    approve: '批准排程',
    reject: '返回调整',
    copy: '检查人员、资源和作业窗口无冲突后，批准本次排程。',
  },
  8: {
    approve: '提交两票申请',
    reject: '返回排程',
    copy: '现场工程师确认安全措施和操作步骤后，提交工作票与操作票申请。',
  },
  9: {
    approve: '批准两票',
    reject: '返回修改',
    copy: '核验 AI 两票预审结果与安全措施，批准现场执行。',
  },
  12: {
    approve: '批准关闭',
    reject: '返回返工',
    copy: '确认复测数据、现场证据和验收标准均满足后关闭工单。',
  },
}

function isInactiveStatus(status) {
  const value = String(status ?? '')
  return ['completed', 'suspended', '已完成', '已挂起'].some((item) => value === item)
}

export function ApprovalPanel({
  ticket,
  step,
  busy = '',
  disabled = false,
  canProcess = true,
  className = '',
  onApprove,
  onReject,
  onSuspend,
  onDrone,
}) {
  const stepIndex = Number(step?.index ?? ticket?.currentStep ?? 1)
  const isApprovalStep = APPROVAL_STEPS.has(stepIndex)
  const inactive = disabled || !canProcess || isInactiveStatus(ticket?.status) || Boolean(busy)
  const dronePending = Boolean(ticket?.droneRequested)
  const copy = DECISION_COPY[stepIndex] ?? {}

  // Space-gated and automatic nodes keep their existing progression logic in
  // TicketPage, but do not expose a prompt or a duplicate task panel in the
  // customer-facing demo.
  if (!isApprovalStep) return null

  return (
    <aside className={`approval-panel${className ? ` ${className}` : ''}`} aria-label="当前节点处置">
      <div className="approval-panel__decision">
        <div className="approval-panel__decision-heading">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>处置分支</span>
        </div>
        <p className="approval-panel__decision-copy">
          {copy.copy ?? '基于当前诊断结论和已归档证据，确认本节点的处理方式。'}
        </p>
        <div className="approval-panel__actions">
          <button
            className="approval-panel__action approval-panel__action--approve"
            type="button"
            disabled={inactive}
            onClick={onApprove}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            {busy === 'approve' ? '处理中' : copy.approve ?? '确认并继续'}
          </button>

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

          {stepIndex === 3 && (
            <>
              <button
                className="approval-panel__action approval-panel__action--drone"
                type="button"
                disabled={inactive || dronePending}
                onClick={onDrone}
              >
                <Plane size={16} aria-hidden="true" />
                {busy === 'drone' ? '调度中' : dronePending ? '复检已下发' : '无人机复检'}
              </button>
              <button
                className="approval-panel__action approval-panel__action--suspend"
                type="button"
                disabled={inactive}
                onClick={onSuspend}
              >
                <Pause size={16} aria-hidden="true" />
                {busy === 'suspend' ? '处理中' : '挂起工单'}
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default ApprovalPanel
