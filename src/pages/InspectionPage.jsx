import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle as CheckCircle2,
  Download,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { reportSections as demoReportSections } from '../data/demoData'
import ReportContent from '../components/ReportContent'
import { ToggleButton, ToggleButtonGroup } from '@heroui/react'

// 巡检报告列表：可按名称/编号搜索、按生成时间段筛选，勾选后走批量分析
// 导出给对话指令：发送报告名称时命中对应报告出分析结果
export const INSPECTION_REPORTS = [
  { id: 'INS-RPT-2026Q3', title: '2026 Q3 智能巡检运营报告', period: '2026-07-15 至 08-10', stations: 4, issues: 47, closedRate: '87.2%', generatedAt: '2026-08-12', status: '已完成' },
  { id: 'INS-RPT-2026Q2', title: '2026 Q2 智能巡检运营报告', period: '2026-04-01 至 05-15', stations: 4, issues: 39, closedRate: '92.5%', generatedAt: '2026-05-18', status: '已归档' },
  { id: 'INS-RPT-2026Q1', title: '2026 Q1 智能巡检运营报告', period: '2026-01-05 至 02-20', stations: 3, issues: 28, closedRate: '95.1%', generatedAt: '2026-03-02', status: '已归档' },
  { id: 'INS-RPT-2025Q4', title: '2025 Q4 智能巡检运营报告', period: '2025-10-10 至 11-25', stations: 3, issues: 22, closedRate: '96.8%', generatedAt: '2025-11-28', status: '已归档' },
]

// 时间段选择器档位（按生成日期往回推的天数）
const REPORT_RANGE_DAYS = { '3m': 93, '6m': 186, '1y': 372 }
const REPORT_RANGES = [
  { id: 'all', label: '全部' },
  { id: '3m', label: '近 3 个月' },
  { id: '6m', label: '近 6 个月' },
  { id: '1y', label: '近 1 年' },
]

export default function InspectionPage() {
  const navigate = useNavigate()
  const app = useApp()
  const { checkedReports, toggleReportChecked, inspectionAnalysis, inspectionStage, seedSidebarDraft } = app
  const sections = app.reportSections?.length ? app.reportSections : demoReportSections
  // 两段式：list 勾选报告批量分析，点击待办卡片后才显示报告内容
  const showReport = inspectionStage === 'report'
  // 报告列表：搜索关键字与时间段筛选
  const [keyword, setKeyword] = useState('')
  const [range, setRange] = useState('all')

  // 搜索 + 时间段双重过滤
  const visibleReports = INSPECTION_REPORTS.filter((report) => {
    const text = keyword.trim()
    if (text && !`${report.title} ${report.id}`.includes(text)) return false
    if (range !== 'all') {
      const cutoff = Date.now() - REPORT_RANGE_DAYS[range] * 86400000
      if (new Date(report.generatedAt).getTime() < cutoff) return false
    }
    return true
  })

  const exportReport = () => {
    const body = sections
      .map((section) => {
        const metrics = (section.metrics ?? [])
          .map((metric) => `${metric.label}：${metric.value}${metric.unit ?? ''}`)
          .join('\n')
        const items = (section.items ?? [])
          .map((item) => `- ${item.title ?? item.name ?? item.label ?? ''}：${item.summary ?? item.description ?? item.insight ?? item.value ?? ''}`)
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

  if (!sections.length) return null

  return (
    <div className="ops-page inspection-page is-qa-collapsed">
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
            <h1>{showReport ? 'AI 智能巡检运营报告 · 2026 Q3' : '巡检报告列表'}</h1>
            {showReport && <span className="status-badge success"><CheckCircle2 size={13} />季度巡检已完成</span>}
          </div>
          <p>{showReport ? 'INS-RPT-2026Q3 · 2026-07-15 至 08-10 · 覆盖 4 座在运电站' : '勾选报告并发送报告名称，点击对话中的「开始巡检」卡片进行批量分析'}</p>
        </div>
        <button className="icon-button" type="button" onClick={exportReport} title="导出报告">
          <Download size={17} />
        </button>
      </header>

      <main className="inspection-workspace">
        {!showReport && (
          <>
            <section className="inspection-report-pick" aria-label="巡检报告选择">
              <div className="inspection-report-pick__toolbar">
                <label className="inspection-report-search">
                  <MagnifyingGlass size={15} />
                  <input
                    type="search"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="搜索报告名称 / 编号"
                    aria-label="搜索报告名称或编号"
                  />
                </label>
                <ToggleButtonGroup
                  className="segmented-control ops-heroui-toggle-group"
                  aria-label="生成时间段筛选"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([range])}
                  onSelectionChange={(keys) => {
                    const next = String([...keys][0] ?? '')
                    if (next) setRange(next)
                  }}
                >
                  {REPORT_RANGES.map((item) => (
                    <ToggleButton
                      className={range === item.id ? 'is-selected ops-heroui-toggle' : 'ops-heroui-toggle'}
                      id={item.id}
                      key={item.id}
                    >
                      {item.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </div>

              <div className="inspection-report-pick__list">
                {visibleReports.map((report) => (
                  <label
                    className={`inspection-report-card${checkedReports.includes(report.id) ? ' is-checked' : ''}`}
                    key={report.id}
                  >
                    <input
                      type="checkbox"
                      checked={checkedReports.includes(report.id)}
                      onChange={() => {
                        toggleReportChecked(report.id)
                        // 勾选时把报告名称填入侧栏输入框，取消勾选不动输入框
                        if (!checkedReports.includes(report.id)) seedSidebarDraft?.(report.title)
                      }}
                    />
                    <span className="inspection-report-card__body">
                      <span className="inspection-report-card__title">
                        <strong>{report.title}</strong>
                        <span className={`status-badge${report.status === '已完成' ? ' success' : ''}`}>{report.status}</span>
                      </span>
                      <small>{report.id} · 巡检周期 {report.period} · 生成于 {report.generatedAt}</small>
                    </span>
                    <span className="inspection-report-card__stats">
                      <span><strong>{report.stations}</strong><small>覆盖电站(座)</small></span>
                      <span><strong>{report.issues}</strong><small>发现异常(项)</small></span>
                      <span><strong>{report.closedRate}</strong><small>闭环率</small></span>
                    </span>
                  </label>
                ))}
                {!visibleReports.length && (
                  <div className="inspection-report-empty">没有符合条件的巡检报告，调整搜索或时间段试试</div>
                )}
              </div>
            </section>

            {inspectionAnalysis === 'running' && (
              <div className="inspection-analysis-banner" role="status">
                AI 正在批量分析勾选的 {checkedReports.length} 份巡检报告，请稍候…
              </div>
            )}
            {inspectionAnalysis === 'done' && (
              <div className="inspection-analysis-banner" role="status">
                报告分析完成，「巡检报告分析」卡片已推送到任务中心待办，点击卡片查看报告。
              </div>
            )}
          </>
        )}

        {showReport && <ReportContent sections={sections} />}
      </main>
    </div>
  )
}
