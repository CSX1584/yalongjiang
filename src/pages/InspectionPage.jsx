import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ActivityIcon as Activity,
  ArrowLeft,
  Robot as Bot,
  CheckCircle as CheckCircle2,
  CaretRight as ChevronRight,
  ClipboardText as ClipboardCheck,
  Download,
  FileMagnifyingGlass as FileSearch,
  MapPin,
  ShieldWarning as ShieldAlert,
  Sparkle as Sparkles,
  TrendDown as TrendingDown,
  TrendUp as TrendingUp,
  X,
  Lightning as Zap,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import {
  reportActions as demoReportActions,
  reportSections as demoReportSections,
  stations,
} from '../data/demoData'

// Keep each report module's operation visible while sharing the task-flow rail.
const sectionIcons = [ClipboardCheck, MapPin, Activity, ShieldAlert, Sparkles, FileSearch]

const sectionTone = {
  good: 'success',
  normal: 'success',
  warning: 'warning',
  warn: 'warning',
  danger: 'danger',
  urgent: 'danger',
  严重: 'danger',
  高: 'warning',
  中: 'warning',
  正常: 'success',
  需关注: 'warning',
  info: 'info',
}

function getStation(stationId) {
  return stations.find((station) => station.id === stationId)
}

function valueOf(item, keys, fallback = '') {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) {
      return Array.isArray(item[key]) ? item[key].join('、') : item[key]
    }
  }
  return fallback
}

export default function InspectionPage() {
  const navigate = useNavigate()
  const app = useApp()
  const sections = app.reportSections?.length ? app.reportSections : demoReportSections
  const actions = app.reportActions?.length ? app.reportActions : demoReportActions
  const [activeId, setActiveId] = useState(sections[0]?.id)
  const [detail, setDetail] = useState(null)
  const [localStatuses, setLocalStatuses] = useState({})

  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeId))
  const activeSection = sections[activeIndex] ?? sections[0]
  const visibleActions = useMemo(() => {
    const ids = activeSection?.actionIds ?? []
    if (!ids.length) return actions
    return actions.filter((action) => ids.includes(action.id))
  }, [actions, activeSection])

  const exportReport = () => {
    const body = sections
      .map((section) => {
        const metrics = (section.metrics ?? [])
          .map((metric) => `${metric.label}：${metric.value}${metric.unit ?? ''}`)
          .join('\n')
        const items = (section.items ?? [])
          .map((item) => `- ${valueOf(item, ['title', 'name', 'label'])}：${valueOf(item, ['summary', 'description', 'insight', 'value'])}`)
          .join('\n')
        return `${section.index ?? ''} ${section.title}\n${section.summary ?? ''}\n${metrics}\n${items}`
      })
      .join('\n\n')
    const blob = new Blob([`AI 智能巡检运营报告 · 2026 Q3\n\n${body}`], {
      type: 'text/plain;charset=utf-8',
    })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = 'INS-RPT-2026Q3_AI智能巡检运营报告.txt'
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  const runAction = (action) => {
    const result = app.handleReportAction?.(action.id)
    setLocalStatuses((current) => ({ ...current, [action.id]: '已发起' }))
    app.showToast?.(`${action.label}已发起`)
    const ticketId = result?.id ?? result?.ticketId ?? action.ticketId
    if (ticketId) navigate(`/ticket/${ticketId}`)
  }

  const openItem = (item) => {
    const stationName = typeof item.station === 'string' ? item.station : item.stations?.[0]
    const stationId = item.stationId ?? item.station?.id ?? (stationName
      ? stations.find((station) => station.name.includes(stationName) || station.shortName?.includes(stationName))?.id
      : undefined)
    const deviceId = item.deviceId ?? item.device?.id
    if (stationId && deviceId) {
      navigate(`/station/${stationId}/device/${deviceId}`)
      return
    }
    if (stationId && item.health !== undefined) {
      navigate(`/station/${stationId}`)
      return
    }
    setDetail({ ...item, stationId })
  }

  if (!activeSection) return null

  const ActiveIcon = sectionIcons[activeIndex] ?? ClipboardCheck

  return (
    <div className="ops-page inspection-page">
      <header className="page-toolbar">
        <button
          className="ticket-page__back"
          type="button"
          onClick={() => navigate('/')}
          aria-label="返回驾驶舱"
          title="返回驾驶舱"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="page-heading">
          <div className="title-line">
            <h1>AI 智能巡检运营报告 · 2026 Q3</h1>
            <span className="status-badge success"><CheckCircle2 size={13} />季度巡检已完成</span>
          </div>
          <p>INS-RPT-2026Q3 · 2026-07-15 至 08-10 · 覆盖 4 座在运电站</p>
        </div>
        <button className="icon-button" type="button" onClick={exportReport} title="导出报告">
          <Download size={17} />
        </button>
      </header>

      <nav className="horizontal-flow report-flow" aria-label="巡检报告六个模块">
        {sections.map((section, index) => {
          const Icon = sectionIcons[index] ?? ClipboardCheck
          const selected = section.id === activeSection.id
          return (
            <button
              className={`flow-step ${selected ? 'is-active' : ''}`}
              type="button"
              key={section.id}
              onClick={() => setActiveId(section.id)}
              aria-current={selected ? 'step' : undefined}
            >
              {index > 0 && <span className="flow-connector" aria-hidden="true" />}
              <span className="flow-index"><Icon size={16} weight="regular" /></span>
              <span className="flow-copy">
                <strong>{section.title}</strong>
                <small>{section.subtitle}</small>
              </span>
            </button>
          )
        })}
      </nav>

      <main className="inspection-workspace">
        <section className="report-content">
          <div className="report-section-heading">
            <span className="section-icon"><ActiveIcon size={20} /></span>
            <div>
              <p className="eyebrow">MODULE {String(activeIndex + 1).padStart(2, '0')}</p>
              <h2>{activeSection.title}</h2>
            </div>
            <span className="status-badge success">分析完成</span>
          </div>

          <div className="insight-banner">
            <Bot size={19} />
            <div>
              <span>AI 洞察</span>
              <p>{activeSection.summary}</p>
            </div>
          </div>

          {!!activeSection.metrics?.length && (
            <div className="metric-grid">
              {activeSection.metrics.map((metric) => {
                const tone = sectionTone[metric.tone] ?? metric.tone ?? ''
                const TrendIcon = String(metric.trend ?? metric.note ?? '').includes('-') ? TrendingDown : TrendingUp
                return (
                  <article className={`metric-card ${tone}`} key={metric.id ?? metric.label}>
                    <span>{metric.label}</span>
                    <p><strong>{metric.value}</strong><small>{metric.unit}</small></p>
                    {metric.note && <em><TrendIcon size={12} />{metric.note}</em>}
                  </article>
                )
              })}
            </div>
          )}

          {!!activeSection.items?.length && (
            <div className="report-list">
              {activeSection.items.map((item, index) => {
                const station = getStation(item.stationId)
                const tone = sectionTone[item.tone ?? item.severity ?? item.level ?? item.status] ?? 'info'
                return (
                  <button
                    type="button"
                    className="report-list-row"
                    key={item.id ?? `${activeSection.id}-${index}`}
                    onClick={() => openItem(item)}
                  >
                    <span className={`severity-marker ${tone}`} aria-hidden="true" />
                    <span className="row-rank">{String(index + 1).padStart(2, '0')}</span>
                    <span className="row-main">
                      <strong>{valueOf(item, ['title', 'name', 'label', 'type'], `分析项 ${index + 1}`)}</strong>
                      <small>
                        {station?.name ?? valueOf(item, ['stationName', 'station', 'scope', 'category', 'stations'])}
                        {valueOf(item, ['deviceLabel', 'device', 'location', 'devices']) && ` · ${valueOf(item, ['deviceLabel', 'device', 'location', 'devices'])}`}
                      </small>
                      <p>{valueOf(item, ['summary', 'description', 'insight', 'reason', 'note', 'scope'])}</p>
                    </span>
                    <span className="row-value">
                      <strong>{valueOf(item, ['value', 'count', 'score', 'health'])}</strong>
                      <small>{valueOf(item, ['unit', 'tag', 'severity', 'status'])}</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                )
              })}
            </div>
          )}

          {activeIndex === 4 && (
            <div className="action-list">
              {visibleActions.map((action) => {
                const status = localStatuses[action.id] ?? action.status
                return (
                  <article className="action-row" key={action.id}>
                    <span className={`action-type ${action.type}`}><Zap size={15} /></span>
                    <div>
                      <strong>{action.label}</strong>
                      <p>{action.description}</p>
                    </div>
                    <button className="button-secondary" type="button" onClick={() => runAction(action)} disabled={status === 'done'}>
                      {status === 'done' ? '已完成' : status === '已发起' ? '打开任务' : '立即执行'}
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="report-aside">
          <div className="aside-block">
            <p className="eyebrow">REPORT SCOPE</p>
            <h3>本期巡检范围</h3>
            <dl className="compact-facts">
              <div><dt>覆盖电站</dt><dd>4 座</dd></div>
              <div><dt>巡检任务</dt><dd>126 项</dd></div>
              <div><dt>无人机</dt><dd>12 架次</dd></div>
              <div><dt>数据来源</dt><dd>SCADA + 红外</dd></div>
            </dl>
          </div>
          <div className="aside-block alert-summary">
            <ShieldAlert size={18} />
            <div>
              <h3>3 项需优先闭环</h3>
              <p>热斑、组串失配和残余电流异常已达到处置阈值。</p>
            </div>
          </div>
          <div className="aside-block next-step">
            <p className="eyebrow">NEXT</p>
            <h3>下季度计划</h3>
            <p>建议生成 126 项巡检任务，重点增加扎拉山红外复测与两河口绝缘专项。</p>
            <button className="button-primary" type="button" onClick={() => setActiveId(sections[5]?.id)}>
              查看计划 <ChevronRight size={15} />
            </button>
          </div>
        </aside>
      </main>

      {detail && (
        <div className="detail-drawer-backdrop" role="presentation" onMouseDown={() => setDetail(null)}>
          <aside className="detail-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button drawer-close" type="button" onClick={() => setDetail(null)} title="关闭">
              <X size={18} />
            </button>
            <p className="eyebrow">INSIGHT DETAIL</p>
            <h2>{valueOf(detail, ['title', 'name', 'label'])}</h2>
            <span className={`status-badge ${sectionTone[detail.tone ?? detail.severity ?? detail.level] ?? 'warning'}`}>
              <ShieldAlert size={13} />{detail.severity ?? detail.level ?? detail.tag ?? '需关注'}
            </span>
            <section>
              <h3>分析结论</h3>
              <p>{valueOf(detail, ['insight', 'summary', 'description', 'reason', 'note'])}</p>
            </section>
            {detail.evidence?.length > 0 && (
              <section>
                <h3>数据证据</h3>
                <ul>{detail.evidence.map((line) => <li key={line}>{line}</li>)}</ul>
              </section>
            )}
            <section>
              <h3>处置建议</h3>
              <p>{detail.suggestion ?? detail.recommendation ?? '纳入当前巡检闭环，结合现场复核结果制定处置计划。'}</p>
            </section>
            {detail.stationId && (
              <button className="button-primary" type="button" onClick={() => navigate(`/station/${detail.stationId}`)}>
                <MapPin size={15} />定位场站
              </button>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
