import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Robot as Bot,
  CheckCircle as CheckCircle2,
  CaretRight as ChevronRight,
  MapPin,
  TrendDown as TrendingDown,
  TrendUp as TrendingUp,
  Lightning as Zap,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { stations } from '../data/demoData'

const pairedSections = ['station-health', 'problem-map']

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

/**
 * 2026 Q3 智能巡检报告主体：/inspection 页面与巡检任务「报告」步骤共用，
 * 模块展开、风险指派、计划批准等交互全部保留
 */
export default function ReportContent({ sections }) {
  const navigate = useNavigate()
  const app = useApp()
  const [expandedKey, setExpandedKey] = useState(null)

  const toggleExpand = (key) => {
    setExpandedKey((current) => (current === key ? null : key))
  }

  return (
    <section className="report-content report-content--stacked">
      {sections.map((section) => {
        const problemMax = section.id === 'problem-map'
          ? Math.max(...section.items.map((it) => Number(it.count) || 0))
          : 0
        return (
          <article className={`report-module${pairedSections.includes(section.id) ? ' report-module--half' : ''}`} key={section.id}>
            <div className="report-section-heading">
              <h2>{section.title}</h2>
              <span className="status-badge success">分析完成</span>
            </div>

            <div className="insight-banner">
              <Bot size={19} />
              <div>
                <span>AI 洞察</span>
                <p>{section.summary}</p>
              </div>
            </div>

            {!!section.metrics?.length && (
              <div className="metric-grid">
                {section.metrics.map((metric) => {
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

            {!!section.items?.length && (
              <div className="report-list">
                {section.items.map((item, index) => {
                  const station = getStation(item.stationId)
                  const tone = sectionTone[item.tone ?? item.severity ?? item.level ?? item.status ?? item.risk] ?? 'info'
                  const rowKey = item.id ?? `${section.id}-${index}`
                  const hasAction = section.id === 'priority-risks' || section.id === 'next-quarter'
                  const expandable = section.id === 'station-health' || section.id === 'problem-map'
                  const riskExpandable = section.id === 'priority-risks' && Boolean(item.diagnosis)
                  const isOpen = (expandable || riskExpandable) && expandedKey === rowKey
                  const riskAssigned = section.id === 'priority-risks' && item.action
                    ? app.reportRiskAssignments?.[item.id]
                    : null
                  const planApproved = section.id === 'next-quarter'
                    ? app.reportPlanApprovals?.[item.id]
                    : null
                  const problemPct = problemMax ? Math.round((Number(item.count) || 0) / problemMax * 100) : 0
                  const trendUp = !String(item.trend ?? '').includes('-')
                  const TrendIcon = trendUp ? TrendingUp : TrendingDown
                  return (
                    <div className="report-list-item" key={rowKey}>
                      {hasAction ? (
                        <div className="report-list-row report-list-row--action">
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
                          {section.id === 'priority-risks' && item.action && (
                            <button
                              className={`approval-panel__action approval-panel__action--approve report-row-action${riskAssigned ? ' is-signed' : ''}`}
                              type="button"
                              onClick={() => {
                                const result = app.assignRiskAction?.(item)
                                const ticketId = result?.ticketId ?? result?.id
                                if (!ticketId) return
                                // 巡检任务走四步流程详情页，缺陷单走工单详情页
                                navigate(result?.flowType === 'inspection' ? `/inspection-task/${ticketId}` : `/ticket/${ticketId}`)
                              }}
                            >
                              <Zap size={14} />
                              {riskAssigned ? '已分配 · 查看任务' : item.action.label}
                            </button>
                          )}
                          {section.id === 'next-quarter' && (
                            <button
                              className={`approval-panel__action approval-panel__action--approve report-row-action${planApproved ? ' is-signed' : ''}`}
                              type="button"
                              onClick={() => app.approvePlanItem?.(item.id)}
                              disabled={Boolean(planApproved)}
                            >
                              <CheckCircle2 size={14} />
                              {planApproved ? '已批准' : '批准'}
                            </button>
                          )}
                          {riskExpandable && (
                            <button
                              className={`report-row-toggle${isOpen ? ' is-open' : ''}`}
                              type="button"
                              onClick={() => toggleExpand(rowKey)}
                              aria-expanded={isOpen}
                              aria-label="展开风险详情"
                              title="展开风险详情"
                            >
                              <ChevronRight className="row-caret" size={17} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`report-list-row${isOpen ? ' is-open' : ''}`}
                          onClick={() => toggleExpand(rowKey)}
                          aria-expanded={isOpen}
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
                          <ChevronRight className="row-caret" size={17} />
                        </button>
                      )}

                      {isOpen && section.id === 'priority-risks' && item.diagnosis && (
                        <div className="report-row-expand">
                          <div className="metric-grid">
                            {item.diagnosis.metrics.map((metric) => {
                              const mTone = sectionTone[metric.tone] ?? metric.tone ?? ''
                              const MTrendIcon = String(metric.note ?? '').includes('-') ? TrendingDown : TrendingUp
                              return (
                                <article className={`metric-card ${mTone}`} key={metric.label}>
                                  <span>{metric.label}</span>
                                  <p><strong>{metric.value}</strong><small>{metric.unit}</small></p>
                                  {metric.note && <em><MTrendIcon size={12} />{metric.note}</em>}
                                </article>
                              )
                            })}
                          </div>
                          <div className="diagnosis-grid">
                            <div className="diagnosis-card">
                              <h4>异常数据</h4>
                              <dl className="key-value-list">
                                {item.diagnosis.data.map(([key, value]) => (
                                  <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                                ))}
                              </dl>
                            </div>
                            <div className="diagnosis-card">
                              <h4>证据已关联</h4>
                              <ul className="evidence-list">
                                {item.diagnosis.evidence.map((ev) => (
                                  <li key={ev.label}>
                                    <span className="evidence-source">{ev.source}</span>
                                    <span className="evidence-label">{ev.label}</span>
                                    <span className="evidence-value">{ev.value}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {isOpen && section.id === 'station-health' && (
                        <div className="report-row-expand">
                          <div className="health-gauge">
                            <div className="health-gauge__head">
                              <span>综合健康度</span>
                              <strong>{item.health}<small> / 100</small></strong>
                            </div>
                            <div className="health-gauge__track">
                              <div className={`health-gauge__fill ${tone}`} style={{ width: `${item.health}%` }} />
                            </div>
                          </div>
                          <div className="detail-metrics">
                            <div><span>环比变化</span><strong>{item.change} 分</strong></div>
                            <div><span>待办问题</span><strong>{item.issues} 项</strong></div>
                            <div><span>综合状态</span><strong>{item.status}</strong></div>
                          </div>
                          <button className="button-secondary" type="button" onClick={() => navigate(`/station/${item.stationId}`)}>
                            <MapPin size={15} />进入电站详情
                          </button>
                        </div>
                      )}

                      {isOpen && section.id === 'problem-map' && (
                        <div className="report-row-expand">
                          <div className="detail-metrics">
                            <div><span>发生次数</span><strong>{item.count} 次</strong></div>
                            <div><span>风险等级</span><strong className={`detail-tag ${tone}`}>{item.risk}</strong></div>
                            <div><span>发生频率</span><strong>{item.frequency}</strong></div>
                            <div><span>季度趋势</span><strong className={trendUp ? 'is-up' : 'is-down'}><TrendIcon size={13} />{item.trend}</strong></div>
                          </div>
                          <div className="problem-chart">
                            <div className="problem-chart__head">
                              <span>发生次数占本季峰值</span>
                              <em>{problemPct}%</em>
                            </div>
                            <div className="problem-chart__track">
                              <div className={`problem-chart__fill ${tone}`} style={{ width: `${problemPct}%` }} />
                            </div>
                            <div className="problem-chart__foot">
                              <span>本季峰值 {problemMax} 次</span>
                              <span>本项 {item.count} 次</span>
                            </div>
                          </div>
                          <div className="detail-scope">
                            {!!item.stations?.length && (
                              <div><span>涉及电站</span><div className="tag-row">{item.stations.map((s) => <em key={s}>{s}</em>)}</div></div>
                            )}
                            {!!item.devices?.length && (
                              <div><span>涉及设备</span><div className="tag-row">{item.devices.map((d) => <em key={d}>{d}</em>)}</div></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
