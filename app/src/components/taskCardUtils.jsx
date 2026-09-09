import { User as UserRound } from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { inspectionFlow, stations } from '../data/demoData'

// 巡检任务走独立 4 步流程，其余任务走缺陷单流程
export function flowOf(ticket, defectFlow) {
  return ticket?.flowType === 'inspection' ? inspectionFlow : defectFlow
}

// 巡检任务详情页路由
export function ticketPath(ticket) {
  return ticket?.flowType === 'inspection' ? `/inspection-task/${ticket.id}` : `/ticket/${ticket.id}`
}

// 严重度归一化：紧急/预警/关注三档
export function severityKeyOf(ticket) {
  return ['urgent', 'critical', '严重'].includes(ticket?.severity)
    ? 'urgent'
    : ['warning', '高', '中'].includes(ticket?.severity)
      ? 'warning'
      : 'info'
}

export function TaskCard({ ticket, active, onClick }) {
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
