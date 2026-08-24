import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ActivityIcon as Activity,
  Warning as AlertTriangle,
  Brain as BrainCircuit,
  CalendarDots as CalendarClock,
  Check,
  CheckCircle as CheckCircle2,
  ClipboardText as ClipboardCheck,
  Clock as Clock3,
  DownloadSimple,
  FileText as FileCheck2,
  FilePdf,
  FileText,
  Gauge,
  GitBranch,
  MapPin,
  MapPinLine as MapPinned,
  ShieldCheck,
  Sparkle as Sparkles,
  User as UserRound,
  Users,
  Wrench,
  X,
  Lightning as Zap,
} from '@phosphor-icons/react'

const DEFAULT_IDS = {
  ticket: 'WO-20260813-012',
  event: 'EVT-20260812-0092',
  defect: 'QXD-20260813-012',
  workOrder: 'GD-20260813-017',
  workPermit: 'GZP-20260813-031',
  operationPermit: 'CZP-20260813-045',
  operationPermitBase: 'CZP-20260813-045',
  case: 'CA-2026-0147',
}

const STEP_META = {
  1: { eyebrow: '异常感知 · 数据汇聚', title: '异常数据已捕获', copy: '感知 Agent 已完成 SCADA、无人机红外和 IV 曲线的同步采集。', mode: 'Agent 自动完成' },
  2: { eyebrow: '异常感知 · AI 诊断', title: 'AI 根因诊断完成', copy: '多源证据已对齐，诊断置信度达到人工复核阈值。', mode: 'Agent 自动完成' },
  3: { eyebrow: '异常感知 · 人工复核', title: '异常复核', copy: '请技术负责人核对趋势、证据和处置代价，再决定是否生成缺陷单。', mode: '人工确认' },
  4: { eyebrow: '缺陷生成 · 结构化记录', title: '缺陷单生成', copy: '诊断结果正在转换为可追踪的缺陷记录。', mode: 'Agent 生成' },
  5: { eyebrow: '缺陷生成 · 工单决策', title: '工单生成', copy: '技术负责人确认根因、措施和验收标准后，生成现场工单。', mode: '人工审批' },
  6: { eyebrow: '派单执行 · 智能排程', title: '工单排程', copy: '派单 Agent 正在根据班组、资源和低功率窗口生成候选排程。', mode: 'Agent 生成' },
  7: { eyebrow: '派单执行 · 排程决策', title: '排程批准', copy: '运维负责人确认人员、资源和作业窗口无冲突后批准执行。', mode: '人工审批' },
  8: { eyebrow: '派单执行 · 安全票证', title: '工作票与操作票申请', copy: '现场工程师提交工作票及 3 张操作票，进入 AI 预审。', mode: '人工提交' },
  9: { eyebrow: '派单执行 · 票证预审', title: '工作票与操作票批准', copy: '运维负责人查看 AI 两票预审问题并批准或退回修改。', mode: '人工审批' },
  10: { eyebrow: '派单执行 · 现场作业', title: '现场执行', copy: '执行 Agent 正在汇总导航、到场、隔离、挂牌、更换与复电回执。', mode: 'Agent 执行' },
  11: { eyebrow: '缺陷闭环 · 复测验证', title: '复测验证', copy: '验证 Agent 正在对比处置前后电流、离散率和红外温差。', mode: 'Agent 验证' },
  12: { eyebrow: '缺陷闭环 · 关单决策', title: '关闭工单批准', copy: '运维负责人核对通知、证据汇总和验收标准后批准关单。', mode: '人工审批' },
  13: { eyebrow: '缺陷闭环 · 知识沉淀', title: 'AI 复盘沉淀', copy: '知识 Agent 将本次消缺过程整理为可复用案例，完成闭环。', mode: 'Agent 自动完成' },
}

// Agent-owned nodes reveal their details after a short, deterministic progress
// pass. Manual approval nodes stay immediately readable so the real decision
// interaction remains unchanged.
const GENERATION_META = {
  1: { duration: 1250, agent: '感知Agent', time: '08:42', icon: Activity, label: '正在汇聚证据', detail: 'SCADA、无人机红外与 IV 数据同步中' },
  2: { duration: 1400, agent: '诊断Agent', time: '08:43', icon: BrainCircuit, label: '正在对齐根因', detail: '趋势、基线与历史案例交叉验证中' },
  4: { duration: 1100, agent: '缺陷Agent', time: '08:47', icon: FileCheck2, label: '正在生成缺陷记录', detail: '关联事件、设备与验收约束整理中' },
  6: { duration: 1350, agent: '派单Agent', time: '08:52', icon: CalendarClock, label: '正在生成候选排程', detail: '班组、资源与低功率窗口校验中' },
  10: { duration: 1800, agent: '执行Agent', time: '14:58', icon: Wrench, label: '正在汇总现场回执', detail: '导航、隔离、换件与复电记录同步中' },
  11: { duration: 1350, agent: '验证Agent', time: '15:14', icon: ShieldCheck, label: '正在计算复测结果', detail: '电流、离散率与红外温差对比中' },
  13: { duration: 1600, agent: '知识Agent', time: '15:21', icon: Sparkles, label: '正在沉淀复盘案例', detail: '过程证据、结果与可复用策略整理中' },
}

function useStageGeneration(index, ticketId, isActiveGeneration) {
  const generation = GENERATION_META[index]
  const stageKey = `${ticketId ?? 'ticket'}:${index}`
  const [state, setState] = useState(() => ({
    key: stageKey,
    progress: generation && isActiveGeneration ? 0 : 100,
    ready: !generation || !isActiveGeneration,
  }))

  useEffect(() => {
    if (!generation || !isActiveGeneration) {
      setState({ key: stageKey, progress: 100, ready: true })
      return undefined
    }

    let active = true
    const startedAt = Date.now()
    const tickMs = 80
    setState({ key: stageKey, progress: 0, ready: false })

    const timer = setInterval(() => {
      if (!active) return
      const next = Math.min(100, Math.round(((Date.now() - startedAt) / generation.duration) * 100))
      if (next >= 100) {
        clearInterval(timer)
        setState({ key: stageKey, progress: 100, ready: true })
      } else {
        setState({ key: stageKey, progress: next, ready: false })
      }
    }, tickMs)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [generation, isActiveGeneration, stageKey])

  const stale = state.key !== stageKey
  return {
    ...generation,
    isGenerated: Boolean(generation),
    progress: stale ? 0 : state.progress,
    ready: !generation || !isActiveGeneration || (!stale && state.ready),
  }
}

function stepNumber(step) {
  if (typeof step === 'object' && step !== null) return Number(step.index ?? step.step ?? 1) || 1
  return Number(step) || 1
}

function idsFor(ticket) {
  return { ...DEFAULT_IDS, ...(ticket?.workflowIds ?? {}) }
}

function StageHeader({ index, isGenerated = false }) {
  const meta = STEP_META[index] ?? STEP_META[1]
  return (
    <header className="ticket-stage-content__header">
      <div>
        <span className="ticket-stage-content__eyebrow">STEP {String(index).padStart(2, '0')} / {meta.eyebrow}</span>
        <h3>{meta.title}</h3>
        <p>{meta.copy}</p>
      </div>
      <span className={`ticket-stage-content__mode${isGenerated ? ' is-generated' : ''}`}>
        {index === 13 && <CheckCircle2 size={13} aria-hidden="true" />}
        {meta.mode}
      </span>
    </header>
  )
}

function StageAgentIdentity({ agent, time, icon: Icon = Sparkles, typing = false }) {
  return (
    <div className={`ticket-stage-agent${typing ? ' is-typing' : ' is-reply'}`}>
      <span className="ticket-stage-agent__avatar" aria-hidden="true"><Icon size={18} /></span>
      <div className="ticket-stage-agent__content">
        <div className="ticket-stage-agent__meta">
          <strong>{agent}</strong><span>//</span><time>{time}</time>
        </div>
        {typing ? (
          <div className="ticket-stage-agent__typing" aria-label={`${agent} 正在输入`}>
            <i /><i /><i />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StageGeneration({ agent, time, icon, label, detail, progress }) {
  return (
    <div className="ticket-stage-generation" role="status" aria-live="polite" aria-busy="true">
      <StageAgentIdentity agent={agent} time={time} icon={icon} typing />
      <div className="ticket-stage-generation__heading">
        <div>
          <span>AI 正在生成回复</span>
          <strong>{label}</strong>
        </div>
        <b className="ticket-stage-data">{progress}%</b>
      </div>
      <div className="ticket-stage-generation__track" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>
      <p>{detail}</p>
    </div>
  )
}

function MetricGrid({ items }) {
  const count = Math.min(Math.max(items.length, 1), 4)
  return (
    <div className={`ticket-stage-metrics ticket-stage-metrics--${count}`}>
      {items.map((item) => (
        <article className={`ticket-stage-metric${item.tone ? ` is-${item.tone}` : ''}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}{item.unit && <small>{item.unit}</small>}</strong>
          {item.note && <em>{item.note}</em>}
        </article>
      ))}
    </div>
  )
}

function StageCard({ title, eyebrow, icon: Icon = Activity, className = '', children }) {
  return (
    <article className={`ticket-stage-card${className ? ` ${className}` : ''}`}>
      <div className="ticket-stage-card__heading">
        <div>
          {eyebrow && <span>{eyebrow}</span>}
          <h4>{title}</h4>
        </div>
        <Icon size={16} aria-hidden="true" />
      </div>
      {children}
    </article>
  )
}

function KeyValueList({ items }) {
  return (
    <dl className="ticket-stage-kv">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Tag({ children, tone = 'neutral' }) {
  return <span className={`ticket-stage-tag is-${tone}`}>{children}</span>
}

function EvidenceList({ items }) {
  return (
    <ul className="ticket-stage-evidence-list">
      {items.map((item) => (
        <li key={`${item.source}-${item.label}`}>
          <span className="ticket-stage-evidence-list__dot" aria-hidden="true" />
          <div><strong>{item.source}</strong><span>{item.label}</span></div>
          <b>{item.value}</b>
        </li>
      ))}
    </ul>
  )
}

function ConfidenceList() {
  const causes = [
    ['组件热斑', '91%', 91, 'warning'],
    ['旁路二极管故障', '6%', 6, 'muted'],
    ['MC4 接头不良', '3%', 3, 'muted'],
  ]
  return (
    <div className="ticket-stage-confidence">
      <div className="ticket-stage-confidence__threshold"><span>确诊阈值</span><b>90%</b></div>
      {causes.map(([label, value, percent, tone]) => (
        <div className="ticket-stage-confidence__row" key={label}>
          <span>{label}</span>
          <i><b className={`is-${tone}`} style={{ width: `${percent}%` }} /></i>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

function MiniTrend() {
  return (
    <div className="ticket-stage-trend" role="img" aria-label="72 小时离散率从 4.2% 上升至 23%">
      <svg viewBox="0 0 540 108" preserveAspectRatio="none" aria-hidden="true">
        <path className="ticket-stage-trend__grid" d="M0 22H540M0 54H540M0 86H540" />
        <path className="ticket-stage-trend__threshold" d="M0 68H540" />
        <path className="ticket-stage-trend__line" d="M0 92L90 86L180 76L270 64L360 48L450 27L540 14" />
        <circle cx="540" cy="14" r="4" />
      </svg>
      <div className="ticket-stage-trend__axis"><span>-72h</span><span>-48h</span><span>-24h</span><span>现在</span></div>
    </div>
  )
}

function Gantt() {
  const rows = [
    ['川西检修一组', '13:00–15:00', 'is-blue', 8, 68],
    ['无人机复测', '13:20–14:10', 'is-muted', 23, 38],
    ['运维负责人', '12:50–16:00', 'is-green', 3, 91],
  ]
  return (
    <div className="ticket-stage-gantt">
      <div className="ticket-stage-gantt__axis"><span>12:00</span><span>13:00</span><span>14:00</span><span>15:00</span><span>16:00</span></div>
      {rows.map(([name, range, tone, left, width]) => (
        <div className="ticket-stage-gantt__row" key={name}>
          <span>{name}</span>
          <i><b className={tone} style={{ left: `${left}%`, width: `${width}%` }} /></i>
          <small>{range}</small>
        </div>
      ))}
    </div>
  )
}

function CheckList({ items }) {
  return (
    <ul className="ticket-stage-checklist">
      {items.map((item, index) => {
        const value = typeof item === 'string' ? item : item.label
        const state = typeof item === 'string' ? 'done' : item.state ?? 'done'
        return (
          <li
            className={`is-${state}`}
            key={value}
            style={{ '--check-delay': `${index * 160}ms` }}
          >
            <span>{state === 'done' ? <Check size={14} /> : <Clock3 size={12} />}</span>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <strong>{value}</strong>
            {typeof item !== 'string' && item.note && <small>{item.note}</small>}
          </li>
        )
      })}
    </ul>
  )
}

function PermitTable({ operationPermit }) {
  const [preview, setPreview] = useState(null)
  const rows = [
    ['CZP-20260813-045-01', '直流侧停电与验电', '已填入'],
    ['CZP-20260813-045-02', '挂牌、接地与作业许可', '已填入'],
    ['CZP-20260813-045-03', '复电前检查与恢复', '待预审'],
  ]
  return (
    <>
      <div className="ticket-stage-table-wrap">
        <table className="ticket-stage-table">
          <thead><tr><th>操作票编号</th><th>任务</th><th>状态</th></tr></thead>
          <tbody>{rows.map(([id, task, status]) => (
            <tr key={id}>
              <td>
                <button className="ticket-stage-document-link" type="button" onClick={() => setPreview({ id, task })} aria-haspopup="dialog">
                  <FilePdf size={14} aria-hidden="true" />
                  <span className="ticket-stage-data">{operationPermit ? id : id}</span>
                </button>
              </td>
              <td>{task}</td>
              <td><Tag tone={status === '待预审' ? 'warning' : 'success'}>{status}</Tag></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {preview ? (
        <PdfPreview
          documentId={preview.id}
          eyebrow="安全票证 · PDF 文档"
          title={`${preview.task} · ${preview.id}`}
          downloadName={`${preview.id}-操作票.pdf`}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  )
}

function RouteCard() {
  return (
    <div className="ticket-stage-route">
      <div className="ticket-stage-route__map" aria-hidden="true">
        <span className="ticket-stage-route__road road-a" />
        <span className="ticket-stage-route__road road-b" />
        <span className="ticket-stage-route__road road-c" />
        <i className="ticket-stage-route__pin pin-start"><MapPin size={13} /></i>
        <i className="ticket-stage-route__pin pin-end"><MapPinned size={13} /></i>
      </div>
      <div className="ticket-stage-route__copy">
        <span>现场路线</span>
        <strong>成都驻地 <small>→</small> 柯拉一期光伏电站</strong>
        <div><b>412 km</b><b>4h50</b><span>建议 09:00 出发 · 13:50 到场</span></div>
      </div>
    </div>
  )
}

function ComparisonTable() {
  const rows = [
    ['组串电流', '6.1 A', '7.8 A', '+1.7 A'],
    ['离散率', '23%', '4.2%', '-18.8 pp'],
    ['红外最高温差', '38℃', '6℃', '-32℃'],
  ]
  return (
    <div className="ticket-stage-table-wrap">
      <table className="ticket-stage-table ticket-stage-table--comparison">
        <thead><tr><th>关键指标</th><th>处置前</th><th>处置后</th><th>变化</th></tr></thead>
        <tbody>{rows.map(([label, before, after, delta]) => <tr key={label}><th>{label}</th><td className="ticket-stage-data">{before}</td><td className="ticket-stage-data is-good">{after}</td><td className="ticket-stage-data is-good">{delta}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function StageOne({ ticket }) {
  return (
    <>
      <MetricGrid items={[
        { label: '组串电流', value: '6.1', unit: 'A', note: '同方阵均值 7.9 A', tone: 'warning' },
        { label: '电流偏差', value: '-23', unit: '%', note: '规则 R-017 触发', tone: 'danger' },
        { label: '红外最高温差', value: '38', unit: '℃', note: '验收标准 ≤8℃', tone: 'danger' },
        { label: '发现时间', value: '08:42', note: 'SCADA / 无人机同步', tone: 'normal' },
      ]} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="异常数据" eyebrow="实时测点" icon={Gauge}>
          <KeyValueList items={[
            ['设备', ticket?.deviceId ?? 'LHK-PV-03-07'],
            ['组串电压', '1,086 V · 正常'],
            ['辐照 / 环境', '824 W/m² · 晴 18℃'],
            ['采集窗口', '过去 24 h · 3 秒刷新'],
          ]} />
        </StageCard>
        <StageCard title="证据已关联" eyebrow="多源证据" icon={FileCheck2}>
          <EvidenceList items={[
            { source: 'SCADA', label: '趋势 24 h', value: '已归档' },
            { source: '无人机红外', label: '红外影像 4 张', value: '已归档' },
            { source: 'IV 扫描', label: '曲线与基线', value: '已归档' },
          ]} />
        </StageCard>
      </div>
    </>
  )
}

function StageTwo() {
  return (
    <>
      <MetricGrid items={[
        { label: '热斑置信度', value: '91', unit: '%', note: '超过确诊阈值 90%', tone: 'success' },
        { label: '候选原因', value: '3', unit: '项', note: '组件 / 二极管 / 接头' },
        { label: '交叉证据', value: '4', unit: '源', note: 'SCADA · 红外 · IV · 历史' },
      ]} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="候选原因与置信度" eyebrow="AI 诊断" icon={BrainCircuit}>
          <ConfidenceList />
          <p className="ticket-stage-note">组件热斑置信度已超过 90% 确诊阈值，建议进入技术负责人复核。</p>
        </StageCard>
        <StageCard title="诊断结论" eyebrow="可解释输出" icon={ShieldCheck} className="is-emphasis">
          <div className="ticket-stage-callout"><strong>第 7 组串接触电阻升高，已形成持续性热斑</strong><p>温差与电流偏差同时出现，气象和遮挡因素已排除。</p></div>
          <KeyValueList items={[
            ['建议措施', '复紧连接件，更换 3 块热斑组件'],
            ['复测要求', '更换后完成 IV 与红外复测'],
            ['关联事件', 'EVT-20260812-0092'],
          ]} />
        </StageCard>
      </div>
    </>
  )
}

function StageThree() {
  return (
    <>
      <StageCard title="趋势与关键数据" eyebrow="人工复核依据" icon={Activity}>
        <div className="ticket-stage-grid ticket-stage-grid--two ticket-stage-grid--flush">
          <MiniTrend />
          <KeyValueList items={[
            ['72 h 离散率', '4.2% → 23%'],
            ['温差趋势', '12℃ → 38℃'],
            ['同类设备基线', '离散率 ≤5%'],
            ['数据完整性', '98.7% · 无缺口'],
          ]} />
        </div>
      </StageCard>
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="代价与后果" eyebrow="处置优先级" icon={AlertTriangle}>
          <KeyValueList items={[
            ['当前发电偏差', '-23.4%'],
            ['预计经济损失', '¥ 3,260 / 日'],
            ['风险等级', 'II 级 / 重要'],
            ['未处置后果', '热斑可能扩大并引发停机与发电损失'],
          ]} />
        </StageCard>
        <StageCard title="审批意见" eyebrow="技术负责人" icon={UserRound}>
          <div className="ticket-stage-empty-field">等待人工输入复核意见</div>
          <div className="ticket-stage-suggestion"><Sparkles size={13} /><span>AI 建议：确认缺陷并在低功率窗口安排处理。</span></div>
        </StageCard>
      </div>
    </>
  )
}

function StageFour({ ids }) {
  return (
    <>
      <MetricGrid items={[
        { label: '缺陷单编号', value: ids.defect, note: '已生成 · 待工单审批' },
        { label: '缺陷等级', value: 'II', unit: '级', note: '重要缺陷', tone: 'warning' },
        { label: '诊断置信度', value: '91', unit: '%', note: '高置信诊断', tone: 'success' },
      ]} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="缺陷单摘要" eyebrow="结构化记录" icon={FileText}>
          <KeyValueList items={[
            ['关联事件', ids.event],
            ['设备', 'LHK-PV-03-07 · #3 方阵 7 号组串'],
            ['现象', '组件热斑，温差 38℃，电流偏差 -23%'],
            ['处置要求', '48 h 内完成组件更换与复测'],
          ]} />
        </StageCard>
        <StageCard title="置信度分布" eyebrow="诊断证据" icon={BrainCircuit}>
          <ConfidenceList />
          <div className="ticket-stage-inline-status"><CheckCircle2 size={14} /><span>满足缺陷单生成条件</span></div>
        </StageCard>
      </div>
    </>
  )
}

function StageFive({ ids }) {
  return (
    <>
      <MetricGrid items={[
        { label: '目标工单', value: ids.workOrder, note: '批准后进入排程' },
        { label: '流程任务编号', value: ids.ticket, note: '缺陷处置主任务' },
        { label: '风险等级', value: 'II', unit: '级', note: '重要缺陷', tone: 'warning' },
        { label: '预计停机', value: '18', unit: 'min', note: '影响出力 0.42 MW' },
      ]} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="根因结论" eyebrow="工单生成依据" icon={ShieldCheck} className="is-emphasis">
          <div className="ticket-stage-callout"><strong>组件热斑（接触电阻升高）</strong><p>需更换 3 块热斑组件，并复紧直流侧连接件。</p></div>
          <KeyValueList items={[
            ['处置班组', '川西检修一组'],
            ['作业窗口', '13:00–16:00 · 低功率时段'],
          ]} />
        </StageCard>
        <StageCard title="措施与验收标准" eyebrow="执行约束" icon={ClipboardCheck}>
          <CheckList items={['红外定位并标记组件', 'INV-3-02 停机隔离并验电挂牌', '更换 3 块热斑组件', '复电并复测电流与红外']} />
          <div className="ticket-stage-acceptance"><span>验收标准</span><strong>电流离散率 ≤5% · 红外最高温差 ≤8℃</strong></div>
        </StageCard>
      </div>
    </>
  )
}

function StageSix({ ids }) {
  return (
    <>
      <MetricGrid items={[
        { label: '工单编号', value: ids.workOrder, note: '派单 Agent 已生成' },
        { label: '作业窗口', value: '13:00–16:00', note: '今日 · 低功率窗口' },
        { label: '执行班组', value: '2', unit: '人', note: '川西检修一组' },
        { label: '资源冲突', value: '0', unit: '项', note: '已完成校验', tone: 'success' },
      ]} />
      <StageCard title="人员与资源排程" eyebrow="候选方案 A" icon={CalendarClock}>
        <Gantt />
        <div className="ticket-stage-schedule-summary"><span>建议窗口</span><strong>13:00–16:00</strong><span>光伏出力较低 · 无天气风险 · 2 项票证待申请</span></div>
      </StageCard>
    </>
  )
}

function StageSeven({ ids }) {
  return (
    <>
      <MetricGrid items={[
        { label: '候选排程', value: 'A', note: '13:00–16:00' },
        { label: '人员可用', value: '2 / 2', note: '川西检修一组', tone: 'success' },
        { label: '资源可用', value: '3 / 3', note: '吊装 / 备件 / 安全工器具', tone: 'success' },
        { label: '冲突检查', value: '通过', note: '无重叠任务', tone: 'success' },
      ]} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="排程摘要" eyebrow="待运维负责人批准" icon={CalendarClock} className="is-emphasis">
          <KeyValueList items={[
            ['关联工单', ids.workOrder],
            ['作业地点', '两河口光储电站 · #3 方阵'],
            ['作业窗口', '2026-08-20 13:00–16:00'],
            ['预计影响', '停机 18 min · 0.42 MW'],
          ]} />
        </StageCard>
        <StageCard title="资源冲突检查" eyebrow="Agent 校验结果" icon={Users}>
          <ul className="ticket-stage-status-list">
            {[
              [CheckCircle2, '人员班组可用，无重叠工单', 'success', '通过'],
              [CheckCircle2, '备件 3 块已锁定至仓位 K-03', 'success', '通过'],
              [CheckCircle2, '安全工器具与车辆已预约', 'success', '通过'],
              [AlertTriangle, '两票尚未提交，需现场工程师发起申请', 'warning', '下一步'],
            ].map(([StatusIcon, label, tone, status], index) => (
              <li key={label} style={{ '--check-delay': `${index * 160}ms` }}>
                <StatusIcon size={14} />
                <span>{label}</span>
                <Tag tone={tone}>{status}</Tag>
              </li>
            ))}
          </ul>
        </StageCard>
      </div>
    </>
  )
}

function StageEight({ ids }) {
  return (
    <>
      <MetricGrid items={[
        { label: '工作票', value: ids.workPermit, note: '现场工程师草拟' },
        { label: '操作票', value: '3', unit: '张', note: ids.operationPermitBase ?? ids.operationPermit },
        { label: '安全措施', value: '6', unit: '项', note: '待提交 AI 预审' },
      ]} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="工作票" eyebrow={ids.workPermit} icon={FileText}>
          <KeyValueList items={[
            ['工作内容', '逆变器直流侧停电、连接件复紧与 IV 复测'],
            ['执行班组', '川西检修一组 · 2 人'],
            ['工作地点', '两河口 #3 方阵 7 号组串'],
            ['计划时间', '2026-08-20 13:00–16:00'],
          ]} />
        </StageCard>
        <StageCard title="操作票与安全措施" eyebrow="3 张操作票" icon={ClipboardCheck}>
          <PermitTable operationPermit={ids.operationPermit} />
          <div className="ticket-stage-safety"><span>关键安全措施</span><p>断开直流汇流输入 · 验电 · 悬挂“禁止合闸”标识 · 接地 · 防坠落 · 监护到位</p></div>
        </StageCard>
      </div>
      <StageCard title="标准操作步骤" eyebrow="现场工程师提交前确认" icon={ListIcon}>
        <CheckList items={['确认作业边界与设备编号', '断开直流侧并完成验电', '悬挂标识牌、接地并开始检修', '更换组件并记录序列号', '复电前完成工具与人员清点']} />
      </StageCard>
    </>
  )
}

function ListIcon(props) {
  return <ClipboardCheck {...props} />
}

function StageNine({ ids }) {
  return (
    <>
      <MetricGrid items={[
        { label: '预审结果', value: '1', unit: '项', note: '需修订字段', tone: 'warning' },
        { label: '工作票', value: ids.workPermit, note: '已读取' },
        { label: '证据来源', value: '4', unit: '源', note: 'SCADA / 红外 / IV / 历史' },
      ]} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="AI 两票预审" eyebrow="待运维负责人确认" icon={Sparkles} className="is-emphasis">
          <div className="ticket-stage-alert"><AlertTriangle size={15} /><div><strong>操作票第 4 项未明确验电位置</strong><p>建议补充“逆变器直流侧输入端”，避免现场执行歧义。</p></div></div>
          <button className="ticket-stage-inline-button" type="button"><Wrench size={13} />一键填入建议</button>
          <KeyValueList items={[
            ['预审覆盖', '票面字段 24 / 25'],
            ['风险规则', 'OPS-SAFE-04'],
            ['推荐动作', '修订后批准两票'],
          ]} />
        </StageCard>
        <StageCard title="多源证据" eyebrow="AI 交叉校验" icon={FileCheck2}>
          <EvidenceList items={[
            { source: 'SCADA', label: '设备隔离状态', value: '一致' },
            { source: '历史工单', label: '相似热斑案例 6 条', value: '已关联' },
            { source: '备件系统', label: '组件库存 3 块', value: '已锁定' },
          ]} />
          <div className="ticket-stage-inline-status"><CheckCircle2 size={14} /><span>除 1 项描述外，票证内容均通过校验</span></div>
        </StageCard>
      </div>
    </>
  )
}

function StageTen() {
  return (
    <>
      <RouteCard />
      <StageCard title="现场执行清单" eyebrow="执行 Agent · 现场工程师" icon={Wrench}>
        <CheckList items={[
          { label: '成都驻地出发，导航至柯拉一期', state: 'done', note: '09:00 · 412 km / 4h50' },
          { label: '到场确认设备 LHK-PV-03-07', state: 'done', note: '13:52 · 定位一致' },
          { label: '停机隔离、验电并挂牌', state: 'done', note: '14:06 · 安全措施完成' },
          { label: '更换 3 块热斑组件并记录序列号', state: 'done', note: '等待现场回执' },
          { label: '复电、清点并回传作业证据', state: 'done', note: '待复测验证' },
        ]} />
      </StageCard>
    </>
  )
}

function StageEleven() {
  return (
    <>
      <MetricGrid items={[
        { label: '电流恢复', value: '7.8', unit: 'A', note: '处置前 6.1 A', tone: 'success' },
        { label: '离散率', value: '4.2', unit: '%', note: '验收 ≤5%', tone: 'success' },
        { label: '红外温差', value: '6', unit: '℃', note: '验收 ≤8℃', tone: 'success' },
      ]} />
      <StageCard title="处置前后数据对比" eyebrow="验证 Agent" icon={Activity}>
        <ComparisonTable />
        <div className="ticket-stage-inline-status"><CheckCircle2 size={14} /><span>全部关键指标满足验收标准，建议进入关单批准。</span></div>
      </StageCard>
    </>
  )
}

function StageTwelve({ ids }) {
  return (
    <>
      <MetricGrid items={[
        { label: '关单通知', value: '已生成', note: '等待运维负责人批准', tone: 'warning' },
        { label: '关联证据', value: '9', unit: '项', note: '数据 / 影像 / 票证' },
        { label: '验收结果', value: '通过', note: '3 项指标均达标', tone: 'success' },
      ]} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="关单通知" eyebrow="关闭工单摘要" icon={FileCheck2} className="is-emphasis">
          <KeyValueList items={[
            ['工单编号', ids.workOrder],
            ['缺陷单编号', ids.defect],
            ['处置结论', '组件更换完成，设备恢复正常运行'],
            ['通知对象', '技术负责人 · 现场工程师 · 集控值班'],
          ]} />
        </StageCard>
        <StageCard title="证据汇总与验收" eyebrow="验证 Agent 已核验" icon={ClipboardCheck}>
          <CheckList items={['现场照片与组件序列号', '停送电与两票执行记录', '处置前后 SCADA / IV 数据', '红外复测影像与温差报告']} />
          <div className="ticket-stage-acceptance"><span>验收标准</span><strong>电流离散率 ≤5% · 红外最高温差 ≤8℃</strong></div>
        </StageCard>
      </div>
    </>
  )
}

// The demo does not depend on a remote document service. Keep one tiny,
// valid PDF inline so the knowledge artifact is still previewable when the
// prototype is opened offline or from a static build.
const DEMO_CASE_PDF_DATA_URL = 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggNDA4ID4+CnN0cmVhbQpCVAovRjEgMjIgVGYKNzIgNzIwIFRkCihDQS0yMDI2LTAxNDcpIFRqCi9GMSAxNCBUZgowIC0zNCBUZAooUGhvdG92b2x0YWljIHN0cmluZyBob3RzcG90IHJlcGxhY2VtZW50IGNhc2UpIFRqCi9GMSAxMSBUZgowIC0zMiBUZAooR2VuZXJhdGVkIGJ5IFlhbG9uZ2ppYW5nIE9wZXJhdGlvbnMgQWdlbnQpIFRqCjAgLTI0IFRkCihUZW1wZXJhdHVyZSBkZWx0YTogMzggQyAgIEN1cnJlbnQgZGV2aWF0aW9uOiAtMjMgcGVyY2VudCkgVGoKMCAtMjQgVGQKKEFmdGVyIHRyZWF0bWVudDogdGVtcGVyYXR1cmUgZGVsdGEgNiBDICAgRGlzcGVyc2lvbiA0LjIgcGVyY2VudCkgVGoKMCAtNDAgVGQKKFJldXNhYmxlIHN0cmF0ZWd5OiBpZGVudGlmeSBhbmQgcmVwbGFjZSBzdHJpbmcgaG90c3BvdCBjb21wb25lbnRzKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMjEgMDAwMDAgbiAKMDAwMDAwMDI0NyAwMDAwMCBuIAowMDAwMDAwMzE3IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNzc1CiUlRU9GCg=='

function PdfPreview({ documentId, eyebrow, title, downloadName, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="ticket-stage-pdf-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="ticket-stage-pdf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-stage-pdf-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ticket-stage-pdf-dialog__header">
          <div>
            <span>{eyebrow}</span>
            <h3 id="ticket-stage-pdf-title">{title}</h3>
          </div>
          <button type="button" className="ticket-stage-pdf-dialog__close" onClick={onClose} aria-label="关闭 PDF 预览">
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="ticket-stage-pdf-dialog__body">
          <iframe
            title={`${documentId} PDF 预览`}
            src={DEMO_CASE_PDF_DATA_URL}
          />
        </div>
        <footer className="ticket-stage-pdf-dialog__footer">
          <span>演示文档 · 1 页</span>
          <a className="ticket-stage-pdf-dialog__download" href={DEMO_CASE_PDF_DATA_URL} download={downloadName}>
            <DownloadSimple size={14} aria-hidden="true" />
            下载 PDF
          </a>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function StageThirteen({ ids }) {
  const [pdfOpen, setPdfOpen] = useState(false)

  return (
    <>
      <StageCard title="复盘案例已生成" eyebrow={`知识 Agent · ${ids.case}`} icon={BrainCircuit} className="is-emphasis">
        <div className="ticket-stage-case-id"><span>案例编号</span><strong>{ids.case}</strong><Tag tone="success">已沉淀</Tag></div>
        <div className="ticket-stage-phase-grid">
          {[
            ['发现', '感知 Agent', '红外温差 38℃ · 电流偏差 -23%'],
            ['诊断', '诊断 Agent', '热斑置信度 91% · 根因锁定'],
            ['处置', '现场工程师', '更换 3 块组件 · 复紧连接件'],
            ['结果', '验证 Agent', '离散率 4.2% · 温差 6℃'],
          ].map(([label, actor, copy]) => <div key={label}><span>{label}</span><strong>{actor}</strong><small>{copy}</small></div>)}
        </div>
      </StageCard>
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="关联单据" eyebrow="证据链闭环" icon={GitBranch}>
          <ul className="ticket-stage-doc-list">
            {[['任务', ids.ticket], ['事件', ids.event], ['缺陷单', ids.defect], ['工单', ids.workOrder], ['工作票', ids.workPermit], ['操作票', ids.operationPermitBase ?? ids.operationPermit]].map(([label, value], index) => (
              <li key={label} style={{ '--check-delay': `${index * 160}ms` }}>
                <span>{label}</span>
                <b className="ticket-stage-data">{value}</b>
                <CheckCircle2 size={13} />
              </li>
            ))}
          </ul>
        </StageCard>
        <StageCard title="知识沉淀" eyebrow="可复用经验" icon={Sparkles}>
          <p className="ticket-stage-note">已提炼为“光伏组串热斑识别与更换”作业策略，可用于同类设备的下一次诊断与排程。</p>
          <div className="ticket-stage-tag-list"><Tag tone="blue">热斑</Tag><Tag tone="blue">接触电阻</Tag><Tag tone="green">低功率窗口</Tag><Tag tone="neutral">红外复测</Tag></div>
          <div className="ticket-stage-suggestion"><Zap size={13} /><span>相似案例 6 条 · 推荐给诊断 Agent</span></div>
          <button className="ticket-stage-pdf-entry" type="button" onClick={() => setPdfOpen(true)} aria-haspopup="dialog">
            <span className="ticket-stage-pdf-entry__icon"><FilePdf size={18} aria-hidden="true" /></span>
            <span className="ticket-stage-pdf-entry__copy"><strong>{ids.case}-复盘案例.pdf</strong><small>PDF · 1 页 · 点击预览</small></span>
            <span className="ticket-stage-pdf-entry__action">预览</span>
          </button>
        </StageCard>
      </div>
      {pdfOpen && (
        <PdfPreview
          documentId={ids.case}
          eyebrow="知识沉淀 · PDF 文档"
          title={`光伏组串热斑识别与更换 · ${ids.case}`}
          downloadName={`${ids.case}-复盘案例.pdf`}
          onClose={() => setPdfOpen(false)}
        />
      )}
    </>
  )
}

function StageFallback({ ticket, index }) {
  return (
    <StageCard title="流程节点数据" eyebrow={`步骤 ${index}`} icon={Activity}>
      <KeyValueList items={[
        ['工单', ticket?.id ?? 'DF-20260820-001'],
        ['设备', ticket?.deviceId ?? 'LHK-PV-03-07'],
        ['状态', '演示数据已加载'],
      ]} />
    </StageCard>
  )
}

/**
 * Static stage detail used by the demo ticket flow. It intentionally keeps
 * the 13-node business story in one small step switch; progress and approval
 * state remain owned by AppContext/TicketPage.
 */
export function TicketStageContent({ step, ticket, selectedStep, currentStep, completed = false }) {
  const index = Math.min(13, Math.max(1, stepNumber(step ?? selectedStep ?? currentStep)))
  const ids = idsFor(ticket)
  const activeStep = stepNumber(currentStep ?? ticket?.currentStep)
  const generation = useStageGeneration(
    index,
    ticket?.id,
    Boolean(GENERATION_META[index] && index === activeStep && !completed),
  )
  let content
  switch (index) {
    case 1: content = <StageOne ticket={ticket} />; break
    case 2: content = <StageTwo />; break
    case 3: content = <StageThree />; break
    case 4: content = <StageFour ids={ids} />; break
    case 5: content = <StageFive ids={ids} />; break
    case 6: content = <StageSix ids={ids} />; break
    case 7: content = <StageSeven ids={ids} />; break
    case 8: content = <StageEight ids={ids} />; break
    case 9: content = <StageNine ids={ids} />; break
    case 10: content = <StageTen />; break
    case 11: content = <StageEleven />; break
    case 12: content = <StageTwelve ids={ids} />; break
    case 13: content = <StageThirteen ids={ids} />; break
    default: content = <StageFallback ticket={ticket} index={index} />
  }
  return (
    <section className="ticket-stage-content" aria-label={`步骤 ${index} 业务内容`}>
      <StageHeader index={index} isGenerated={generation.isGenerated} />
      <div
        key={`ticket-stage-${ticket?.id ?? 'ticket'}-${index}`}
        className={`ticket-stage-content__body${generation.isGenerated ? ' is-generated' : ''}${generation.ready ? ' is-revealed' : ' is-generating'}`}
        data-stage-index={index}
        data-progress={generation.progress}
        aria-busy={!generation.ready}
      >
        {generation.ready ? (
          <>
            {generation.isGenerated ? (
              <StageAgentIdentity
                agent={generation.agent}
                time={generation.time}
                icon={generation.icon}
              />
            ) : null}
            {content}
          </>
        ) : (
          <StageGeneration
            agent={generation.agent}
            time={generation.time}
            icon={generation.icon}
            label={generation.label}
            detail={generation.detail}
            progress={generation.progress}
          />
        )}
      </div>
    </section>
  )
}

export default TicketStageContent
