import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ActivityIcon as Activity,
  Warning as AlertTriangle,
  ArrowLeft,
  Robot as Bot,
  CheckCircle as CheckCircle2,
  CaretRight as ChevronRight,
  Gauge as CircleGauge,
  ClipboardText as ClipboardList,
  Clock as Clock3,
  Cpu,
  Gauge,
  ArrowCounterClockwise as RotateCcw,
  ShieldCheck,
  Sparkle as Sparkles,
  Thermometer,
  Wrench,
  Lightning as Zap,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { stations } from '../data/demoData'

const defaultParameters = [
  { label: '直流输入电压', value: '1,086', unit: 'V', state: '正常' },
  { label: '直流输入电流', value: '428.6', unit: 'A', state: '正常' },
  { label: '交流输出功率', value: '442.8', unit: 'kW', state: '正常' },
  { label: '转换效率', value: '98.31', unit: '%', state: '正常' },
  { label: '机内温度', value: '68.4', unit: '°C', state: '偏高' },
  { label: '绝缘阻抗', value: '0.46', unit: 'MΩ', state: '预警' },
]

const parameterLabels = {
  temperature: '设备温度',
  current: '直流输入电流',
  voltage: '直流输入电压',
  insulation: '绝缘阻抗',
  frequency: '电网频率',
  efficiency: '转换效率',
  soc: '荷电状态 SOC',
  soh: '健康状态 SOH',
  mismatch: '电流失配率',
  reverseEvents: '反灌事件',
  reverseCurrent: '反灌电流',
  share: '站内占比',
  leakage: '残余电流',
  alarms: '告警次数',
  vibration: '振动速度',
  rpm: '叶轮转速',
  wind: '实时风速',
  pr: '性能比 PR',
}

function isNormalStatus(status) {
  return ['normal', 'online', '正常', '在线'].includes(status)
}

function normalizeParameters(metrics) {
  if (Array.isArray(metrics)) return metrics
  if (!metrics || typeof metrics !== 'object') return defaultParameters
  return Object.entries(metrics).map(([key, value]) => ({
    label: parameterLabels[key] ?? key,
    value: typeof value === 'object' ? value.value : value,
    unit: typeof value === 'object' ? value.unit : '',
    state: typeof value === 'object' ? value.state : '正常',
  }))
}

function diagnosisProfile(device) {
  if (device.type.includes('组串') || device.issue.includes('热斑') || device.issue.includes('失配')) {
    return {
      risk: (device.health ?? 80) < 70 ? '高风险 · 建议尽快处置' : '中风险 · 建议维护',
      conclusion: '异常集中于组件与组串侧，温升、电流偏差和同方阵横向对比相互印证，已排除辐照短时波动影响。',
      evidence: ['峰值温度与同方阵基线偏差持续扩大', '组串电流低于同 MPPT 均值', '异常位置在连续复测中保持一致'],
      recommendation: '安排红外与 IV 曲线复核；确认热斑后更换对应组件并复测组串电流。',
    }
  }
  if (device.type.includes('逆变器') || device.type.includes('汇流')) {
    return {
      risk: '中风险 · 建议维护',
      conclusion: '设备运行偏差与温度或绝缘参数相关，暂未达到紧急停机阈值，需结合高负载和高湿时段复测。',
      evidence: ['运行参数较同型号设备基线发生偏移', '历史告警与环境条件存在相关性', '保护链路目前未出现持续性动作'],
      recommendation: '48 小时内完成设备清洁与接线检查，并在目标工况下复测关键参数。',
    }
  }
  return {
    risk: '中风险 · 建议维护',
    conclusion: '当前异常尚未影响设备连续运行，但趋势相对历史基线发生偏移，建议纳入最近维护窗口复核。',
    evidence: ['实时参数已完成一致性校验', '近 30 日告警完成关联分析', '同型号设备基线对比存在偏差'],
    recommendation: '按设备规程完成专项检查，并在作业后验证关键参数恢复情况。',
  }
}

export default function DevicePage() {
  const navigate = useNavigate()
  const { stationId, deviceId } = useParams()
  const app = useApp()
  const station = stations.find((item) => item.id === stationId) ?? stations[0]
  const device = station?.devices?.find((item) => item.id === deviceId) ?? station?.devices?.[0]
  const [range, setRange] = useState('24h')
  const [diagnosisState, setDiagnosisState] = useState('idle')
  const [taskCreated, setTaskCreated] = useState(false)
  const diagnosis = diagnosisProfile(device)

  const parameters = useMemo(() => normalizeParameters(device?.metrics), [device])
  const deviceAlerts = useMemo(() => {
    const stationAlerts = Array.isArray(station?.alerts) ? station.alerts : []
    const matched = stationAlerts.filter((alert) => !alert.deviceId || alert.deviceId === device?.id)
    if (matched.length) return matched
    if (!device?.issue) return []
    return [{ id: `${device.id}-issue`, severity: 'warning', title: device.issue, time: '今日 14:36', status: '未确认' }]
  }, [device, station])
  const relatedTickets = useMemo(() => {
    const matched = (app.tickets ?? []).filter((ticket) => {
      const active = !['done', 'closed', 'archived'].includes(ticket.status)
      return active && (ticket.deviceId === device?.id || ticket.stationId === station?.id)
    })
    if (matched.length) return matched.slice(0, 3)
    return [{
      id: 'WO-20260820-016',
      title: `${device?.name ?? '设备'}温升复核与风道清洁`,
      status: 'in_progress',
      currentStep: 8,
      assignee: '现场工程师 · 张伟',
      due: '08-21 18:00',
    }]
  }, [app.tickets, device, station])

  useEffect(() => {
    if (diagnosisState !== 'running') return undefined
    const timer = window.setTimeout(() => setDiagnosisState('done'), 1100)
    return () => window.clearTimeout(timer)
  }, [diagnosisState])

  if (!station || !device) return null

  const createDiagnosisTask = () => {
    setTaskCreated(true)
    app.showToast?.('诊断结论已加入处置任务')
  }

  return (
    <div className="ops-page device-page">
      <header className="page-toolbar device-toolbar">
        <button className="icon-button" type="button" onClick={() => navigate(`/station/${station.id}`)} title="返回场站">
          <ArrowLeft size={18} />
        </button>
        <div className="device-title-icon"><Cpu size={21} /></div>
        <div className="page-heading">
          <div className="title-line">
            <h1>{device.name}</h1>
            <span className={`status-badge ${isNormalStatus(device.status) ? 'success' : 'warning'}`}>
              <span className="status-dot" />{device.statusLabel ?? (isNormalStatus(device.status) ? '在线' : '需维护')}
            </span>
          </div>
          <p>{station.name} · {device.type} · SN {device.sn ?? 'YLJ-PV-24081016'} · {device.model}</p>
        </div>
        <button className="button-secondary" type="button" onClick={() => setDiagnosisState('running')} disabled={diagnosisState === 'running'}>
          <Sparkles size={15} />{diagnosisState === 'running' ? '诊断中…' : '发起智能诊断'}
        </button>
      </header>

      <main className="device-workspace">
        <section className="device-data-column">
          <div className="panel-heading">
            <div><p className="eyebrow">REAL-TIME DATA</p><h2>实时运行参数</h2></div>
            <span>更新于 16:48:32</span>
          </div>
          <div className="parameter-grid">
            {parameters.slice(0, 8).map((parameter, index) => {
              const warning = parameter.state && parameter.state !== '正常'
              const Icon = index % 3 === 0 ? Zap : index % 3 === 1 ? Thermometer : Gauge
              return (
                <article className={warning ? 'warning' : ''} key={parameter.id ?? parameter.label}>
                  <span className="parameter-icon"><Icon size={15} /></span>
                  <div><span>{parameter.label}</span><p><strong>{parameter.value}</strong><small>{parameter.unit}</small></p></div>
                  <em>{parameter.state ?? '正常'}</em>
                </article>
              )
            })}
          </div>

          <div className="trend-card">
            <div className="panel-heading">
              <div><p className="eyebrow">TEMPERATURE TREND</p><h2>温度与功率趋势</h2></div>
              <div className="segmented-control compact">
                {['24h', '7d', '30d'].map((item) => (
                  <button className={range === item ? 'is-selected' : ''} type="button" key={item} onClick={() => setRange(item)}>{item}</button>
                ))}
              </div>
            </div>
            <div className="chart-legend"><span className="power">输出功率 kW</span><span className="temperature">机内温度 °C</span></div>
            <svg className="device-trend-chart" viewBox="0 0 760 230" role="img" aria-label={`${range}温度与功率趋势图`}>
              {[42, 84, 126, 168].map((y) => <line key={y} x1="36" y1={y} x2="736" y2={y} className="chart-grid" />)}
              <line x1="36" y1="62" x2="736" y2="62" className="chart-threshold" />
              <text x="732" y="54" textAnchor="end" className="threshold-label">预警 75°C</text>
              <path d="M36 175 C92 170 116 143 164 149 S244 120 300 130 S385 92 432 100 S506 74 558 88 S652 118 736 95 L736 204 L36 204 Z" className="power-area" />
              <path d="M36 175 C92 170 116 143 164 149 S244 120 300 130 S385 92 432 100 S506 74 558 88 S652 118 736 95" className="power-line" />
              <path d="M36 144 C114 140 154 127 220 123 S352 105 418 95 S516 59 574 72 S672 90 736 75" className="temperature-line" />
              <circle cx="574" cy="72" r="4" className="warning-point" />
              <text x="574" y="58" textAnchor="middle" className="point-label">72.6°C</text>
              {['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'].map((label, index) => (
                <text key={label} x={36 + index * 116.6} y="224" textAnchor={index === 0 ? 'start' : index === 6 ? 'end' : 'middle'} className="axis-label">{label}</text>
              ))}
            </svg>
          </div>
        </section>

        <section className="device-events-column">
          <div className="event-panel alarm-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">ALARMS</p><h2>当前告警</h2></div>
              <span className={deviceAlerts.length ? 'warning-text' : ''}>{deviceAlerts.length}</span>
            </div>
            {deviceAlerts.length ? (
              <div className="device-alert-list">
                {deviceAlerts.map((alert) => (
                  <article key={alert.id}>
                    <span className={`alert-icon ${alert.severity ?? 'warning'}`}><AlertTriangle size={16} /></span>
                    <div><strong>{alert.title ?? alert.name}</strong><p>{alert.description ?? '参数持续越过预警阈值，建议结合历史趋势复核。'}</p><small>{alert.time ?? alert.occurredAt}</small></div>
                    <span className="status-badge warning">{alert.status ?? '待确认'}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state"><ShieldCheck size={22} /><p>当前无未处理告警</p></div>
            )}
          </div>

          <div className="event-panel work-order-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">OPEN WORK ORDERS</p><h2>在办工单</h2></div>
              <span>{relatedTickets.length}</span>
            </div>
            <div className="work-order-list">
              {relatedTickets.map((ticket) => (
                <button type="button" key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)}>
                  <span className="order-icon"><ClipboardList size={16} /></span>
                  <span className="order-main">
                    <strong>{ticket.title}</strong>
                    <small>{ticket.id} · {ticket.assignee ?? '待分派'}</small>
                    <span className="order-progress"><i style={{ width: `${Math.min(100, Math.round(((ticket.currentStep ?? 6) / 13) * 100))}%` }} /></span>
                  </span>
                  <span className="order-time"><Clock3 size={12} />{ticket.due ?? '处理中'}</span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className={`diagnosis-column ${diagnosisState}`}>
          <div className="diagnosis-heading">
            <span><Bot size={19} /></span>
            <div><p className="eyebrow">AI DIAGNOSTICS</p><h2>设备智能诊断</h2></div>
          </div>

          {diagnosisState === 'idle' && (
            <div className="diagnosis-idle">
              <CircleGauge size={42} />
              <h3>等待诊断</h3>
              <p>将读取设备实时数据、近 30 天告警与同型号设备基线。</p>
              <button className="button-primary" type="button" onClick={() => setDiagnosisState('running')}>
                <Sparkles size={15} />开始智能诊断
              </button>
            </div>
          )}

          {diagnosisState === 'running' && (
            <div className="diagnosis-running">
              <span className="diagnosis-spinner"><Activity size={28} /></span>
              <h3>正在分析设备状态</h3>
              <ul>
                <li className="done"><CheckCircle2 size={14} />实时遥测校验</li>
                <li className="done"><CheckCircle2 size={14} />历史告警关联</li>
                <li><RotateCcw size={14} />同型号设备对标</li>
              </ul>
            </div>
          )}

          {diagnosisState === 'done' && (
            <div className="diagnosis-result">
              <div className="risk-score">
                <span>健康评分</span><strong>{device.health ?? 78}</strong><small>/ 100</small>
              </div>
              <span className="status-badge warning"><AlertTriangle size={13} />{diagnosis.risk}</span>
              <section>
                <h3>诊断结论</h3>
                <p>{diagnosis.conclusion}</p>
              </section>
              <section>
                <h3>关键依据</h3>
                <ol>
                  {diagnosis.evidence.map((line, index) => <li key={line}><span>{String(index + 1).padStart(2, '0')}</span>{line}</li>)}
                </ol>
              </section>
              <section className="recommendation-block">
                <Wrench size={16} />
                <div><h3>建议动作</h3><p>{diagnosis.recommendation}</p></div>
              </section>
              <button className="button-primary" type="button" onClick={createDiagnosisTask} disabled={taskCreated}>
                <ClipboardList size={15} />{taskCreated ? '已加入处置任务' : '生成处置任务'}
              </button>
            </div>
          )}

          <div className="diagnosis-tools">
            <h3>诊断工具</h3>
            <button type="button" onClick={() => setDiagnosisState('running')}><Activity size={15} /><span>功率归一化分析</span><ChevronRight size={14} /></button>
            <button type="button" onClick={() => setDiagnosisState('running')}><CircleGauge size={15} /><span>离散率分析</span><ChevronRight size={14} /></button>
            <button type="button" onClick={() => setDiagnosisState('running')}><Zap size={15} /><span>智能 IV 诊断</span><ChevronRight size={14} /></button>
          </div>
        </aside>
      </main>
    </div>
  )
}
