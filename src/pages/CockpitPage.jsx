import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ActivityIcon as Activity,
  ArrowDownRight,
  ArrowUpRight,
  BatteryCharging,
  Books,
  Brain,
  CalendarDots,
  WarningCircle as CircleAlert,
  Gauge,
  Pulse,
  CellTower as RadioTower,
  TestTube,
  TreeStructure,
  Wrench,
  Lightning as Zap,
} from '@phosphor-icons/react'
import DigitalTwin from '../components/DigitalTwin'
import { agents, cockpitKpis, flowSteps, stations } from '../data/demoData'
import { useApp } from '../context/AppContext'

const kpiIcons = [RadioTower, Zap, Activity, Gauge, BatteryCharging, Gauge, CircleAlert]

const agentIcons = {
  orchestrator: TreeStructure,
  perception: Pulse,
  diagnosis: Brain,
  dispatch: CalendarDots,
  execution: Wrench,
  validation: TestTube,
  knowledge: Books,
}

function KpiCard({ item, index }) {
  const Icon = kpiIcons[index % kpiIcons.length]
  const negative = item.trend?.startsWith('-')
  return (
    <article className={`kpi-card tone-${item.tone || 'neutral'}`}>
      <div className="kpi-label"><span>{item.label}</span><Icon size={15} /></div>
      <div className="kpi-value"><strong>{item.value}</strong><span>{item.unit}</span></div>
      <div className="kpi-foot">
        <span>{item.note || item.caption || '实时运行口径'}</span>
        {item.trend ? <em className={negative ? 'trend-negative' : 'trend-positive'}>{negative ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{item.trend}</em> : null}
      </div>
    </article>
  )
}

function TaskTimeline({ tickets }) {
  const navigate = useNavigate()
  const positions = [18, 34, 58]
  return (
    <section className="task-timeline" aria-label="当日任务时间轴">
      <div className="timeline-hours"><span>08:00</span><span>11:00</span><span>14:00</span><span>17:00</span><span>20:00</span><span>23:00</span></div>
      <div className="timeline-track"><span className="timeline-now" style={{ left: '47%' }}><i />14:32</span>
        {(tickets || []).slice(0, 3).map((ticket, index) => (
          <button className={`timeline-event severity-${ticket.severity}`} style={{ left: `${positions[index]}%` }} type="button" key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)}>
            <span /><div><strong>{ticket.title}</strong><small>{flowSteps[Number(ticket.currentStep) - 1]?.name || ticket.stepLabel || '异常复核'} · {ticket.updatedAt || '08:24'}</small></div>
          </button>
        ))}
      </div>
    </section>
  )
}

function AgentBand({ tickets }) {
  const activeCount = tickets?.length || 3
  return (
    <section className="agent-band" aria-label="Agent 运行状态">
      <svg className="agent-card-gradient-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <radialGradient id="agent-card-icon-gradient" cx="22%" cy="14%" r="118%" fx="22%" fy="14%">
            <stop offset="22%" stopColor="#0A59F7" />
            <stop offset="65%" stopColor="#BC87FF" />
            <stop offset="100%" stopColor="#FFB272" />
          </radialGradient>
        </defs>
      </svg>
      {(agents || []).slice(0, 7).map((agent, index) => {
        const AgentIcon = agentIcons[agent.id] ?? Activity
        return (
          <article className="agent-status-card" key={agent.id} style={{ '--agent-color': agent.color || '#5291ff' }}>
            <div className="agent-status-card__copy">
              <strong>{agent.name}</strong>
              <span className="agent-status-card__count"><b>{index === 0 ? 1 : activeCount}</b>项</span>
              <em>{index === 0 ? '协调中' : '运行中'}</em>
            </div>
            <div className="agent-status-card__icon" aria-hidden="true">
              <AgentIcon size={20} weight="regular" color="url(#agent-card-icon-gradient)" />
            </div>
          </article>
        )
      })}
    </section>
  )
}

export default function CockpitPage({ active = true }) {
  const { tickets } = useApp()
  const kpis = useMemo(() => cockpitKpis?.length ? [
    { label: '流域电站数', value: 4, unit: '座', caption: '全部在线' },
    ...cockpitKpis,
  ] : [
    { label: '流域电站数', value: 4, unit: '座' },
    { label: '总装机', value: '2,092', unit: 'MW' },
    { label: '当前出力', value: '386.4', unit: 'MW' },
    { label: '日发电量', value: '2,848', unit: 'MWh' },
    { label: '储能 SOC', value: '68.1', unit: '%', tone: 'storage' },
    { label: '设备健康度', value: '97.2', unit: '%' },
    { label: '活跃消缺单', value: 3, unit: '单', tone: 'urgent' },
  ], [])

  return (
    <div className="cockpit-page page-enter">
      <section className="kpi-grid">{kpis.slice(0, 7).map((item, index) => <KpiCard item={item} index={index} key={item.label} />)}</section>
      <DigitalTwin stations={stations} active={active} />
      <TaskTimeline tickets={tickets} />
      <AgentBand tickets={tickets} />
    </div>
  )
}
