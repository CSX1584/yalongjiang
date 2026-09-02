import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import {
  ActivityIcon as Activity,
  Airplane,
  Warning as AlertTriangle,
  Brain as BrainCircuit,
  CalendarDots as CalendarClock,
  Check,
  CheckCircle as CheckCircle2,
  ClipboardText as ClipboardCheck,
  Clock as Clock3,
  Eye,
  FileText as FileCheck2,
  FileText,
  Gauge,
  MapPin,
  MapPinLine as MapPinned,
  PauseCircle,
  PencilLine,
  Plus,
  Robot as Bot,
  ShieldCheck,
  Sparkle as Sparkles,
  User as UserRound,
  UserFocus,
  Users,
  Wrench,
  X,
} from '@phosphor-icons/react'
import {
  DEFAULT_ENVIRONMENT,
  SolarPlantMonitor,
} from 'solar-plant-monitor-embed'
import solarPlantDocuments from '../data/solar-plant-scene-2026-08-20.json'

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

// 合并流程「故障诊断」节点的票：异常触发票 / 数据收集卡 / 根因分析卡的头部元信息（诊断结论卡沿用 STEP_META[4] 结构覆盖）
const DIAGNOSIS_EVIDENCE_META = { eyebrow: '感知研判 · 证据汇聚', title: '异常触发', copy: '', mode: 'Agent 自动完成' }
const DATA_COLLECTION_META = { eyebrow: '异常感知 · 数据收集', title: '数据收集', copy: '', mode: 'Agent 自动完成' }
const ROOT_CAUSE_META = { eyebrow: '异常感知 · 根因分析', title: '根因分析', copy: '', mode: 'Agent 自动完成' }
const DIAGNOSIS_CONCLUSION_META = { eyebrow: '缺陷生成 · 诊断结论', title: '缺陷诊断', copy: '', mode: '人工审批' }

const STEP_META = {
  1: { eyebrow: '异常感知 · 数据汇聚', title: '异常数据已捕获', copy: '已完成 SCADA、无人机红外和 IV 曲线的同步采集。', mode: '自动完成' },
  2: { eyebrow: '异常感知 · AI 诊断', title: 'AI 根因诊断完成', copy: '多源证据已对齐，诊断置信度达到人工复核阈值。', mode: '自动完成' },
  3: { eyebrow: '异常感知 · 人工复核', title: '异常复核', copy: '请技术负责人核对趋势、证据和处置代价，再决定是否生成缺陷单。', mode: '人工确认' },
  4: { eyebrow: '缺陷生成 · 结构化记录', title: '缺陷单', copy: '缺陷信息已由 AI 预填，运维值班员核对后可直接修改。', mode: '人工审批' },
  5: { eyebrow: '缺陷生成 · 工单决策', title: '工单生成', copy: '技术负责人确认根因、措施和验收标准后，生成现场工单。', mode: '人工审批' },
  6: { eyebrow: '派单执行 · 智能排程', title: '工单排程', copy: '正在根据班组、资源和低功率窗口生成候选排程。', mode: '自动生成' },
  7: { eyebrow: '派单执行 · 排程决策', title: '排程批准', copy: '运维负责人确认人员、资源和作业窗口无冲突后批准执行。', mode: '人工审批' },
  8: { eyebrow: '派单执行 · 安全票证', title: '工作票与操作票申请', copy: '工作票内含一张工序单，操作票按需勾选生成，全部内容由 AI 预填。', mode: '人工提交' },
  9: { eyebrow: '派单执行 · 票证会签', title: '工作票与操作票批准', copy: '工作许可人先审批工作票与工序单，再由运维负责人审批操作票。', mode: '人工会签' },
  10: { eyebrow: '派单执行 · 现场作业', title: '现场执行', copy: '正在汇总导航、到场、隔离、挂牌、更换与复电回执。', mode: '自动执行' },
  11: { eyebrow: '缺陷闭环 · 复测验证', title: '复测验证', copy: '正在对比处置前后的关键运行指标。', mode: '自动验证' },
  12: { eyebrow: '缺陷闭环 · 关单决策', title: '关闭工单批准', copy: '运维负责人核对通知、证据汇总和验收标准后批准关单。', mode: '人工审批' },
  13: { eyebrow: '缺陷闭环 · 知识沉淀', title: 'AI 复盘沉淀', copy: '本次消缺过程已整理为可复用案例，完成闭环。', mode: '' },
}

// Agent-owned nodes reveal their details after a short, deterministic progress
// pass. Manual approval nodes stay immediately readable so the real decision
// interaction remains unchanged.
// 时长与对话流 STEP_CHAIN_COPY 的 think.duration 对齐：左侧思考结束 = 右侧卡片生成完成
const GENERATION_META = {
  1: { duration: 2300, label: '正在汇聚证据', detail: '多源感知数据同步中' },
  2: { duration: 1800, label: '正在对齐根因', detail: '趋势、基线与历史案例交叉验证中' },
  4: { duration: 1800, label: '正在生成缺陷记录', detail: '关联事件、设备与验收约束整理中' },
  6: { duration: 2500, label: '正在生成候选排程', detail: '班组、资源与作业窗口校验中' },
  10: { duration: 1600, label: '正在汇总现场回执', detail: '导航、隔离、换件与复电记录同步中' },
  11: { duration: 2900, label: '正在计算复测结果', detail: '处置前后关键指标对比中' },
  13: { duration: 2400, label: '正在沉淀复盘案例', detail: '过程证据、结果与可复用策略整理中' },
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

/**
 * 按缺陷单识别演示内容类型：热斑 / 组串反灌 / 逆变器脱网
 */
function demoKeyFor(ticket) {
  const key = `${ticket?.demoKey ?? ''} ${ticket?.id ?? ''} ${ticket?.title ?? ''}`
  if (key.includes('reflux') || key.includes('反灌') || key.includes('DF-20260820-002')) return 'reflux'
  if (key.includes('trip') || key.includes('脱网') || key.includes('DF-20260820-003')) return 'trip'
  return 'hotspot'
}

// 三个缺陷单各自的单据编号
const DEFECT_IDS = {
  hotspot: DEFAULT_IDS,
  reflux: {
    ticket: 'WO-20260820-018',
    event: 'EVT-20260819-0143',
    defect: 'QXD-20260820-021',
    workOrder: 'GD-20260820-024',
    workPermit: 'GZP-20260820-036',
    operationPermit: 'CZP-20260820-052',
    operationPermitBase: 'CZP-20260820-052',
    case: 'CA-2026-0153',
  },
  trip: {
    ticket: 'WO-20260820-019',
    event: 'EVT-20260820-0166',
    defect: 'QXD-20260820-022',
    workOrder: 'GD-20260820-025',
    workPermit: 'GZP-20260820-037',
    operationPermit: 'CZP-20260820-053',
    operationPermitBase: 'CZP-20260820-053',
    case: 'CA-2026-0158',
  },
}

// 按缺陷类型生成 13 步流程的全部展示内容与单据 PDF 内容，布局一致、文案各异
// 根因节点内嵌折线图数据（归一化 0-1）：功率曲线 30 天、反灌时段 24 小时
const POWER_CURVE_NORMAL = [0.78, 0.81, 0.77, 0.8, 0.79, 0.82, 0.78, 0.8, 0.76, 0.79, 0.81, 0.78, 0.8, 0.77, 0.79, 0.81, 0.78, 0.8, 0.79, 0.77, 0.81, 0.8, 0.78, 0.79, 0.8, 0.77, 0.79, 0.81, 0.78, 0.8]
const POWER_CURVE_FAULT = [...POWER_CURVE_NORMAL.slice(0, 27), 0.31, 0.26, 0.24]
const REFLUX_CURVE_24H = [0.55, 0.5, 0.45, 0.42, 0.48, 0.6, 0.78, 0.85, 0.7, 0.5, 0.35, 0.25, 0.2, 0.22, 0.28, 0.36, 0.48, 0.62, 0.78, 0.88, 0.82, 0.72, 0.64, 0.58]

const DEFECT_BUILDERS = {
  hotspot: (ids) => ({
    mainTask: '组串热斑缺陷处置',
    date: '2026-08-20',
    figure: { alt: '组件热斑红外示意图：一块组件高温发红' },
    stage1: {
      metrics: [
        { label: '组串电流', value: '6.1', unit: 'A', note: '同方阵均值 7.9 A', tone: 'warning' },
        { label: '电流偏差', value: '-23', unit: '%', note: '规则 R-017 触发', tone: 'danger' },
        { label: '红外最高温差', value: '38', unit: '℃', note: '验收标准 ≤8℃', tone: 'danger' },
        { label: '发现时间', value: '08:42', note: 'SCADA / 无人机同步', tone: 'normal' },
      ],
      device: [['设备', 'LHK-PV-03-07'], ['组串电压', '1,086 V · 正常'], ['辐照 / 环境', '824 W/m² · 晴 18℃'], ['采集窗口', '过去 24 h · 3 秒刷新']],
      evidence: [
        { source: 'SCADA', label: '趋势 24 h', value: '已归档' },
        { source: '无人机红外', label: '红外影像 4 张', value: '已归档' },
        { source: 'IV 扫描', label: '曲线与基线', value: '已归档' },
      ],
    },
    stage2: {
      metrics: [
        { label: '热斑置信度', value: '91', unit: '%', note: '超过确诊阈值 90%', tone: 'success' },
        { label: '候选原因', value: '3', unit: '项', note: '组件 / 二极管 / 接头' },
        { label: '交叉证据', value: '4', unit: '源', note: 'SCADA · 红外 · IV · 历史' },
      ],
      threshold: '90%',
      causes: [['组件热斑', '91%', 91, 'warning'], ['旁路二极管故障', '6%', 6, 'muted'], ['MC4 接头不良', '3%', 3, 'muted']],
      note: '组件热斑置信度已超过 90% 确诊阈值，建议进入技术负责人复核。',
      diagnosis: [
        { node: '组串电流 6.1A', type: 'bars', caption: '电流偏差 -23%，触发规则 R-017', rows: [
          { label: '7 号组串', value: '6.1 A', pct: 77, tone: 'danger' },
          { label: '方阵均值', value: '7.9 A', pct: 100 },
        ] },
        { node: '红外温差 38℃', type: 'bars', caption: '无人机红外热斑定位', rows: [
          { label: '判定阈值', value: '20 ℃', pct: 48, tone: 'warning' },
          { label: '实测最高', value: '41.4 ℃', pct: 100, tone: 'danger' },
        ] },
        { node: 'IV 特征 3 项命中', type: 'stat', value: '88', unit: '%', note: '阶梯 / 凹陷 / 斜率特征', caption: 'IV 曲线热斑特征匹配度' },
        { node: '热斑置信度 91%', type: 'stat', value: '91', unit: '%', note: '确诊阈值 90%', tone: 'success', caption: '三源证据交叉验证' },
      ],
      conclusion: ['第 7 组串接触电阻升高，已形成持续性热斑', '温差与电流偏差同时出现，气象和遮挡因素已排除。'],
      kv: [['建议措施', '复紧连接件，更换 3 块热斑组件'], ['复测要求', '更换后完成 IV 与红外复测'], ['关联事件', ids.event]],
    },
    // 数据收集卡：正常 vs 异常对比图表（折线/柱状/热力/桑基/离散/雷达），口径同 stage1/stage2
    collection: {
      summary: [
        { text: '已汇集 #3 方阵 ' },
        { text: '7 号组串', tone: 'danger' },
        { text: ' 24 h SCADA、红外与 IV 数据：组串电流 ' },
        { text: '6.1A', tone: 'danger' },
        { text: ' 低于方阵均值 7.9A（' },
        { text: '-23%', tone: 'danger' },
        { text: '），3 块组件红外最高温差 ' },
        { text: '41.4℃', tone: 'warning' },
        { text: ' 超 20℃ 判定阈值。' },
      ],
      line: {
        title: '组串电流 24h 对比', unit: 'A',
        axis: ['0时', '6时', '12时', '18时', '24时'],
        normal: [0, 0, 0, 0, 0.5, 2, 4.5, 6.5, 7.6, 7.9, 7.8, 7.4, 6.8, 5.5, 3.5, 1.5, 0.3, 0, 0, 0],
        abnormal: [0, 0, 0, 0, 0.4, 1.6, 3.5, 5.1, 5.9, 6.1, 6, 5.7, 5.2, 4.2, 2.7, 1.1, 0.2, 0, 0, 0],
        abnormalFrom: 4, abnormalTo: 16,
        caption: '7 号组串全天电流低于方阵均值，午间发电峰值偏差 -23%',
      },
      bar: {
        title: '组件红外最高温差', unit: '℃', average: 8,
        items: [
          { label: '组件 1', value: 4.2 }, { label: '组件 2', value: 5.1 },
          { label: '组件 3', value: 41.4, alert: true }, { label: '组件 4', value: 6 },
          { label: '组件 5', value: 33.2, alert: true }, { label: '组件 6', value: 5.4 },
          { label: '组件 7', value: 28.1, alert: true }, { label: '组件 8', value: 4.6 },
        ],
        caption: '超均值组件即为热斑候选，3 块组件温差远超 8℃ 验收标准',
      },
      heat: {
        title: '7 号组串组件红外热力', rows: 2, cols: 12,
        values: [
          [0.12, 0.15, 0.1, 0.14, 0.11, 0.16, 0.13, 0.1, 0.15, 0.12, 0.14, 0.11],
          [0.13, 0.95, 0.15, 0.12, 0.78, 0.1, 0.85, 0.14, 0.11, 0.13, 0.15, 0.12],
        ],
        caption: '3 块组件红外温度显著偏高，定位热斑物理位置',
      },
      sankey: {
        title: '组串电流流向',
        columns: [['7 号组串', '同方阵组串 ×7'], ['直流汇流箱'], ['INV-3-02 逆变器']],
        flows: [
          { from: [0, 1], to: [1, 0], value: 6, label: '7.9 A' },
          { from: [0, 0], to: [1, 0], value: 1.5, alert: true, label: '6.1 A' },
          { from: [1, 0], to: [2, 0], value: 7.5 },
        ],
        caption: '7 号组串输入电流明显偏细，拉低汇流箱总输入',
      },
      scatter: {
        title: '组件电流-温度离散分布',
        xLabel: '组件电流 (A)', yLabel: '组件温度 (℃)',
        points: makeScatterPoints({
          seed: 20260818, count: 142, x: [7.2, 8.4], y: [38, 52],
          alertCount: 8, alertX: [5.6, 6.4], alertY: [76, 93],
        }),
        caption: '150 个组件采样点：8 个红点高温低流，为热斑组件',
      },
      radar: {
        title: '组件健康画像',
        axes: ['温度', '电流', 'IV 特征', '绝缘', '功率', 'EL 成像'],
        normal: [0.88, 0.9, 0.86, 0.9, 0.88, 0.85],
        abnormal: [0.25, 0.55, 0.3, 0.8, 0.5, 0.7],
        caption: '红色为热斑组件健康度，温度 / IV 特征 / 功率严重劣化',
      },
    },
    // 根因分析流程：根节点现象 → 候选分支 → 验证链 → 保留/排除 → 收敛结论
    rootCauseFlow: {
      root: { cards: ['全天电流低于均值（-23%）', '3 块组件温差 41.4/33.2/28.1℃ 超 8℃ 标准', '3 块组件红外温度显著偏高', '7 号组串输入 6.1A 偏细（同方阵 7.9A）', '8 个采样点高温低流', '温度、IV 特征、功率严重劣化'] },
      branches: [
        {
          hypothesis: '可能是组件热斑',
          kept: true,
          confidence: '58%',
          chain: [
            { title: '红外热斑定位', desc: '锁定 3 块组件，最高温差 41.4℃，远超 20℃ 判定阈值', confidence: '76%' },
            { title: 'IV 曲线特征比对', desc: '热斑典型特征（台阶、斜率突变）匹配度 88%', confidence: '88%' },
            { title: '电流对比验证', desc: '热斑组件电流被拉低，拖累整串输出', confidence: '91%' },
          ],
        },
        {
          hypothesis: '可能是旁路二极管导通',
          kept: false,
          confidence: '30%',
          chain: [
            { title: '旁路回路测试', desc: '压降正常，无异常导通', confidence: '14%' },
            { title: '特征比对', desc: '二极管导通会整段失压，本串仅局部温差，特征不符', confidence: '6%' },
          ],
        },
        {
          hypothesis: '可能是 MC4 接头松动',
          kept: false,
          confidence: '26%',
          chain: [
            { title: '接头抽检', desc: '抽查 12 个接头，温升与阻值均在正常范围', confidence: '12%' },
            { title: '特征比对', desc: '接头松动伴随间歇性拉弧记录，日志无相关告警', confidence: '5%' },
          ],
        },
      ],
    },
    // 诊断结论卡处理建议：点击行为与左侧对话的处置按钮一致
    conclusionActions: [
      { key: 'A', label: '派人员检修（转工单）', icon: 'clipboard', action: 'approve', recommended: true, desc: '推荐：低功率窗口更换 3 块热斑组件，停机约 18 min，当日止损' },
      { key: 'B', label: '人工巡检复核', icon: 'user', action: 'manual', desc: '零成本纳入下次人工巡检，但热斑可能扩大，发电偏差 -23.4% 持续' },
      { key: 'C', label: '无人机巡检复核', icon: 'drone', action: 'drone', desc: '红外复测确认热斑范围后再处置更稳妥，需等排期约 1 天' },
      { key: 'D', label: '挂起', icon: 'pause', action: 'suspend', desc: '不占用资源，但热斑扩大可能引发停机与发电损失（约 ¥3,260/日）' },
    ],
    stage3: {
      trendAria: '72 小时离散率从 4.2% 上升至 23%',
      trendKv: [['72 h 离散率', '4.2% → 23%'], ['温差趋势', '12℃ → 38℃'], ['同类设备基线', '离散率 ≤5%'], ['数据完整性', '98.7% · 无缺口']],
      cost: [['当前发电偏差', '-23.4%'], ['预计经济损失', '¥ 3,260 / 日'], ['风险等级', 'II 级 / 重要'], ['未处置后果', '热斑可能扩大并引发停机与发电损失']],
      suggestion: 'AI 建议：确认缺陷并在低功率窗口安排处理。',
    },
    chain: [
      '组串电流较同方阵均值偏低 23%，触发热斑筛查规则',
      '红外锁定热斑点温差 41.4℃，远超 20℃ 判定阈值',
      'IV 曲线三项热斑典型特征匹配度 88%，排除遮挡干扰',
      '三源证据交叉验证置信度 91%，超过 90% 确诊阈值',
    ],
    defect: {
      title: '光伏组串热斑缺陷单',
      metrics: [
        { label: '缺陷类别', value: 'II 级 / 重要缺陷', tone: 'warning' },
        { label: '故障类别', value: '组件热斑' },
        { label: '缺陷状态', value: '待确认转工单' },
        { label: '发现日期', value: '2026-08-18' },
        { label: '发现单位', value: '雅砻江流域集控中心' },
        { label: '发现人', value: '运维值班员 王磊' },
        { label: '场站名称', value: '两河口光储电站' },
        { label: '缺陷单编号', value: ids.defect },
      ],
      info: ['#3 方阵 7 号组串光伏组件', '红外温差 38℃ · 组串电流偏低 23%'],
      measure: ['更换设备', '更换 3 块热斑组件并复紧直流侧连接件，完成 IV 曲线与红外复测'],
      root: ['组件热斑（接触电阻升高）', '需更换 3 块热斑组件，并复紧直流侧连接件。'],
      cost: [['当前发电偏差', '-23.4%'], ['预计经济损失', '¥ 3,260 / 日'], ['未处置后果', '热斑可能扩大并引发停机与发电损失']],
    },
    stage5: {
      metrics: [
        { label: '执行班组', value: '川西检修一组', note: '李强 · 赵鹏' },
        { label: '作业窗口', value: '2026-08-20', note: '低功率窗口' },
        { label: '工单编号', value: ids.workOrder, note: '批准后进入排程' },
        { label: '风险等级', value: 'II', unit: '级', note: '重要缺陷', tone: 'warning' },
      ],
      checklist: ['红外定位并标记组件', 'INV-3-02 停机隔离并验电挂牌', '更换 3 块热斑组件', '复电并复测电流与红外'],
      acceptance: '电流离散率 ≤5% · 红外最高温差 ≤8℃',
    },
    stage7: {
      metrics: [
        { label: '候选排程', value: 'A', note: '2026-08-20' },
        { label: '人员可用', value: '2 / 2', note: '川西检修一组', tone: 'success' },
        { label: '资源可用', value: '3 / 3', note: '吊装 / 备件 / 安全工器具', tone: 'success' },
        { label: '冲突检查', value: '通过', note: '无重叠任务', tone: 'success' },
      ],
      summary: [['关联工单', ids.workOrder], ['作业地点', '两河口光储电站 · #3 方阵'], ['作业窗口', '2026-08-20'], ['预计影响', '停机 18 min · 0.42 MW']],
      checks: ['人员班组可用，无重叠工单', '备件 3 块已锁定至仓位 K-03', '安全工器具与车辆已预约'],
    },
    permits: {
      workTitle: '光伏组串热斑消缺工作票',
      procTitle: '热斑组件更换工序单',
      opTitle: '直流侧停送电操作票',
      workSummary: [
        { label: '执行班组', value: '李强 · 赵鹏', note: '川西检修一组' },
        { label: '作业窗口', value: '2026-08-20' },
        { label: '总人数', value: '2', unit: '人' },
        { label: '单号', value: ids.workPermit },
        { label: '工作内容', value: '更换 3 块热斑组件并复紧直流侧连接件', wide: true },
      ],
      opSummary: [
        { label: '执行班组', value: '周凯', note: '集控中心' },
        { label: '作业窗口', value: '2026-08-20' },
        { label: '总人数', value: '1', unit: '人' },
        { label: '单号', value: ids.operationPermit },
        { label: '工作内容', value: 'INV-3-02 停机隔离并验电挂牌', wide: true },
      ],
    },
    stage9: {
      workAlert: ['工序单验电位置已明确', '已注明"逆变器直流侧输入端"，AI 审核通过。'],
      opAlert: ['操作票第 3 项装设接地线未注明接地点编号', '建议补充接地点位置，避免现场执行歧义。'],
    },
    stage10: {
      route: { dest: '两河口光储电站', km: '386 km', dur: '4h20', advice: '建议 09:00 出发 · 13:20 到场' },
      checklist: [
        { label: '成都驻地出发，导航至两河口', state: 'done', note: '09:00 · 386 km / 4h20' },
        { label: '到场确认设备 LHK-PV-03-07', state: 'done', note: '13:22 · 定位一致' },
        { label: '停机隔离、验电并挂牌', state: 'done', note: '13:36 · 安全措施完成' },
        { label: '更换 3 块热斑组件并记录序列号', state: 'done', note: '等待现场回执' },
        { label: '复电、清点并回传作业证据', state: 'done', note: '待复测验证' },
      ],
    },
    stage11: {
      metrics: [
        { label: '电流恢复', value: '7.8', unit: 'A', note: '处置前 6.1 A', tone: 'success' },
        { label: '离散率', value: '4.2', unit: '%', note: '验收 ≤5%', tone: 'success' },
        { label: '红外温差', value: '6', unit: '℃', note: '验收 ≤8℃', tone: 'success' },
      ],
      comparison: [
        ['组串电流', '6.1 A', '7.8 A', '+1.7 A'],
        ['离散率', '23%', '4.2%', '-18.8 pp'],
        ['红外最高温差', '38℃', '6℃', '-32℃'],
      ],
    },
    stage12: {
      metrics: [
        { label: '关单通知', value: '已生成', note: '等待运维负责人批准', tone: 'warning' },
        { label: '关联证据', value: '9', unit: '项', note: '数据 / 影像 / 票证' },
        { label: '验收结果', value: '通过', note: '3 项指标均达标', tone: 'success' },
      ],
      notice: [['工单编号', ids.workOrder], ['缺陷单编号', ids.defect], ['处置结论', '组件更换完成，设备恢复正常运行'], ['通知对象', '技术负责人 · 现场工程师 · 集控值班']],
      evidence: ['现场照片与组件序列号', '停送电与两票执行记录', '处置前后 SCADA / IV 数据', '红外复测影像与温差报告'],
      acceptance: '电流离散率 ≤5% · 红外最高温差 ≤8℃',
    },
    stage13: {
      phases: [
        ['发现', '异常感知', '红外温差 38℃ · 电流偏差 -23%'],
        ['诊断', 'AI 诊断', '热斑置信度 91% · 根因锁定'],
        ['处置', '现场工程师', '更换 3 块组件 · 复紧连接件'],
        ['结果', '复测验证', '离散率 4.2% · 温差 6℃'],
      ],
      sla: [
        { stage: '异常诊断', planned: '≤30 min', actual: '18 min', met: true },
        { stage: '派单审批', planned: '≤2 h', actual: '3.5 h', met: false },
        { stage: '现场处置', planned: '≤72 h', actual: '26 h', met: true },
        { stage: '复测关单', planned: '≤24 h', actual: '12 h', met: true },
      ],
      accuracy: { conclusion: '组件热斑（连接件接触电阻升高）', confidence: '91%', verified: '开盖检查与红外复核结果一致，根因判断无误', verdict: '诊断准确' },
      qa: [
        { question: '现场风速 8.4 m/s，无人机能否起飞复检？', help: '暴露派单未校验天气窗口的问题，复检改期避免空跑' },
        { question: '备件包里没有同型号连接件怎么办？', help: '确认库房调拨路径，推动出发前备件清单提醒' },
      ],
      lessons: [
        { problem: '派单前未分析天气，现场风速超限导致复检任务不可行', rule: '派单前强制校验天气窗口，风速超限自动提示改期' },
        { problem: '现场忘带连接件备件，临时询问库房调拨', rule: '出发前按缺陷类型推送备件清单核对提醒' },
      ],
      // 无用数据（待确认后删除）：tags 字段无渲染消费
      // tags: [['blue', '热斑'], ['blue', '接触电阻'], ['green', '低功率窗口'], ['neutral', '红外复测']],
      similar: '相似案例 6 条 · 已纳入诊断知识库',
      strategy: '光伏组串热斑识别与更换',
    },
    docs: {
      defect: {
        type: '缺陷单', title: '光伏组串热斑缺陷单', docNo: ids.defect,
        sections: [{
          rows: [
            ['缺陷编号', ids.defect], ['发现单位', '雅砻江流域集控中心'], ['发现人', '运维值班员 王磊'], ['发现日期', '2026-08-18'],
            ['缺陷类别', 'II 级 / 重要缺陷'], ['责任班组', '川西检修一组'], ['责任人', '李强'], ['厂站', '两河口光储电站'],
            ['设备码', 'LHK-PV-03-07'], ['设备描述', '#3 方阵 7 号组串光伏组件'], ['状态', '待确认转工单'], ['故障类别', '组件热斑'],
            ['辅助现象', '红外温差 38℃ · 组串电流偏低 23%'], ['工单编号', ids.workOrder], ['对业务影响', '发电偏差 -23.4% · 约 ¥3,260/日'],
            ['缺陷原因', '连接件接触电阻升高，形成持续性组件热斑'],
            ['处理措施', '更换 3 块热斑组件并复紧直流侧连接件，完成 IV 曲线与红外复测'],
          ],
        }],
      },
      workOrder: {
        type: '工单', title: '光伏组串热斑消缺工单', docNo: ids.workOrder,
        sections: [{
          rows: [
            ['工单编号', ids.workOrder], ['状态', '待提交'], ['工单类型', '消缺工单'], ['时间窗口', '2026-08-20'],
            ['创建人', '运维值班员 王磊'], ['创建时间', '2026-08-13 16:05'], ['场站', '两河口光储电站'], ['班组', '川西检修一组'],
            ['工作负责人', '李强'], ['工作内容', '更换 3 块热斑组件并复紧直流侧连接件，完成 IV 曲线与红外复测'],
            ['设备编号', 'LHK-PV-03-07'], ['设备名称', '#3 方阵 7 号组串光伏组件'], ['KKS 编码', 'LHK-PV-03-07-STR07'], ['KKS 描述', '两河口 #3 方阵 7 号组串'],
          ],
        }],
      },
      work: {
        type: '工作票', title: '光伏组串热斑消缺工作票', docNo: ids.workPermit,
        sections: [
          { title: '临时检修交代', rows: [['编号', 'LSJX-20260813-007'], ['类型', '临时检修交代'], ['创建人', '运维值班员 王磊'], ['提交时间', '2026-08-13 16:20'], ['状态', '待提交'], ['工作票号', ids.workPermit], ['工作票描述', '光伏组串热斑消缺工作票'], ['事由或申请事项', '#3 方阵 7 号组串热斑消缺，需申请直流侧停电作业']] },
          { title: '工作票信息', rows: [['工作票编号', ids.workPermit], ['工作票类型', '电气第一种工作票'], ['班组', '川西检修一组'], ['状态', '待提交'], ['工作负责人', '李强'], ['作业窗口', '2026-08-20'], ['总人数', '2 人'], ['工作班人员', '李强 · 赵鹏'], ['工作内容', '更换 3 块热斑组件并复紧直流侧连接件'], ['工作地点', '两河口 #3 方阵 7 号组串']] },
          { title: '检修工序卡', rows: [['作业范围', '#3 方阵 7 号组串热斑组件 3 块'], ['工序内容', '1. 断开直流汇流输入并验电挂牌\n2. 红外定位并标记热斑组件\n3. 拆除旧组件并记录序列号\n4. 安装新组件并复紧 MC4 接头\n5. 复电并完成 IV 曲线与红外复测'], ['完工标准', '电流离散率 ≤5% · 红外温差 ≤8℃'], ['预计工时', '165 min']] },
          { title: '遗留问题及备注', rows: [['遗留问题描述', '无'], ['备注', '无']] },
          { title: '安全措施', rows: [['安全措施', '断开直流汇流输入 · 验电 · 悬挂"禁止合闸"标识 · 接地 · 防坠落 · 监护到位']] },
        ],
      },
      proc: {
        type: '工序单', title: '热斑组件更换工序单', docNo: `${ids.workPermit}-P01`,
        sections: [{
          rows: [
            ['作业范围', '#3 方阵 7 号组串热斑组件 3 块'],
            ['工序内容', '1. 断开直流汇流输入并验电挂牌\n2. 红外定位并标记热斑组件\n3. 拆除旧组件并记录序列号\n4. 安装新组件并复紧 MC4 接头\n5. 复电并完成 IV 曲线与红外复测'],
            ['完工标准', '电流离散率 ≤5% · 红外温差 ≤8℃'], ['预计工时', '165 min'],
          ],
        }],
      },
      op: {
        type: '操作票', title: '直流侧停送电操作票', docNo: ids.operationPermit,
        sections: [{
          rows: [
            ['操作票编号', ids.operationPermit], ['工作班组', '集控中心'], ['时间窗口', '2026-08-20'], ['工作人数', '1 人'],
            ['操作任务', 'INV-3-02 直流侧停电、挂牌与复电'],
            ['操作步骤', '1. 核对设备双重编号\n2. 断开直流汇流输入开关并验电\n3. 悬挂"禁止合闸"标识牌并装设接地线\n4. 作业结束后拆除接地与标识\n5. 合闸复电并汇报值班员'],
            ['操作人 / 监护人', '周凯 · 班组监护人'],
          ],
        }],
      },
    },
    reviews: {
      op: {
        操作步骤: '操作第 3 项装设接地线未注明具体接地点编号，建议补充接地点位置。',
      },
    },
  }),
  reflux: (ids) => ({
    mainTask: '组串反灌缺陷处置',
    date: '2026-08-22',
    figure: { alt: '组串反灌示意图：一条回路防反二极管发热异常' },
    stage1: {
      metrics: [
        { label: '季度反灌次数', value: '12', unit: '次', note: '站级均值 2 次', tone: 'danger' },
        { label: '全站占比', value: '71', unit: '%', note: '阈值 30%', tone: 'danger' },
        { label: '防反二极管压降', value: '0.82', unit: 'V', note: '基线 0.45 V', tone: 'warning' },
        { label: '发现时间', value: '08:31', note: 'SCADA / 事件聚类', tone: 'normal' },
      ],
      device: [['设备', 'ZLS-PV-07'], ['组串电压', '1,012 V · 正常'], ['辐照 / 环境', '132 W/m² · 晨间低辐照'], ['采集窗口', '近 30 日 · 事件聚类']],
      evidence: [
        { source: 'SCADA', label: '反灌事件序列 12 条', value: '已归档' },
        { source: '事件聚类', label: '时段分布分析', value: '已归档' },
        { source: '回路测试', label: '防反回路损耗对比', value: '已归档' },
      ],
    },
    stage2: {
      metrics: [
        { label: '衰减置信度', value: '87', unit: '%', note: '超过确诊阈值 85%', tone: 'success' },
        { label: '候选原因', value: '4', unit: '项', note: '击穿 / 接反 / PID / 采集' },
        { label: '交叉证据', value: '3', unit: '源', note: 'SCADA · 聚类 · 回路测试' },
      ],
      threshold: '85%',
      causes: [['防反二极管击穿', '87%', 87, 'warning'], ['组串极性接反', '8%', 8, 'muted'], ['组件 PID 衰减', '5%', 5, 'muted'], ['采集模块故障', '2%', 2, 'muted']],
      note: '防反回路衰减置信度已超过 85% 确诊阈值，建议进入技术负责人复核。',
      // 异常数据票图表：第一行 2 张（反灌告警 / 早晚时段占比），第二行 3 张（防反压降曲线 / 回路损耗 / 日发电损害）
      diagnosis: [
        { node: '反灌告警 12 次', type: 'bars', wide: true, headline: { value: '12', unit: '次', note: '站级均值 2 次', tone: 'danger' }, caption: '近 30 日反灌事件聚类统计', rows: [
          { label: '#7 方阵', value: '12 次', pct: 100, tone: 'danger' },
          { label: '站级均值', value: '2 次', pct: 17 },
        ] },
        { node: '早晚时段占 71%', type: 'daydist', wide: true, headline: { value: '71', unit: '%', note: '6-9 时 / 17-20 时窗口', tone: 'danger' }, caption: '反灌事件集中于早晚低辐照窗口',
          values: [2, 2, 1, 1, 1, 3, 55, 90, 70, 18, 8, 6, 5, 5, 6, 8, 14, 60, 85, 62, 16, 6, 3, 2],
          hot: [6, 7, 8, 17, 18, 19] },
        { node: '防反压降 0.82V', type: 'curve', caption: '30 日防反二极管正向压降趋势', threshold: '衰减阈值 0.60 V',
          points: [0.45, 0.46, 0.46, 0.47, 0.48, 0.5, 0.52, 0.55, 0.58, 0.62, 0.66, 0.7, 0.74, 0.78, 0.82] },
        { node: '回路损耗 1.9 倍', type: 'bars', caption: '回路损耗对比测试', rows: [
          { label: '健康组串', value: '1.0×', pct: 53 },
          { label: '#7 方阵', value: '1.9×', pct: 100, tone: 'danger' },
        ] },
        { node: '日发电损害 1.8%', type: 'stat', value: '-1.8', unit: '%', note: '约 ¥940 / 日', tone: 'danger', caption: '反灌造成的发电损失' },
      ],
      conclusion: ['#7 方阵防反二极管性能衰减，低辐照时段形成组串反灌回路', '反灌集中于早晚低辐照时段，随机波动与接线因素已排除。'],
      kv: [['建议措施', '更换防反二极管并复紧回路接线'], ['复测要求', '更换后连续 7 日反灌事件监测'], ['关联事件', ids.event]],
    },
    // 数据收集卡：正常 vs 异常对比图表（折线/柱状/热力/桑基/离散/雷达），口径同 stage1/stage2
    collection: {
      summary: [
        { text: '已汇集 #7 方阵近 30 日 SCADA 与回路测试数据：' },
        { text: '7 号组串', tone: 'danger' },
        { text: ' 在早晚低辐照时段电流反向（' },
        { text: '反灌 12 次', tone: 'danger' },
        { text: '，站级均值 2 次），防反二极管' },
        { text: '压降 0.82V', tone: 'warning' },
        { text: ' 超 0.60V 阈值，回路损耗为健康组串 ' },
        { text: '1.9 倍', tone: 'danger' },
        { text: '。' },
      ],
      line: {
        title: '晨间组串电流对比（6-9 时）', unit: 'A',
        axis: ['6:00', '6:45', '7:30', '8:15', '9:00'],
        normal: [0.2, 1.8, 3.6, 5.2, 6.4],
        abnormal: [-1.6, -2.4, -1.2, 1.8, 4.2],
        abnormalFrom: 0, abnormalTo: 2,
        caption: '7 号组串 6-7:30 电流反向（负值红区），正常组串随辐照平稳上升',
      },
      bar: {
        title: '各组串近 30 日反灌次数', unit: '次', average: 2,
        items: [
          { label: '组串 1', value: 0 }, { label: '组串 2', value: 1 },
          { label: '组串 3', value: 0 }, { label: '组串 4', value: 1 },
          { label: '组串 5', value: 0 }, { label: '组串 6', value: 0 },
          { label: '组串 7', value: 12, alert: true }, { label: '组串 8', value: 0 },
        ],
        caption: '7 号组串反灌 12 次，6 倍于站级均值 2 次',
      },
      heat: {
        title: '#7 方阵防反压降热力', rows: 8, cols: 12,
        rowAlert: 6,
        values: Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 12 }, (_, col) =>
            row === 6 ? 0.78 + ((col * 7) % 5) * 0.05 : 0.08 + ((row * 3 + col * 5) % 6) * 0.03,
          ),
        ),
        caption: '7 号组串整行压降 0.75V 以上，其余组串维持 0.45V 基线',
      },
      sankey: {
        title: '反灌电流流向',
        columns: [['7 号组串', '其他组串 ×7'], ['直流汇流箱'], ['逆变器 → 电网']],
        flows: [
          { from: [0, 1], to: [1, 0], value: 6, label: '正向 52 A' },
          { from: [1, 0], to: [0, 0], value: 1.4, alert: true, label: '反灌 2.4 A' },
          { from: [1, 0], to: [2, 0], value: 6 },
        ],
        caption: '红色为汇流箱向 7 号组串的反向电流，低辐照时段形成反灌回路',
      },
      scatter: {
        title: '组串电流-电压离散分布',
        xLabel: '组串电流 (A)', yLabel: '组串电压 (V)',
        points: makeScatterPoints({
          seed: 20260820, count: 138, x: [6.8, 8.6], y: [960, 1030],
          alertCount: 12, alertX: [-2.6, -1.2], alertY: [990, 1025],
        }),
        caption: '150 个组串采样点：12 个红点电流反向（负值），为反灌组串',
      },
      radar: {
        title: '7 号组串健康画像',
        axes: ['压降', '回路损耗', '绝缘', '温度', '电流一致性', '反灌频次'],
        normal: [0.9, 0.85, 0.9, 0.85, 0.9, 0.95],
        abnormal: [0.3, 0.35, 0.8, 0.7, 0.4, 0.2],
        caption: '红色为 7 号组串健康度，压降 / 损耗 / 反灌频次严重劣化',
      },
    },
    // 根因分析流程：根节点现象 → 候选分支 → 验证链 → 保留/排除 → 收敛结论
    rootCauseFlow: {
      root: { cards: ['晨间电流反向（6:00-7:30 负值区）', '反灌告警 12 次（站级均值 2 次）', '防反压降整行 0.75V 以上（基线 0.45V）', '汇流箱向 7 号组串反灌 2.4A', '12 个采样点电流反向（负值簇）', '压降、损耗、反灌频次严重劣化'] },
      branches: [
        {
          hypothesis: '防反二极管击穿',
          kept: true,
          confidence: '62%',
          chain: [
            {
              title: '正向压降实测',
              desc: '回路损耗高出 1.9 倍',
              confidence: '74%',
              chart: {
                unit: 'V',
                aria: '正向压降对比：本串 0.82V，正常值 0.45V',
                items: [
                  { label: '本串', value: 0.82, alert: true },
                  { label: '正常值', value: 0.45 },
                ],
              },
            },
            {
              title: '反灌时段分析',
              desc: '71% 反灌集中在早晚低辐照时段，符合二极管反向泄漏特征',
              confidence: '83%',
              chart: {
                type: 'line',
                aria: '24 小时反灌电流曲线：早晚双峰，正午平缓，早晚时段阴影高亮',
                series: [{ name: '反灌电流', tone: 'danger', points: REFLUX_CURVE_24H }],
                shadeRanges: [[0, 8], [17, 23]],
                xLabels: [
                  { at: 0, label: '凌晨' },
                  { at: 6, label: '日出' },
                  { at: 12, label: '正午' },
                  { at: 18, label: '日落' },
                  { at: 23, label: '夜间' },
                ],
              },
            },
            { title: '红外温度比对', desc: '防反回路接线盒温度高于邻串 6.8℃，击穿发热特征吻合', confidence: '87%' },
          ],
        },
        {
          hypothesis: '组串极性接反',
          kept: false,
          confidence: '30%',
          chain: [
            {
              title: '现场钳形表实测',
              desc: '两个数对得上，数据真实',
              confidence: '14%',
              table: [
                { label: '现场实测', value: '-8.2A' },
                { label: '后台数据', value: '-8.5A' },
              ],
            },
            { title: '逆变器自检日志', desc: '没有报过"极性接反"', confidence: '5%' },
          ],
        },
        {
          hypothesis: '组件 PID 衰减',
          kept: false,
          confidence: '24%',
          chain: [
            {
              title: '绝缘阻抗检测',
              desc: '组串对地阻值正常，无 PID 衰减特征',
              confidence: '11%',
              chart: {
                type: 'gauge',
                value: 0.84,
                aria: '绝缘阻抗检测：指针落在绿色高阻区，阻值正常',
                zones: [
                  { to: 0.3, tone: 'danger', label: '低阻·异常' },
                  { to: 0.6, tone: 'warn', label: '中阻·警戒' },
                  { to: 1, tone: 'ok', label: '高阻·正常' },
                ],
              },
            },
            {
              title: '功率曲线比对',
              desc: '无渐进性衰减过程，异常为近期突变，特征不符',
              confidence: '4%',
              chart: {
                type: 'line',
                aria: '近 30 天功率曲线：故障串与正常串前 27 天重叠，第 28 天故障串突降',
                series: [
                  { name: '正常串', tone: 'ok', points: POWER_CURVE_NORMAL },
                  { name: '故障串', tone: 'danger', points: POWER_CURVE_FAULT },
                ],
                markIndex: 27,
                markLabel: '第 28 天突变',
                xLabels: [
                  { at: 0, label: '第 1 天' },
                  { at: 29, label: '第 30 天' },
                ],
              },
            },
          ],
        },
      ],
    },
    // 诊断结论卡处理建议：点击行为与左侧对话的处置按钮一致
    conclusionActions: [
      { key: 'A', label: '派人员检修（转工单）', icon: 'clipboard', action: 'approve', recommended: true, desc: '推荐：当日派单止损最快，更换防反二极管 12 支，停机约 12 min' },
      { key: 'B', label: '人工巡检复核', icon: 'user', action: 'manual', desc: '零成本纳入下次人工巡检，但依赖人工周期，损耗 ¥940/日 持续累积' },
      { key: 'C', label: '无人机巡检复核', icon: 'drone', action: 'drone', desc: '红外复核防反回路后再处置更稳妥，需等排期约 1 天，期间损耗持续' },
      { key: 'D', label: '挂起', icon: 'pause', action: 'suspend', desc: '不占用资源，但防反回路进一步劣化，可能引发回路烧损与停机' },
    ],
    // 诊断结论面板：根因/风险摘要 + 四个处理方式选项卡（替换原诊断结论卡片组）
    conclusionPanel: {
      summary: [
        { label: '根因', value: '防反二极管击穿失效，挡不住反向电流；早晚本串电压低时，旁边组串的电流就倒灌进来', wide: true },
        { label: '风险', value: '持续反灌加速二极管热劣化，可能烧坏逆变器，建议今天处理' },
        { label: '告警等级', value: 'III 级 / 一般缺陷', tone: 'warning' },
      ],
      options: [
        {
          icon: 'clipboard',
          title: '转工单现场检修',
          duration: '约 2 小时',
          lines: ['立即消除反灌风险，当天恢复发电', '不处理：故障持续，可能损坏逆变器'],
          buttons: [{ label: '立即转工单', action: 'approve', primary: true }],
        },
        {
          icon: 'drone',
          title: '无人机拍照复核',
          duration: '约 20 分钟出结果',
          lines: ['确认击穿 → 转工单检修', '不符合 → 取消工单，重新分析'],
          buttons: [{ label: '派无人机', action: 'drone', primary: true }],
        },
        {
          icon: 'user',
          title: '巡检员现场复核',
          duration: '约 40 分钟',
          lines: ['比无人机慢，但能顺带发现接线盒烧坏、线缆破损'],
          buttons: [{ label: '派人巡检', action: 'manual', primary: true }],
        },
      ],
    },
    stage3: {
      trendAria: '30 日反灌次数从 2 次上升至 12 次',
      trendKv: [['30 日反灌次数', '2 → 12 次'], ['防反二极管压降', '0.45 → 0.82 V'], ['站级同类均值', '2 次 / 季'], ['数据完整性', '99.2% · 无缺口']],
      cost: [['当前发电损耗', '-1.8%'], ['预计经济损失', '¥ 940 / 日'], ['风险等级', 'III 级 / 一般'], ['未处置后果', '二极管热劣化可能引发回路烧损与停机']],
      suggestion: 'AI 建议：确认缺陷并纳入计划性检修窗口处理。',
    },
    chain: [
      '近 30 日反灌 12 次，远超站级同类均值 2 次',
      '71% 反灌事件集中于早晚低辐照时段，排除随机波动',
      '防反二极管正向压降升至 0.82V，回路损耗高 1.9 倍',
      '三源证据交叉验证置信度 87%，超过 85% 确诊阈值',
    ],
    defect: {
      title: '光伏组串反灌缺陷单',
      metrics: [
        { label: '缺陷类别', value: 'III 级 / 一般缺陷', tone: 'warning' },
        { label: '故障类别', value: '组串反灌' },
        { label: '缺陷状态', value: '待确认转工单' },
        { label: '发现日期', value: '2026-08-20' },
        { label: '发现单位', value: '雅砻江流域集控中心' },
        { label: '发现人', value: '运维值班员 王磊' },
        { label: '场站名称', value: '扎拉山光储电站' },
        { label: '缺陷单编号', value: ids.defect },
      ],
      info: ['#7 方阵组串防反回路', '季度反灌 12 次 · 早晚低辐照时段集中 71%'],
      measure: ['更换防反二极管', '更换 #7 方阵防反二极管并复紧回路接线，复测回路损耗与反灌事件'],
      root: ['防反二极管性能衰减', '需更换 #7 方阵防反二极管 12 支，并复紧回路接线。'],
      cost: [['当前发电损耗', '-1.8%'], ['预计经济损失', '¥ 940 / 日'], ['未处置后果', '二极管热劣化可能引发回路烧损与停机']],
    },
    stage5: {
      metrics: [
        { label: '执行班组', value: '川西检修二组', note: '李强 · 赵鹏' },
        { label: '作业窗口', value: '2026-08-22', note: '计划检修窗口' },
        { label: '工单编号', value: ids.workOrder, note: '批准后进入排程' },
        { label: '风险等级', value: 'III', unit: '级', note: '一般缺陷', tone: 'warning' },
      ],
      checklist: ['复测防反二极管压降并标记衰减支路', '#7 方阵直流回路停电并验电挂牌', '更换防反二极管 12 支', '复电并开展 7 日反灌监测'],
      acceptance: '反灌事件 ≤5 次/周 · 回路压降 ≤0.5V',
    },
    stage7: {
      metrics: [
        { label: '候选排程', value: 'A', note: '2026-08-22' },
        { label: '人员可用', value: '2 / 2', note: '川西检修二组', tone: 'success' },
        { label: '资源可用', value: '3 / 3', note: '备件 / 工器具 / 车辆', tone: 'success' },
        { label: '冲突检查', value: '通过', note: '无重叠任务', tone: 'success' },
      ],
      summary: [['关联工单', ids.workOrder], ['作业地点', '扎拉山光储电站 · #7 方阵'], ['作业窗口', '2026-08-22'], ['预计影响', '停机 12 min · 0.18 MW']],
      checks: ['人员班组可用，无重叠工单', '防反二极管 12 支已锁定至仓位 Z-02', '安全工器具与车辆已预约'],
    },
    permits: {
      workTitle: '光伏组串反灌消缺工作票',
      procTitle: '防反二极管更换工序单',
      opTitle: '直流回路停送电操作票',
      workSummary: [
        { label: '执行班组', value: '李强 · 赵鹏', note: '川西检修二组' },
        { label: '作业窗口', value: '2026-08-22' },
        { label: '总人数', value: '2', unit: '人' },
        { label: '单号', value: ids.workPermit },
        { label: '工作内容', value: '更换 #7 方阵防反二极管并复测回路损耗', wide: true },
      ],
      opSummary: [
        { label: '执行班组', value: '周凯', note: '集控中心' },
        { label: '作业窗口', value: '2026-08-22' },
        { label: '总人数', value: '1', unit: '人' },
        { label: '单号', value: ids.operationPermit },
        { label: '工作内容', value: 'ZLS-CB-07 直流回路停电与挂牌', wide: true },
      ],
    },
    stage9: {
      workAlert: ['工序单验电位置已明确', '已注明"#7 方阵汇流箱直流母排"，AI 审核通过。'],
      opAlert: ['操作票第 3 项装设接地线未注明接地点编号', '建议补充 #7 方阵汇流箱接地点位置，避免现场执行歧义。'],
    },
    stage10: {
      route: { dest: '扎拉山光储电站', km: '358 km', dur: '4h05', advice: '建议 09:00 出发 · 13:05 到场' },
      checklist: [
        { label: '成都驻地出发，导航至扎拉山', state: 'done', note: '09:00 · 358 km / 4h05' },
        { label: '到场确认设备 ZLS-PV-07', state: 'done', note: '13:08 · 定位一致' },
        { label: '直流回路停电、验电并挂牌', state: 'done', note: '13:24 · 安全措施完成' },
        { label: '更换防反二极管 12 支并记录型号', state: 'done', note: '等待现场回执' },
        { label: '复电、复测回路损耗并回传证据', state: 'done', note: '待复测验证' },
      ],
    },
    stage11: {
      metrics: [
        { label: '周反灌次数', value: '2', unit: '次', note: '验收 ≤5 次/周', tone: 'success' },
        { label: '回路压降', value: '0.44', unit: 'V', note: '验收 ≤0.5V', tone: 'success' },
        { label: '回路损耗', value: '1.0', unit: 'x', note: '恢复基线', tone: 'success' },
      ],
      comparison: [
        ['周反灌次数', '42 次', '2 次', '-40 次'],
        ['防反二极管压降', '0.82 V', '0.44 V', '-0.38 V'],
        ['回路损耗倍数', '1.9x', '1.0x', '-0.9x'],
      ],
    },
    stage12: {
      metrics: [
        { label: '关单通知', value: '已生成', note: '等待运维负责人批准', tone: 'warning' },
        { label: '关联证据', value: '8', unit: '项', note: '数据 / 记录 / 票证' },
        { label: '验收结果', value: '通过', note: '3 项指标均达标', tone: 'success' },
      ],
      notice: [['工单编号', ids.workOrder], ['缺陷单编号', ids.defect], ['处置结论', '防反二极管更换完成，反灌事件回归基线'], ['通知对象', '技术负责人 · 现场工程师 · 集控值班']],
      evidence: ['现场照片与二极管型号记录', '停送电与两票执行记录', '处置前后反灌事件统计', '回路压降与损耗复测报告'],
      acceptance: '反灌事件 ≤5 次/周 · 回路压降 ≤0.5V',
    },
    stage13: {
      phases: [
        ['发现', '异常感知', '季度反灌 12 次 · 占比 71%'],
        ['诊断', 'AI 诊断', '衰减置信度 87% · 根因锁定'],
        ['处置', '现场工程师', '更换防反二极管 12 支'],
        ['结果', '复测验证', '周反灌 2 次 · 压降 0.44V'],
      ],
      sla: [
        { stage: '异常诊断', planned: '≤30 min', actual: '22 min', met: true },
        { stage: '派单审批', planned: '≤2 h', actual: '1.2 h', met: true },
        { stage: '现场处置', planned: '≤96 h', actual: '118 h', met: false },
        { stage: '复测关单', planned: '≤24 h', actual: '16 h', met: true },
      ],
      accuracy: { conclusion: '防反二极管性能衰减形成反灌回路', confidence: '87%', verified: '更换后周反灌降至 2 次，压降回归正常区间', verdict: '诊断准确' },
      qa: [
        { question: '低辐照时段检修会不会影响发电量考核？', help: '确认检修窗口放在早晚低辐照时段，减少发电损失' },
        { question: '现场忘带同规格防反二极管，库房有没有现货？', help: '确认调拨耗时 4 小时，推动备件预置到站点库房' },
      ],
      lessons: [
        { problem: '处置等待备件调拨 4 小时，导致现场处置超时', rule: '高频损耗备件按站点预置，派单时锁定库存' },
        { problem: '现场忘带同规格防反二极管，临时询问库房', rule: '出发前按缺陷类型推送备件清单核对提醒' },
      ],
      // 无用数据（待确认后删除）：tags 字段无渲染消费
      // tags: [['blue', '组串反灌'], ['blue', '防反二极管'], ['green', '计划检修窗口'], ['neutral', '低辐照时段']],
      similar: '相似案例 4 条 · 已纳入诊断知识库',
      strategy: '低辐照组串反灌识别与防反回路处置',
    },
    docs: {
      defect: {
        type: '缺陷单', title: '光伏组串反灌缺陷单', docNo: ids.defect,
        sections: [{
          rows: [
            ['缺陷编号', ids.defect], ['发现单位', '雅砻江流域集控中心'], ['发现人', '运维值班员 王磊'], ['发现日期', '2026-08-20'],
            ['缺陷类别', 'III 级 / 一般缺陷'], ['责任班组', '川西检修二组'], ['责任人', '李强'], ['厂站', '扎拉山光储电站'],
            ['设备码', 'ZLS-PV-07'], ['设备描述', '#7 方阵组串防反回路'], ['状态', '待确认转工单'], ['故障类别', '组串反灌'],
            ['辅助现象', '季度反灌 12 次 · 早晚低辐照时段集中 71%'], ['工单编号', ids.workOrder], ['对业务影响', '发电损耗 -1.8% · 约 ¥940/日'],
            ['缺陷原因', '防反二极管性能衰减，低辐照时段组串间压差形成反灌回路'],
            ['处理措施', '更换 #7 方阵防反二极管并复紧回路接线，复测回路损耗与反灌事件'],
          ],
        }],
      },
      workOrder: {
        type: '工单', title: '光伏组串反灌消缺工单', docNo: ids.workOrder,
        sections: [{
          rows: [
            ['工单编号', ids.workOrder], ['状态', '待提交'], ['工单类型', '消缺工单'], ['时间窗口', '2026-08-22'],
            ['创建人', '运维值班员 王磊'], ['创建时间', '2026-08-20 09:05'], ['场站', '扎拉山光储电站'], ['班组', '川西检修二组'],
            ['工作负责人', '李强'], ['工作内容', '更换 #7 方阵防反二极管并复紧回路接线，复测回路损耗与反灌事件'],
            ['设备编号', 'ZLS-PV-07'], ['设备名称', '#7 方阵组串防反回路'], ['KKS 编码', 'ZLS-PV-07-CB07'], ['KKS 描述', '扎拉山 #7 方阵汇流箱防反回路'],
          ],
        }],
      },
      work: {
        type: '工作票', title: '光伏组串反灌消缺工作票', docNo: ids.workPermit,
        sections: [
          { title: '临时检修交代', rows: [['编号', 'LSJX-20260820-011'], ['类型', '临时检修交代'], ['创建人', '运维值班员 王磊'], ['提交时间', '2026-08-20 09:10'], ['状态', '待提交'], ['工作票号', ids.workPermit], ['工作票描述', '光伏组串反灌消缺工作票'], ['事由或申请事项', '#7 方阵组串反灌消缺，需申请直流回路停电作业']] },
          { title: '工作票信息', rows: [['工作票编号', ids.workPermit], ['工作票类型', '电气第一种工作票'], ['班组', '川西检修二组'], ['状态', '待提交'], ['工作负责人', '李强'], ['作业窗口', '2026-08-22'], ['总人数', '2 人'], ['工作班人员', '李强 · 赵鹏'], ['工作内容', '更换 #7 方阵防反二极管并复测回路损耗'], ['工作地点', '扎拉山 #7 方阵汇流箱']] },
          { title: '检修工序卡', rows: [['作业范围', '#7 方阵汇流箱防反二极管 12 支'], ['工序内容', '1. 断开 #7 方阵直流回路并验电挂牌\n2. 复测防反二极管正向压降并标记衰减支路\n3. 更换防反二极管并复紧回路接线\n4. 复电并复测回路损耗\n5. 连续 7 日反灌事件监测'], ['完工标准', '反灌事件 ≤5 次/周 · 回路压降 ≤0.5V'], ['预计工时', '120 min']] },
          { title: '遗留问题及备注', rows: [['遗留问题描述', '无'], ['备注', '无']] },
          { title: '安全措施', rows: [['安全措施', '断开 #7 方阵直流回路 · 验电 · 悬挂"禁止合闸"标识 · 接地 · 监护到位']] },
        ],
      },
      proc: {
        type: '工序单', title: '防反二极管更换工序单', docNo: `${ids.workPermit}-P01`,
        sections: [{
          rows: [
            ['作业范围', '#7 方阵汇流箱防反二极管 12 支'],
            ['工序内容', '1. 断开 #7 方阵直流回路并验电挂牌\n2. 复测防反二极管正向压降并标记衰减支路\n3. 更换防反二极管并复紧回路接线\n4. 复电并复测回路损耗\n5. 连续 7 日反灌事件监测'],
            ['完工标准', '反灌事件 ≤5 次/周 · 回路压降 ≤0.5V'], ['预计工时', '120 min'],
          ],
        }],
      },
      op: {
        type: '操作票', title: '直流回路停送电操作票', docNo: ids.operationPermit,
        sections: [{
          rows: [
            ['操作票编号', ids.operationPermit], ['工作班组', '集控中心'], ['时间窗口', '2026-08-22'], ['工作人数', '1 人'],
            ['操作任务', 'ZLS-CB-07 直流回路停电、挂牌与复电'],
            ['操作步骤', '1. 核对设备双重编号\n2. 断开 #7 方阵直流回路开关并验电\n3. 悬挂"禁止合闸"标识牌并装设接地线\n4. 作业结束后拆除接地与标识\n5. 合闸复电并汇报值班员'],
            ['操作人 / 监护人', '周凯 · 班组监护人'],
          ],
        }],
      },
    },
    reviews: {
      op: {
        操作步骤: '操作第 2 项断开直流回路开关未注明开关双重编号，建议补充"ZLS-CB-07 直流进线开关"。',
      },
    },
  }),
  trip: (ids) => ({
    mainTask: '逆变器脱网缺陷处置',
    date: '2026-08-21',
    figure: { alt: '逆变器脱网示意图：交流侧接触器抖动引发保护动作' },
    stage1: {
      metrics: [
        { label: '交流侧峰值电压', value: '1.18', unit: 'p.u.', note: '限值 1.10 p.u.', tone: 'danger' },
        { label: '有功功率', value: '286→0', unit: 'kW', note: '保护性脱网', tone: 'danger' },
        { label: '接触器状态', value: '抖动 3', unit: '次', note: '录波捕获', tone: 'warning' },
        { label: '发现时间', value: '08:09', note: '故障录波 / SCADA', tone: 'normal' },
      ],
      device: [['设备', 'KELA-INV-02-07'], ['直流输入', '1,041 V · 正常'], ['电网频率', '50.02 Hz · 稳定'], ['采集窗口', '故障录波 12 s · 告警序列']],
      evidence: [
        { source: '故障录波', label: '波形 12 s', value: '已归档' },
        { source: 'SCADA', label: '告警序列', value: '已归档' },
        { source: '站端保护', label: '动作记录', value: '已归档' },
      ],
    },
    stage2: {
      metrics: [
        { label: '抖动置信度', value: '89', unit: '%', note: '超过确诊阈值 80%', tone: 'success' },
        { label: '候选原因', value: '3', unit: '项', note: '接触器 / 电网 / 控制板' },
        { label: '交叉证据', value: '3', unit: '源', note: '录波 · SCADA · 保护' },
      ],
      threshold: '80%',
      causes: [['交流接触器抖动', '89%', 89, 'warning'], ['电网瞬时扰动', '7%', 7, 'muted'], ['控制板故障', '4%', 4, 'muted']],
      note: '接触器抖动置信度已超过 80% 确诊阈值，建议进入技术负责人复核。',
      diagnosis: [
        { node: '峰值电压 1.18 p.u.', type: 'bars', caption: '故障录波 12s 越限记录', rows: [
          { label: '保护阈值', value: '1.10 p.u.', pct: 88, tone: 'warning' },
          { label: '实测峰值', value: '1.18 p.u.', pct: 100, tone: 'danger' },
        ] },
        { node: '有功 286→0 kW', type: 'stat', value: '286→0', unit: 'kW', note: '08:09 保护性脱网', tone: 'danger', caption: '脱网瞬间有功跳变' },
        { node: '接触器抖动 3 次', type: 'stat', value: '3', unit: '次/12s', note: '与保护动作时序吻合', tone: 'danger', caption: '交流接触器状态记录' },
        { node: '抖动置信度 89%', type: 'stat', value: '89', unit: '%', note: '确诊阈值 80%', tone: 'success', caption: '录波与站端保护数据交叉验证' },
      ],
      conclusion: ['2区 #07 逆变器交流接触器触点抖动，瞬时过压触发保护性脱网', '录波与站端保护数据一致，电网扰动与控制板因素已排除。'],
      kv: [['建议措施', '检查并更换交流侧接触器'], ['复测要求', '并网后连续 72h 录波监测'], ['关联事件', ids.event]],
    },
    // 数据收集卡：正常 vs 异常对比图表（折线/柱状/热力/桑基/离散/雷达），口径同 stage1/stage2
    collection: {
      summary: [
        { text: '已汇集 2 区 ' },
        { text: '#07 逆变器', tone: 'danger' },
        { text: ' 故障录波 12 s 与 SCADA 告警序列：交流侧峰值电压 ' },
        { text: '1.18 p.u.', tone: 'danger' },
        { text: ' 超 1.10 限值，接触器 12 s 内' },
        { text: '抖动 3 次', tone: 'warning' },
        { text: '，与保护性脱网时序吻合。' },
      ],
      line: {
        title: '交流电压录波对比（12 s）', unit: 'p.u.',
        axis: ['0s', '3s', '6s', '9s', '12s'],
        normal: [1.01, 1.03, 1, 1.02, 1.01, 1.03, 1, 1.02, 1.01, 1.02, 1, 1.01, 1.02],
        abnormal: [1.01, 1.02, 1.05, 1.09, 1.14, 1.18, 1.12, 1.06, 1.03, 1.02, 1.01, 1.01, 1.02],
        abnormalFrom: 2, abnormalTo: 6,
        caption: '3-6 s 电压尖峰冲至 1.18 p.u.（红区），正常曲线稳定在 1.0 附近',
      },
      bar: {
        title: '各逆变器 30 日脱网次数', unit: '次', average: 0.5,
        items: [
          { label: 'INV-01', value: 0 }, { label: 'INV-02', value: 0 },
          { label: 'INV-03', value: 1 }, { label: 'INV-04', value: 0 },
          { label: 'INV-05', value: 0 }, { label: 'INV-06', value: 0 },
          { label: 'INV-07', value: 3, alert: true }, { label: 'INV-08', value: 0 },
        ],
        caption: '#07 逆变器 30 日脱网 3 次，其余设备基本为零',
      },
      heat: {
        title: '2 区逆变器交流峰值电压热力', rows: 2, cols: 8,
        values: [
          [0.22, 0.3, 0.18, 0.26, 0.2, 0.28, 1, 0.24],
          [0.19, 0.25, 0.21, 0.27, 0.23, 0.2, 0.26, 0.22],
        ],
        caption: '仅 #07 峰值电压越限，其余 15 台均稳定在正常区间',
      },
      sankey: {
        title: '交流侧功率流向',
        columns: [['#07 逆变器', '其他逆变器 ×7'], ['箱变'], ['并网点']],
        flows: [
          { from: [0, 1], to: [1, 0], value: 6, label: '2,002 kW' },
          { from: [0, 0], to: [1, 0], value: 1, alert: true, label: '286→0 kW' },
          { from: [1, 0], to: [2, 0], value: 7 },
        ],
        caption: '#07 逆变器输出功率瞬时归零，红色流带表示断流',
      },
      scatter: {
        title: '录波电压-时间离散分布',
        xLabel: '录波时间 (s)', yLabel: '交流电压 (p.u.)',
        points: makeScatterPoints({
          seed: 20260821, count: 140, x: [0, 12], y: [1.0, 1.05],
          alertCount: 10, alertX: [3, 6], alertY: [1.1, 1.18],
        }),
        caption: '150 个录波采样点：3-6s 红点簇电压越限，对应接触器抖动',
      },
      radar: {
        title: '逆变器健康画像',
        axes: ['电压稳定', '频率稳定', '温度', '接触器状态', '绝缘', '效率'],
        normal: [0.9, 0.92, 0.85, 0.9, 0.9, 0.88],
        abnormal: [0.35, 0.85, 0.7, 0.25, 0.85, 0.6],
        caption: '红色为 #07 健康度，电压稳定与接触器状态显著劣化',
      },
    },
    // 根因分析流程：根节点现象 → 候选分支 → 验证链 → 保留/排除 → 收敛结论
    rootCauseFlow: {
      root: { cards: ['3-6s 电压尖峰冲至 1.18 p.u.', '30 日脱网 3 次（其余设备为 0）', '仅 #07 峰值电压越限', '输出功率瞬时归零（286→0 kW）', '3-6s 红点簇电压越限', '电压稳定与接触器状态显著劣化'] },
      branches: [
        {
          hypothesis: '可能是交流侧接触器抖动',
          kept: true,
          confidence: '52%',
          chain: [
            { title: '录波时序比对', desc: '抖动波形与脱网时刻完全吻合', confidence: '74%' },
            { title: '相邻设备排查', desc: '相邻逆变器运行正常，锁定单机故障', confidence: '86%' },
            { title: '触点寿命评估', desc: '触点动作次数已达寿命 80%，接近磨损阈值', confidence: '89%' },
          ],
        },
        {
          hypothesis: '可能是电网扰动',
          kept: false,
          confidence: '32%',
          chain: [
            { title: '电网侧数据比对', desc: '同一母线其他逆变器同期无越限记录', confidence: '14%' },
            { title: '特征比对', desc: '电网扰动为多机同步越限，本次仅单机，特征不符', confidence: '7%' },
          ],
        },
        {
          hypothesis: '可能是控制板故障',
          kept: false,
          confidence: '24%',
          chain: [
            { title: '控制板自检', desc: '采样回路、驱动回路自检均通过', confidence: '10%' },
            { title: '日志核查', desc: '无控制异常或采样漂移告警记录', confidence: '4%' },
          ],
        },
      ],
    },
    // 诊断结论卡处理建议：点击行为与左侧对话的处置按钮一致
    conclusionActions: [
      { key: 'A', label: '派人员检修（转工单）', icon: 'clipboard', action: 'approve', recommended: true, desc: '推荐：尽快更换交流侧接触器，避免再次脱网（单次损失约 320 kWh）' },
      { key: 'B', label: '人工巡检复核', icon: 'user', action: 'manual', desc: '纳入下次人工巡检检查触点，但触点劣化期间可能再次脱网' },
      { key: 'C', label: '无人机巡检复核', icon: 'drone', action: 'drone', desc: '空中巡查交流侧回路状态后再处置，需等排期约 1 天' },
      { key: 'D', label: '挂起', icon: 'pause', action: 'suspend', desc: '不占用资源，但触点持续劣化可能引发频繁脱网与设备损伤' },
    ],
    stage3: {
      trendAria: '30 日脱网次数从 1 次上升至 3 次',
      trendKv: [['30 日脱网次数', '1 → 3 次'], ['交流侧峰值电压', '1.06 → 1.18 p.u.'], ['相邻设备', '运行正常'], ['数据完整性', '99.6% · 无缺口']],
      cost: [['单次脱网损失', '约 320 kWh'], ['预计经济损失', '¥ 1,450 / 次'], ['风险等级', 'II 级 / 重要'], ['未处置后果', '触点持续劣化可能引发频繁脱网与设备损伤']],
      suggestion: 'AI 建议：确认缺陷并尽快安排现场检查接触器。',
    },
    chain: [
      '逆变器 08:09 保护性脱网，相邻设备运行正常，锁定单机故障',
      '故障录波显示交流侧峰值电压 1.18 p.u.，超过 1.10 限值',
      '接触器状态 12 s 内抖动 3 次，与保护动作时序吻合',
      '三源证据交叉验证置信度 89%，超过 80% 确诊阈值',
    ],
    defect: {
      title: '逆变器脱网缺陷单',
      metrics: [
        { label: '缺陷类别', value: 'II 级 / 重要缺陷', tone: 'warning' },
        { label: '故障类别', value: '逆变器脱网' },
        { label: '缺陷状态', value: '待确认转工单' },
        { label: '发现日期', value: '2026-08-20' },
        { label: '发现单位', value: '雅砻江流域集控中心' },
        { label: '发现人', value: '运维值班员 王磊' },
        { label: '场站名称', value: '柯拉一期光伏电站' },
        { label: '缺陷单编号', value: ids.defect },
      ],
      info: ['2区 #07 逆变器交流侧', '交流侧峰值电压 1.18 p.u. · 接触器状态抖动'],
      measure: ['更换接触器', '检查并更换交流侧接触器，完成并网复测与录波确认'],
      root: ['交流接触器触点抖动', '需更换 2区 #07 逆变器交流侧接触器，并测试驱动回路。'],
      cost: [['单次脱网损失', '约 320 kWh'], ['预计经济损失', '¥ 1,450 / 次'], ['未处置后果', '触点持续劣化可能引发频繁脱网与设备损伤']],
    },
    stage5: {
      metrics: [
        { label: '执行班组', value: '川西检修一组', note: '李强 · 王磊' },
        { label: '作业窗口', value: '2026-08-21', note: '低功率窗口' },
        { label: '工单编号', value: ids.workOrder, note: '批准后进入排程' },
        { label: '风险等级', value: 'II', unit: '级', note: '重要缺陷', tone: 'warning' },
      ],
      checklist: ['逆变器停机并交流侧隔离', '检查接触器触点与驱动回路', '更换交流接触器并测试动作', '并网复测与录波确认'],
      acceptance: '并网连续运行 ≥72h · 无保护动作',
    },
    stage7: {
      metrics: [
        { label: '候选排程', value: 'A', note: '2026-08-21' },
        { label: '人员可用', value: '2 / 2', note: '川西检修一组', tone: 'success' },
        { label: '资源可用', value: '3 / 3', note: '备件 / 工器具 / 车辆', tone: 'success' },
        { label: '冲突检查', value: '通过', note: '无重叠任务', tone: 'success' },
      ],
      summary: [['关联工单', ids.workOrder], ['作业地点', '柯拉一期光伏电站 · 2区'], ['作业窗口', '2026-08-21'], ['预计影响', '停机 45 min · 1.2 MW']],
      checks: ['人员班组可用，无重叠工单', '交流接触器 1 台已锁定至仓位 K-11', '安全工器具与车辆已预约'],
    },
    permits: {
      workTitle: '逆变器脱网消缺工作票',
      procTitle: '交流接触器更换工序单',
      opTitle: '逆变器交流侧停送电操作票',
      workSummary: [
        { label: '执行班组', value: '李强 · 王磊', note: '川西检修一组' },
        { label: '作业窗口', value: '2026-08-21' },
        { label: '总人数', value: '2', unit: '人' },
        { label: '单号', value: ids.workPermit },
        { label: '工作内容', value: '检查并更换交流侧接触器，完成并网复测', wide: true },
      ],
      opSummary: [
        { label: '执行班组', value: '周凯', note: '集控中心' },
        { label: '作业窗口', value: '2026-08-21' },
        { label: '总人数', value: '1', unit: '人' },
        { label: '单号', value: ids.operationPermit },
        { label: '工作内容', value: 'KELA-INV-02-07 交流侧停电与挂牌', wide: true },
      ],
    },
    stage9: {
      workAlert: ['工序单隔离范围已明确', '已注明"逆变器交流侧出线开关及二次回路"，AI 审核通过。'],
      opAlert: ['操作票第 3 项装设接地线未注明接地点编号', '建议补充 2 区配电室接地点编号，避免现场执行歧义。'],
    },
    stage10: {
      route: { dest: '柯拉一期光伏电站', km: '412 km', dur: '4h50', advice: '建议 09:00 出发 · 13:50 到场' },
      checklist: [
        { label: '成都驻地出发，导航至柯拉一期', state: 'done', note: '09:00 · 412 km / 4h50' },
        { label: '到场确认设备 KELA-INV-02-07', state: 'done', note: '13:52 · 定位一致' },
        { label: '交流侧停电、验电并挂牌', state: 'done', note: '14:10 · 安全措施完成' },
        { label: '更换交流接触器并测试动作', state: 'done', note: '等待现场回执' },
        { label: '并网复测、录波回传作业证据', state: 'done', note: '待复测验证' },
      ],
    },
    stage11: {
      metrics: [
        { label: '并网运行', value: '72', unit: 'h', note: '无保护动作', tone: 'success' },
        { label: '交流峰值电压', value: '1.05', unit: 'p.u.', note: '限值 1.10 p.u.', tone: 'success' },
        { label: '接触器动作', value: '稳定', note: '录波复测通过', tone: 'success' },
      ],
      comparison: [
        ['30 日脱网次数', '3 次', '0 次', '-3 次'],
        ['交流侧峰值电压', '1.18 p.u.', '1.05 p.u.', '-0.13 p.u.'],
        ['接触器状态', '抖动 3 次', '稳定', '恢复正常'],
      ],
    },
    stage12: {
      metrics: [
        { label: '关单通知', value: '已生成', note: '等待运维负责人批准', tone: 'warning' },
        { label: '关联证据', value: '8', unit: '项', note: '数据 / 录波 / 票证' },
        { label: '验收结果', value: '通过', note: '3 项指标均达标', tone: 'success' },
      ],
      notice: [['工单编号', ids.workOrder], ['缺陷单编号', ids.defect], ['处置结论', '接触器更换完成，并网连续运行 72h 无脱网'], ['通知对象', '技术负责人 · 现场工程师 · 集控值班']],
      evidence: ['现场照片与接触器铭牌', '停送电与两票执行记录', '处置前后故障录波对比', '72h 并网运行监测报告'],
      acceptance: '并网连续运行 ≥72h · 无保护动作',
    },
    stage13: {
      phases: [
        ['发现', '异常感知', '保护性脱网 · 峰值 1.18 p.u.'],
        ['诊断', 'AI 诊断', '抖动置信度 89% · 根因锁定'],
        ['处置', '现场工程师', '更换交流接触器 · 动作测试'],
        ['结果', '复测验证', '并网 72h · 峰值 1.05 p.u.'],
      ],
      sla: [
        { stage: '异常诊断', planned: '≤30 min', actual: '14 min', met: true },
        { stage: '派单审批', planned: '≤2 h', actual: '1.6 h', met: true },
        { stage: '现场处置', planned: '≤48 h', actual: '20 h', met: true },
        { stage: '复测关单', planned: '≤72 h', actual: '74 h', met: false },
      ],
      accuracy: { conclusion: '交流接触器触点劣化抖动', confidence: '89%', verified: '更换接触器后并网 72h 无脱网，录波峰值回归正常', verdict: '诊断准确' },
      qa: [
        { question: '故障录波文件在现场笔记本上，怎么回传归档？', help: '确认离线回传通道，推动现场证据自动同步规则' },
        { question: '夜间并网复测照明不足，能否推迟到白天？', help: '确认复测窗口调整权限，推动排程默认避开夜间作业' },
      ],
      lessons: [
        { problem: '现场证据靠人工回传，录波文件滞留本地一天', rule: '现场证据到场自动同步，断网时本地缓存补传' },
        { problem: '并网复测排在夜间，照明不足临时改期', rule: '排程默认避开夜间作业窗口，特殊情况需审批确认' },
      ],
      // 无用数据（待确认后删除）：tags 字段无渲染消费
      // tags: [['blue', '逆变器脱网'], ['blue', '交流接触器'], ['green', '故障录波'], ['neutral', '并网复测']],
      similar: '相似案例 3 条 · 已纳入诊断知识库',
      strategy: '逆变器保护性脱网诊断与接触器更换',
    },
    docs: {
      defect: {
        type: '缺陷单', title: '逆变器脱网缺陷单', docNo: ids.defect,
        sections: [{
          rows: [
            ['缺陷编号', ids.defect], ['发现单位', '雅砻江流域集控中心'], ['发现人', '运维值班员 王磊'], ['发现日期', '2026-08-20'],
            ['缺陷类别', 'II 级 / 重要缺陷'], ['责任班组', '川西检修一组'], ['责任人', '李强'], ['厂站', '柯拉一期光伏电站'],
            ['设备码', 'KELA-INV-02-07'], ['设备描述', '2区 #07 逆变器交流侧'], ['状态', '待确认转工单'], ['故障类别', '逆变器脱网'],
            ['辅助现象', '交流侧峰值电压 1.18 p.u. · 接触器状态抖动 3 次'], ['工单编号', ids.workOrder], ['对业务影响', '单次脱网损失约 320 kWh · 约 ¥1,450/次'],
            ['缺陷原因', '交流接触器触点劣化抖动，瞬时过压触发保护性脱网'],
            ['处理措施', '检查并更换交流侧接触器，完成并网复测与录波确认'],
          ],
        }],
      },
      workOrder: {
        type: '工单', title: '逆变器脱网消缺工单', docNo: ids.workOrder,
        sections: [{
          rows: [
            ['工单编号', ids.workOrder], ['状态', '待提交'], ['工单类型', '消缺工单'], ['时间窗口', '2026-08-21'],
            ['创建人', '运维值班员 王磊'], ['创建时间', '2026-08-20 09:35'], ['场站', '柯拉一期光伏电站'], ['班组', '川西检修一组'],
            ['工作负责人', '李强'], ['工作内容', '检查并更换交流侧接触器，完成并网复测与录波确认'],
            ['设备编号', 'KELA-INV-02-07'], ['设备名称', '2区 #07 逆变器'], ['KKS 编码', 'KELA-INV-02-07-AC01'], ['KKS 描述', '柯拉一期 2区 #07 逆变器交流侧'],
          ],
        }],
      },
      work: {
        type: '工作票', title: '逆变器脱网消缺工作票', docNo: ids.workPermit,
        sections: [
          { title: '临时检修交代', rows: [['编号', 'LSJX-20260820-012'], ['类型', '临时检修交代'], ['创建人', '运维值班员 王磊'], ['提交时间', '2026-08-20 09:40'], ['状态', '待提交'], ['工作票号', ids.workPermit], ['工作票描述', '逆变器脱网消缺工作票'], ['事由或申请事项', '2区 #07 逆变器保护性脱网，需申请交流侧停电检查']] },
          { title: '工作票信息', rows: [['工作票编号', ids.workPermit], ['工作票类型', '电气第一种工作票'], ['班组', '川西检修一组'], ['状态', '待提交'], ['工作负责人', '李强'], ['作业窗口', '2026-08-21'], ['总人数', '2 人'], ['工作班人员', '李强 · 王磊'], ['工作内容', '检查并更换交流侧接触器，完成并网复测'], ['工作地点', '柯拉一期 2区 #07 逆变器']] },
          { title: '检修工序卡', rows: [['作业范围', '2区 #07 逆变器交流侧接触器 1 台'], ['工序内容', '1. 逆变器停机并断开交流侧出线开关\n2. 验电挂牌并隔离二次回路\n3. 检查触点烧蚀情况并更换接触器\n4. 核对驱动回路接线并测试动作\n5. 合闸并网并录波复测'], ['完工标准', '并网连续运行 ≥72h · 无保护动作'], ['预计工时', '150 min']] },
          { title: '遗留问题及备注', rows: [['遗留问题描述', '无'], ['备注', '无']] },
          { title: '安全措施', rows: [['安全措施', '断开交流侧出线开关 · 验电 · 悬挂"禁止合闸"标识 · 二次回路隔离 · 监护到位']] },
        ],
      },
      proc: {
        type: '工序单', title: '交流接触器更换工序单', docNo: `${ids.workPermit}-P01`,
        sections: [{
          rows: [
            ['作业范围', '2区 #07 逆变器交流侧接触器 1 台'],
            ['工序内容', '1. 逆变器停机并断开交流侧出线开关\n2. 验电挂牌并隔离二次回路\n3. 检查触点烧蚀情况并更换接触器\n4. 核对驱动回路接线并测试动作\n5. 合闸并网并录波复测'],
            ['完工标准', '并网连续运行 ≥72h · 无保护动作'], ['预计工时', '150 min'],
          ],
        }],
      },
      op: {
        type: '操作票', title: '逆变器交流侧停送电操作票', docNo: ids.operationPermit,
        sections: [{
          rows: [
            ['操作票编号', ids.operationPermit], ['工作班组', '集控中心'], ['时间窗口', '2026-08-21'], ['工作人数', '1 人'],
            ['操作任务', 'KELA-INV-02-07 交流侧停电、挂牌与复电'],
            ['操作步骤', '1. 核对设备双重编号\n2. 断开交流侧出线开关并验电\n3. 悬挂"禁止合闸"标识牌并装设接地线\n4. 作业结束后拆除接地与标识\n5. 合闸并网并汇报值班员'],
            ['操作人 / 监护人', '周凯 · 班组监护人'],
          ],
        }],
      },
    },
    reviews: {
      op: {
        操作步骤: '操作第 5 项合闸并网未注明并网前录波确认要求，建议补充"合闸前启动故障录波"。',
      },
    },
  }),
}

/**
 * 解析当前缺陷单的演示内容：单据编号 + 13 步流程文案 + 单据 PDF 内容
 */
function contentFor(ticket) {
  const key = demoKeyFor(ticket)
  const ids = { ...DEFECT_IDS[key], ...(ticket?.workflowIds ?? {}) }
  return { key, ids, ...DEFECT_BUILDERS[key](ids) }
}

// 班组与执行人员的下拉选项，工单 / 工作票 / 操作票编辑弹窗共用
const CREW_OPTIONS = ['川西检修一组', '川西检修二组', '巡检班', '继保班', '集控中心']
const PERSON_OPTIONS = ['张斌', '李强', '赵鹏', '周凯', '王磊']
const MEMBER_OPTIONS = ['李强 · 赵鹏', '李强 · 王磊', '赵鹏 · 王磊', '李强 · 赵鹏 · 王磊']

const SELECT_OPTIONS_BY_LABEL = {
  班组: CREW_OPTIONS,
  责任班组: CREW_OPTIONS,
  工作班组: CREW_OPTIONS,
  责任人: PERSON_OPTIONS,
  工作负责人: PERSON_OPTIONS,
  执行人员: PERSON_OPTIONS,
  工作班人员: MEMBER_OPTIONS,
}

/**
 * 把单据 PDF 内容的 rows 转成编辑弹窗的输入项，长文本自动用多行输入框
 * 缺陷管理页面复用同一派生规则
 */
export function fieldsFromRows(rows) {
  return (rows ?? []).map(([label, value]) => ({
    key: label,
    label,
    value,
    multiline: String(value).includes('\n') || String(value).length > 30,
    options: SELECT_OPTIONS_BY_LABEL[label],
  }))
}

/**
 * 工作票编辑弹窗的五个分组，检修工序卡字段直接内联为输入项
 */
function workPermitGroups(c) {
  return c.docs.work.sections.map((section) => ({
    title: section.title,
    fields: fieldsFromRows(section.rows).map((field) => ({ ...field, key: `${section.title}:${field.label}` })),
  }))
}

/**
 * 节点头部的操作按钮，默认"编辑"，打开对应单据的输入项弹窗
 */
function EditButton({ onClick, label = '编辑', icon: ActionIcon = PencilLine }) {
  return (
    <button className="ticket-stage-card__edit" type="button" onClick={onClick} aria-haspopup="dialog">
      <ActionIcon size={14} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

/**
 * 通用表单弹窗：AI 预填字段，可编辑并保存到任务
 */
function FieldFormDialog({ type, title, fields, saved, onSave, onClose }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.key, saved?.[field.key] ?? field.value])),
  )

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const save = () => {
    onSave(values)
    onClose()
  }

  return createPortal(
    <div
      className="ticket-stage-pdf-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="ticket-stage-pdf-dialog ticket-stage-doc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-stage-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ticket-stage-pdf-dialog__header">
          <div>
            <span>{type}</span>
            <h3 id="ticket-stage-form-title">{title}</h3>
          </div>
          <button type="button" className="ticket-stage-pdf-dialog__close" onClick={onClose} aria-label="关闭详情">
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="ticket-stage-pdf-dialog__body ticket-stage-doc-dialog__body">
          <div className="ticket-stage-defect-form">
            {fields.map((field) => (
              <label
                className={`ticket-stage-doc-field${field.multiline ? ' ticket-stage-defect-form__wide' : ''}`}
                key={field.key}
              >
                <span>{field.label}</span>
                {field.options ? (
                  <select
                    value={values[field.key]}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  >
                    {field.options.map((option) => <option value={option} key={option}>{option}</option>)}
                  </select>
                ) : field.multiline ? (
                  <textarea
                    value={values[field.key]}
                    rows={3}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                ) : (
                  <input
                    type="text"
                    value={values[field.key]}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
        <footer className="ticket-stage-pdf-dialog__footer">
          <span>{type} · 共 {fields.length} 项字段</span>
          <button type="button" className="ticket-stage-pdf-dialog__download" onClick={save}>
            <Check size={14} aria-hidden="true" />
            保存修改
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

/**
 * 工作票编辑弹窗：分组字段可编辑并保存到任务，检修工序卡字段内联在分组里
 */
function WorkPermitDialog({ c, ticket, onClose }) {
  const { updateTicket, showToast } = useApp()
  const groups = workPermitGroups(c)
  const saved = ticket?.permitDocs?.['work-permit'] ?? {}
  const [values, setValues] = useState(() =>
    Object.fromEntries(groups.flatMap((group) => group.fields).map((field) => [field.key, saved[field.key] ?? field.value])),
  )

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const save = () => {
    updateTicket?.(ticket?.id, {
      permitDocs: { ...(ticket?.permitDocs ?? {}), 'work-permit': values },
    })
    showToast?.('工作票内容已保存')
    onClose()
  }

  return createPortal(
    <div
      className="ticket-stage-pdf-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="ticket-stage-pdf-dialog ticket-stage-doc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-stage-work-permit-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ticket-stage-pdf-dialog__header">
          <div>
            <span>工作票</span>
            <h3 id="ticket-stage-work-permit-title">{c.docs.work.title}</h3>
          </div>
          <button type="button" className="ticket-stage-pdf-dialog__close" onClick={onClose} aria-label="关闭详情">
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="ticket-stage-pdf-dialog__body ticket-stage-doc-dialog__body">
          {groups.map((group) => (
            <div className="ticket-stage-doc-group" key={group.title}>
              <span className="ticket-stage-doc-group__title">{group.title}</span>
              <div className="ticket-stage-defect-form">
                {group.fields.map((field) => (
                  <label
                    className={`ticket-stage-doc-field${field.multiline ? ' ticket-stage-defect-form__wide' : ''}`}
                    key={field.key}
                  >
                    <span>{field.label}</span>
                    {field.options ? (
                      <select
                        value={values[field.key]}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      >
                        {field.options.map((option) => <option value={option} key={option}>{option}</option>)}
                      </select>
                    ) : field.multiline ? (
                      <textarea
                        value={values[field.key]}
                        rows={3}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      />
                    ) : (
                      <input
                        type="text"
                        value={values[field.key]}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <footer className="ticket-stage-pdf-dialog__footer">
          <span>工作票 · 共 {groups.length} 个分组</span>
          <button type="button" className="ticket-stage-pdf-dialog__download" onClick={save}>
            <Check size={14} aria-hidden="true" />
            保存修改
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

/**
 * 缺陷单编辑弹窗：字段由当前缺陷单内容派生
 */
function DefectFormDialog({ c, ticket, onClose }) {
  const { updateTicket, showToast } = useApp()
  return (
    <FieldFormDialog
      type="缺陷单"
      title={c.docs.defect.title}
      fields={fieldsFromRows(c.docs.defect.sections[0].rows)}
      saved={ticket?.defectForm}
      onSave={(values) => {
        updateTicket?.(ticket?.id, { defectForm: values })
        showToast?.('缺陷单内容已保存')
      }}
      onClose={onClose}
    />
  )
}

/**
 * 工单编辑弹窗：字段由当前工单内容派生
 */
function WorkOrderFormDialog({ c, ticket, onClose }) {
  const { updateTicket, showToast } = useApp()
  return (
    <FieldFormDialog
      type="工单"
      title={c.docs.workOrder.title}
      fields={fieldsFromRows(c.docs.workOrder.sections[0].rows)}
      saved={ticket?.workOrderForm}
      onSave={(values) => {
        updateTicket?.(ticket?.id, { workOrderForm: values })
        showToast?.('工单内容已保存')
      }}
      onClose={onClose}
    />
  )
}

/**
 * 操作票编辑弹窗：字段由当前操作票内容派生
 */
function OperationFormDialog({ c, ticket, onClose }) {
  const { updateTicket, showToast } = useApp()
  return (
    <FieldFormDialog
      type="操作票"
      title={c.docs.op.title}
      fields={fieldsFromRows(c.docs.op.sections[0].rows)}
      saved={ticket?.operationForm}
      onSave={(values) => {
        updateTicket?.(ticket?.id, { operationForm: values })
        showToast?.('操作票内容已保存')
      }}
      onClose={onClose}
    />
  )
}

/**
 * 批准节点头部的"查看"按钮，样式与编辑按钮一致，打开只读审批弹窗
 */
function ViewButton({ onClick }) {
  return (
    <button className="ticket-stage-card__edit" type="button" onClick={onClick} aria-haspopup="dialog">
      <Eye size={14} aria-hidden="true" />
      <span>查看</span>
    </button>
  )
}

/**
 * 两票批准查看弹窗：票面字段只读，仅展示 AI 审批建议，底部填写审批意见
 */
function PermitReviewDialog({ c, ticket, doc, onClose }) {
  const { updateTicket, showToast } = useApp()
  const isWork = doc === 'work'
  const docInfo = c.docs[doc]
  const groups = isWork
    ? workPermitGroups(c)
    : [{ title: null, fields: fieldsFromRows(c.docs.op.sections[0].rows) }]
  const reviews = c.reviews?.[doc] ?? {}
  const reviewCount = Object.keys(reviews).length
  const fieldCount = groups.reduce((count, group) => count + group.fields.length, 0)
  const passed = reviewCount === 0
  const suggestionText = Object.values(reviews).join('；')
  const [opinion, setOpinion] = useState(ticket?.permitOpinions?.[doc] ?? '')

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const save = () => {
    updateTicket?.(ticket?.id, {
      permitOpinions: { ...(ticket?.permitOpinions ?? {}), [doc]: opinion },
    })
    showToast?.(`${docInfo.type}审批意见已保存`)
    onClose()
  }

  return createPortal(
    <div
      className="ticket-stage-pdf-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="ticket-stage-pdf-dialog ticket-stage-doc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-stage-review-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ticket-stage-pdf-dialog__header">
          <div>
            <span>{docInfo.type}</span>
            <h3 id="ticket-stage-review-title">{docInfo.title}</h3>
          </div>
          <button type="button" className="ticket-stage-pdf-dialog__close" onClick={onClose} aria-label="关闭详情">
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="ticket-stage-pdf-dialog__body ticket-stage-doc-dialog__body">
          <div className="ticket-stage-review-result">
            <Bot size={17} aria-hidden="true" />
            <div>
              <span>AI 审核结论</span>
              <p>
                {passed
                  ? `已审核以下内容：票面 ${fieldCount} 项内容完整规范，审查通过`
                  : `已审核以下内容：${reviewCount} 项内容需修改，审查不通过，建议发回重填`}
              </p>
            </div>
          </div>
          {groups.map((group, groupIndex) => (
            <div className="ticket-stage-doc-group" key={group.title ?? groupIndex}>
              {group.title ? <span className="ticket-stage-doc-group__title">{group.title}</span> : null}
              <div className="ticket-stage-defect-form">
                {group.fields.map((field) => {
                  const review = reviews[field.label]
                  return (
                    <label
                      className={`ticket-stage-doc-field${field.multiline ? ' ticket-stage-defect-form__wide' : ''}${review ? ' ticket-stage-doc-field--warn' : ''}`}
                      key={field.key}
                    >
                      <span>{field.label}</span>
                      {field.multiline ? (
                        <textarea value={field.value} rows={3} readOnly disabled />
                      ) : (
                        <input type="text" value={field.value} readOnly disabled />
                      )}
                      {review ? (
                        <p className="ticket-stage-doc-field__review">
                          <Sparkles size={12} aria-hidden="true" />
                          <span><b>AI 建议：</b>{review}</span>
                        </p>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="ticket-stage-doc-group">
            <span className="ticket-stage-doc-group__title">审批意见</span>
            <div className="ticket-stage-review-actions">
              <button type="button" className="ticket-stage-card__edit" onClick={() => setOpinion('通过')}>
                <Check size={13} aria-hidden="true" />
                <span>通过</span>
              </button>
              <button type="button" className="ticket-stage-card__edit" onClick={() => setOpinion(suggestionText)} disabled={!suggestionText}>
                <Sparkles size={13} aria-hidden="true" />
                <span>发回重填</span>
              </button>
            </div>
            <textarea
              className="ticket-stage-review-opinion"
              value={opinion}
              rows={3}
              placeholder="填写审批意见：通过，或填需要发回修改的内容"
              onChange={(event) => setOpinion(event.target.value)}
            />
          </div>
        </div>
        <footer className="ticket-stage-pdf-dialog__footer">
          <span>{docInfo.type} · 只读预览</span>
          <button type="button" className="ticket-stage-pdf-dialog__download" onClick={save}>
            <Check size={14} aria-hidden="true" />
            保存审批意见
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

export function StageHeader({ index, contentIndex, stageMeta, isGenerated = false, action }) {
  const meta = { ...(STEP_META[contentIndex] ?? STEP_META[1]), ...(stageMeta ?? {}) }
  return (
    <header className="ticket-stage-content__header">
      <div>
        <h3>{meta.title}</h3>
      </div>
      {action ?? (meta.mode ? (
        <span className={`ticket-stage-content__mode${isGenerated ? ' is-generated' : ''}`}>
          {meta.mode}
        </span>
      ) : null)}
    </header>
  )
}

function StageGeneration({ label, detail, progress }) {
  return (
    <div className="ticket-stage-generation" role="status" aria-live="polite" aria-busy="true">
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

export function MetricGrid({ items }) {
  const count = Math.min(Math.max(items.filter((item) => !item.wide).length, 1), 4)
  return (
    <div className={`ticket-stage-metrics ticket-stage-metrics--${count}`}>
      {items.map((item) => (
        <article className={`ticket-stage-metric${item.tone ? ` is-${item.tone}` : ''}${item.wide ? ' ticket-stage-metric--wide' : ''}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}{item.unit && <small>{item.unit}</small>}</strong>
          {item.note && <em>{item.note}</em>}
        </article>
      ))}
    </div>
  )
}

export function StageCard({ title, eyebrow, icon: Icon = Activity, className = '', action, children }) {
  return (
    <article className={`ticket-stage-card${className ? ` ${className}` : ''}`}>
      <div className="ticket-stage-card__heading">
        <div>
          {eyebrow && <span>{eyebrow}</span>}
          <h4>{title}</h4>
        </div>
        {action ?? <Icon size={16} aria-hidden="true" />}
      </div>
      {children}
    </article>
  )
}

export function KeyValueList({ items }) {
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

export function ConfidenceList({ threshold, causes }) {
  return (
    <div className="ticket-stage-confidence">
      <div className="ticket-stage-confidence__threshold"><span>确诊阈值</span><b>{threshold}</b></div>
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

function MiniTrend({ aria }) {
  return (
    <div className="ticket-stage-trend" role="img" aria-label={aria}>
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

// 故障诊断证据：横向对比条（基线 / 阈值 / 实测）
function EvidenceBars({ rows }) {
  return (
    <ul className="evidence-bars">
      {rows.map((row) => (
        <li key={row.label}>
          <span className="evidence-bars__label">{row.label}</span>
          <i className="evidence-bars__track"><b className={`is-${row.tone ?? 'info'}`} style={{ width: `${row.pct}%` }} /></i>
          <span className="evidence-bars__value">{row.value}</span>
        </li>
      ))}
    </ul>
  )
}

// 故障诊断证据：24 小时事件分布，高亮集中时段
function EvidenceDayDist({ values, hot, caption }) {
  return (
    <div className="evidence-daydist" role="img" aria-label={caption}>
      <div className="evidence-daydist__bars">
        {values.map((value, hour) => (
          <b className={hot.includes(hour) ? 'is-hot' : ''} key={hour} style={{ height: `${Math.max(4, value)}%` }} />
        ))}
      </div>
      <div className="evidence-daydist__axis"><span>0时</span><span>6时</span><span>12时</span><span>18时</span><span>24时</span></div>
    </div>
  )
}

// 异常数据证据：压降趋势曲线，虚线为衰减阈值
function EvidenceCurve({ points, threshold, caption }) {
  const width = 300
  const height = 88
  const padY = 10
  const max = Math.max(...points) * 1.08
  const min = Math.min(...points) * 0.9
  const span = max - min || 1
  const coords = points.map((value, index) => [
    (index / (points.length - 1)) * width,
    padY + (1 - (value - min) / span) * (height - padY * 2),
  ])
  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
  const thresholdValue = Number(String(threshold).match(/[\d.]+/)?.[0])
  const thresholdY = Number.isFinite(thresholdValue)
    ? padY + (1 - (thresholdValue - min) / span) * (height - padY * 2)
    : null
  const [lastX, lastY] = coords[coords.length - 1]
  return (
    <div className="evidence-curve" role="img" aria-label={caption}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {thresholdY != null && <path className="evidence-curve__threshold" d={`M0 ${thresholdY.toFixed(1)}H${width}`} />}
        <path className="evidence-curve__line" d={line} />
        <circle className="evidence-curve__dot" cx={lastX} cy={lastY} r="3.5" />
      </svg>
      <div className="evidence-curve__axis"><span>-30日</span>{threshold ? <em>{threshold}</em> : null}<span>现在</span></div>
    </div>
  )
}

/**
 * 异常数据证据卡：wide 卡占半行（第一行 2 张），其余三张占第二行
 */
function DiagnosisEvidence({ items }) {
  return (
    <div className="diagnosis-evidence">
      {items.map((item) => (
        <div className={`diagnosis-evidence__item${item.wide ? ' diagnosis-evidence__item--wide' : ''}`} key={item.node}>
          <span className="diagnosis-evidence__node">{item.node}</span>
          {item.headline && (
            <div className={`evidence-stat is-${item.headline.tone ?? 'info'}`}>
              <strong>{item.headline.value}<i>{item.headline.unit}</i></strong>
              <span>{item.headline.note}</span>
            </div>
          )}
          {item.type === 'bars' && <EvidenceBars rows={item.rows} />}
          {item.type === 'daydist' && <EvidenceDayDist caption={item.caption} hot={item.hot} values={item.values} />}
          {item.type === 'curve' && <EvidenceCurve caption={item.caption} points={item.points} threshold={item.threshold} />}
          {item.type === 'stat' && (
            <div className={`evidence-stat is-${item.tone ?? 'info'}`}>
              <strong>{item.value}<i>{item.unit}</i></strong>
              <span>{item.note}</span>
            </div>
          )}
          <span className="diagnosis-evidence__caption">{item.caption}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * 数据收集卡图表：全部手写 SVG，异常、阈值与正常基线使用宿主主题令牌。
 */
const COLLECT_SVG_WIDTH = 300
const COLLECT_SVG_HEIGHT = 96
function collectScaleY(value, min, span, padY = 10, height = COLLECT_SVG_HEIGHT) {
  return padY + (1 - (value - min) / span) * (height - padY * 2)
}

function collectLinePath(values, min, span, padY = 10) {
  const stepX = COLLECT_SVG_WIDTH / (values.length - 1)
  return values
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * stepX).toFixed(1)} ${collectScaleY(value, min, span, padY).toFixed(1)}`)
    .join('')
}

// 折线图：异常数据线 vs 历史正常线，异常区段两线间填红
function CollectLineChart({ line }) {
  const { abnormal, abnormalFrom = 0, abnormalTo = abnormal.length - 1, axis = [], normal } = line
  const padY = 10
  const max = Math.max(...normal, ...abnormal) * 1.1
  const min = Math.min(0, ...abnormal) * 1.1
  const span = max - min || 1
  const stepX = COLLECT_SVG_WIDTH / (abnormal.length - 1)
  const segment = abnormal.slice(abnormalFrom, abnormalTo + 1)
  const normalSegment = normal.slice(abnormalFrom, abnormalTo + 1)
  const areaTop = segment.map((value, i) => `${((abnormalFrom + i) * stepX).toFixed(1)} ${collectScaleY(value, min, span, padY).toFixed(1)}`)
  const areaBottom = normalSegment.map((value, i) => `${((abnormalTo - i) * stepX).toFixed(1)} ${collectScaleY(value, min, span, padY).toFixed(1)}`)
  const zeroY = min < 0 ? collectScaleY(0, min, span, padY) : null
  return (
    <div className="collect-chart__plot" role="img" aria-label={line.caption}>
      <svg viewBox={`0 0 ${COLLECT_SVG_WIDTH} ${COLLECT_SVG_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {zeroY != null && <path className="collect-chart__zero" d={`M0 ${zeroY.toFixed(1)}H${COLLECT_SVG_WIDTH}`} />}
        <polygon
          className="collect-chart__alert-area"
          points={`${areaTop.join('L')}L${areaBottom.join('L')}Z`}
        />
        <path className="collect-chart__line is-normal" d={collectLinePath(normal, min, span, padY)} />
        <path className="collect-chart__line is-alert" d={collectLinePath(abnormal, min, span, padY)} />
      </svg>
      <div className="collect-chart__axis">
        {axis.map((label) => <span key={label}>{label}</span>)}
      </div>
    </div>
  )
}

// 柱状图：各设备数据 + 平均值虚线，超平均值的柱标红
function CollectBarChart({ bar }) {
  const padY = 14
  const max = Math.max(bar.average, ...bar.items.map((item) => item.value)) * 1.15
  const slot = COLLECT_SVG_WIDTH / bar.items.length
  const barWidth = slot * 0.52
  const averageY = collectScaleY(bar.average, 0, max, padY)
  return (
    <div className="collect-chart__plot" role="img" aria-label={bar.caption}>
      <svg viewBox={`0 0 ${COLLECT_SVG_WIDTH} ${COLLECT_SVG_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        <path className="collect-chart__average" d={`M0 ${averageY.toFixed(1)}H${COLLECT_SVG_WIDTH}`} />
        {bar.items.map((item, index) => {
          const height = (item.value / max) * (COLLECT_SVG_HEIGHT - padY * 1.6)
          const x = index * slot + (slot - barWidth) / 2
          const y = COLLECT_SVG_HEIGHT - padY * 0.6 - height
          return (
            <g key={item.label}>
              <rect
                className={`collect-chart__bar${item.alert ? ' is-alert' : ''}`}
                height={Math.max(1.5, height).toFixed(1)}
                width={barWidth.toFixed(1)}
                x={x.toFixed(1)}
                y={y.toFixed(1)}
              />
              {item.alert && (
                <text className="collect-chart__bar-value" textAnchor="middle" x={(x + barWidth / 2).toFixed(1)} y={(y - 3).toFixed(1)}>
                  {item.value}
                </text>
              )}
            </g>
          )
        })}
        <text className="collect-chart__average-label" x={COLLECT_SVG_WIDTH - 4} y={averageY - 3} textAnchor="end">
          均值 {bar.average}
          {bar.unit}
        </text>
      </svg>
    </div>
  )
}

// 热力图：用宿主主题表面色与语义告警色插值，明暗主题共用同一结构
function CollectHeatmap({ heat }) {
  const cellW = COLLECT_SVG_WIDTH / heat.cols
  const cellH = COLLECT_SVG_HEIGHT / heat.rows
  const cellColor = (intensity) => {
    const t = Math.max(0, Math.min(1, intensity))
    return `color-mix(in srgb, var(--ops-surface-action) ${((1 - t) * 100).toFixed(0)}%, var(--ops-urgent) ${(t * 100).toFixed(0)}%)`
  }
  return (
    <div className="collect-chart__plot" role="img" aria-label={heat.caption}>
      <svg viewBox={`0 0 ${COLLECT_SVG_WIDTH} ${COLLECT_SVG_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {heat.values.map((rowValues, row) =>
          rowValues.map((value, col) => (
            <rect
              fill={cellColor(value)}
              height={(cellH - 1.5).toFixed(1)}
              key={`${row}-${col}`}
              width={(cellW - 1.5).toFixed(1)}
              x={(col * cellW).toFixed(1)}
              y={(row * cellH).toFixed(1)}
            />
          )),
        )}
      </svg>
      <div className="collect-chart__legend">
        <span>正常</span>
        <i className="collect-chart__legend-bar" />
        <span>异常</span>
      </div>
    </div>
  )
}

// 桑基图：节点列 + 贝塞尔流带，宽度正比流量，alert 流红色（支持反向流）
function CollectSankey({ sankey }) {
  const nodeWidth = 26
  const nodeHeight = 16
  const columnX = (col) => {
    const step = (COLLECT_SVG_WIDTH - nodeWidth) / (sankey.columns.length - 1)
    return col * step
  }
  const nodeAnchor = (col, row) => {
    const count = sankey.columns[col].length
    const segment = COLLECT_SVG_HEIGHT / count
    return segment * row + segment / 2
  }
  const maxValue = Math.max(...sankey.flows.map((flow) => flow.value))
  const flowWidth = (value) => 3 + (value / maxValue) * 9
  return (
    <div className="collect-chart__plot" role="img" aria-label={sankey.caption}>
      <svg viewBox={`0 0 ${COLLECT_SVG_WIDTH} ${COLLECT_SVG_HEIGHT + 14}`} aria-hidden="true">
        {sankey.flows.map((flow, index) => {
          const fromRight = flow.from[0] < flow.to[0]
          const x1 = columnX(flow.from[0]) + (fromRight ? nodeWidth : 0)
          const x2 = columnX(flow.to[0]) + (fromRight ? 0 : nodeWidth)
          const y1 = nodeAnchor(flow.from[0], flow.from[1])
          const y2 = nodeAnchor(flow.to[0], flow.to[1])
          const midX = (x1 + x2) / 2
          return (
            <g key={index}>
              <path
                className={`collect-chart__flow${flow.alert ? ' is-alert' : ''}`}
                d={`M${x1} ${y1}C${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`}
                strokeWidth={flowWidth(flow.value).toFixed(1)}
              />
              {flow.label && (
                <text
                  className={`collect-chart__flow-label${flow.alert ? ' is-alert' : ''}`}
                  textAnchor="middle"
                  x={midX}
                  y={(y1 + y2) / 2 - 4}
                >
                  {flow.label}
                </text>
              )}
            </g>
          )
        })}
        {sankey.columns.map((nodes, col) =>
          nodes.map((label, row) => {
            const x = columnX(col)
            const y = nodeAnchor(col, row) - nodeHeight / 2
            const isAlertNode = sankey.flows.some(
              (flow) => flow.alert && ((flow.from[0] === col && flow.from[1] === row) || (flow.to[0] === col && flow.to[1] === row)),
            )
            return (
              <g key={label}>
                <rect
                  className={`collect-chart__node${isAlertNode ? ' is-alert' : ''}`}
                  height={nodeHeight}
                  rx={2}
                  width={nodeWidth}
                  x={x}
                  y={y}
                />
                <text
                  className="collect-chart__node-label"
                  textAnchor={col === 0 ? 'start' : col === sankey.columns.length - 1 ? 'end' : 'middle'}
                  x={col === 0 ? x : col === sankey.columns.length - 1 ? x + nodeWidth : x + nodeWidth / 2}
                  y={COLLECT_SVG_HEIGHT + 10}
                >
                  {label}
                </text>
              </g>
            )
          }),
        )}
      </svg>
    </div>
  )
}

/**
 * 确定性伪随机散点（LCG 固定种子）：正常簇 + 红色异常簇，用于离散图
 */
function makeScatterPoints({ alertCount, alertX, alertY, count, seed, x, y }) {
  let state = seed
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  const points = []
  for (let i = 0; i < count; i += 1) {
    points.push({ x: x[0] + next() * (x[1] - x[0]), y: y[0] + next() * (y[1] - y[0]) })
  }
  for (let i = 0; i < alertCount; i += 1) {
    points.push({ alert: true, x: alertX[0] + next() * (alertX[1] - alertX[0]), y: alertY[0] + next() * (alertY[1] - alertY[0]) })
  }
  return points
}

// 离散图：150 点二维分布（x/y 轴 + 刻度），红色为异常簇
function CollectScatter({ scatter }) {
  const width = COLLECT_SVG_WIDTH
  const height = 130
  const padL = 34
  const padR = 6
  const padT = 10
  const padB = 20
  const xs = scatter.points.map((point) => point.x)
  const ys = scatter.points.map((point) => point.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const xSpan = xMax - xMin || 1
  const ySpan = yMax - yMin || 1
  const px = (value) => padL + ((value - xMin) / xSpan) * (width - padL - padR)
  const py = (value) => padT + (1 - (value - yMin) / ySpan) * (height - padT - padB)
  const formatTick = (value) => (Math.abs(value) >= 100 ? String(Math.round(value)) : String(Number(value.toFixed(2))))
  const xTicks = [0, 1, 2, 3].map((i) => xMin + (xSpan * i) / 3)
  const yTicks = [0, 1, 2, 3].map((i) => yMin + (ySpan * i) / 3)
  return (
    <div className="collect-chart__plot" role="img" aria-label={scatter.caption}>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <path className="collect-chart__axis-line" d={`M${padL} ${padT}V${height - padB}H${width - padR}`} />
        {xTicks.map((tick) => (
          <g key={`x${tick}`}>
            <path className="collect-chart__axis-tick" d={`M${px(tick).toFixed(1)} ${height - padB}v3`} />
            <text className="collect-chart__axis-value" textAnchor="middle" x={px(tick).toFixed(1)} y={height - padB + 11}>
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {yTicks.map((tick) => (
          <g key={`y${tick}`}>
            <path className="collect-chart__axis-tick" d={`M${padL - 3} ${py(tick).toFixed(1)}h3`} />
            <text className="collect-chart__axis-value" textAnchor="end" x={padL - 5} y={py(tick) + 2.5}>
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {scatter.points.map((point, index) => (
          <circle
            className={`collect-chart__dot${point.alert ? ' is-alert' : ''}`}
            cx={px(point.x).toFixed(1)}
            cy={py(point.y).toFixed(1)}
            key={index}
            r={point.alert ? 2.6 : 1.6}
          />
        ))}
        <text className="collect-chart__axis-title" textAnchor="end" x={width - padR} y={height - 4}>
          {scatter.xLabel}
        </text>
        <text className="collect-chart__axis-title" textAnchor="start" x={2} y={padT - 2}>
          {scatter.yLabel}
        </text>
      </svg>
    </div>
  )
}

// 雷达图：异常红多边形 vs 正常灰多边形
function CollectRadar({ radar }) {
  const width = COLLECT_SVG_WIDTH
  const height = 132
  const cx = width / 2
  const cy = 60
  const radius = 40
  const count = radar.axes.length
  const pointAt = (index, ratio) => {
    const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / count
    return [cx + Math.cos(angle) * radius * ratio, cy + Math.sin(angle) * radius * ratio]
  }
  const polygon = (values) =>
    values.map((value, index) => pointAt(index, value).map((n) => n.toFixed(1)).join(' ')).join(' ')
  return (
    <div className="collect-chart__plot" role="img" aria-label={radar.caption}>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {[0.33, 0.66, 1].map((ring) => (
          <polygon
            className="collect-chart__radar-ring"
            key={ring}
            points={Array.from({ length: count }, (_, i) => pointAt(i, ring).map((n) => n.toFixed(1)).join(' ')).join(' ')}
          />
        ))}
        {radar.axes.map((axis, index) => {
          const [x, y] = pointAt(index, 1)
          const [lx, ly] = pointAt(index, 1.24)
          return (
            <g key={axis}>
              <path className="collect-chart__radar-spoke" d={`M${cx} ${cy}L${x.toFixed(1)} ${y.toFixed(1)}`} />
              <text
                className="collect-chart__radar-label"
                textAnchor={Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'}
                x={lx.toFixed(1)}
                y={(ly + 3).toFixed(1)}
              >
                {axis}
              </text>
            </g>
          )
        })}
        <polygon className="collect-chart__radar-shape is-normal" points={polygon(radar.normal)} />
        <polygon className="collect-chart__radar-shape is-alert" points={polygon(radar.abnormal)} />
      </svg>
      <div className="collect-chart__legend">
        <i className="collect-chart__legend-swatch is-normal" />
        <span>正常设备</span>
        <i className="collect-chart__legend-swatch is-alert" />
        <span>异常设备</span>
      </div>
    </div>
  )
}

function CollectChartBlock({ children, title }) {
  return (
    <div className="collect-chart">
      <strong className="collect-chart__title">{title}</strong>
      {children}
    </div>
  )
}

/**
 * 数据收集卡：顶部一句话总结（高亮关键词与数据）+ 2×3 正常/异常对比图表
 */
function DataCollectionPanel({ collection }) {
  if (!collection) return null
  return (
    <div className="data-collection">
      <p className="data-collection__summary">
        {collection.summary.map((segment, index) =>
          segment.tone
            ? <mark className={`is-${segment.tone}`} key={index}>{segment.text}</mark>
            : <span key={index}>{segment.text}</span>,
        )}
      </p>
      <div className="data-collection__grid">
        <CollectChartBlock title={collection.line.title}>
          <CollectLineChart line={collection.line} />
        </CollectChartBlock>
        <CollectChartBlock title={collection.bar.title}>
          <CollectBarChart bar={collection.bar} />
        </CollectChartBlock>
        <CollectChartBlock title={collection.heat.title}>
          <CollectHeatmap heat={collection.heat} />
        </CollectChartBlock>
        <CollectChartBlock title={collection.sankey.title}>
          <CollectSankey sankey={collection.sankey} />
        </CollectChartBlock>
        <CollectChartBlock title={collection.scatter.title}>
          <CollectScatter scatter={collection.scatter} />
        </CollectChartBlock>
        <CollectChartBlock title={collection.radar.title}>
          <CollectRadar radar={collection.radar} />
        </CollectChartBlock>
      </div>
    </div>
  )
}

/**
 * 根因链节点内嵌迷你柱状图：两柱并排对比（如本串 0.82V vs 正常值 0.45V）
 */
function RfcMiniBar({ chart }) {
  const max = Math.max(...chart.items.map((item) => item.value)) * 1.25
  const baseY = 64
  const topY = 8
  return (
    <svg className="rfc-mini-bar" viewBox="0 0 200 90" role="img" aria-label={chart.aria ?? ''}>
      <line className="rfc-mini-bar__axis" x1="16" x2="192" y1={baseY} y2={baseY} />
      {chart.items.map((item, itemIndex) => {
        const height = (item.value / max) * (baseY - topY)
        const x = 42 + itemIndex * 70
        return (
          <g key={item.label}>
            <rect className={`rfc-mini-bar__bar${item.alert ? ' is-alert' : ''}`} height={height} rx="3" width="34" x={x} y={baseY - height} />
            <text className="rfc-mini-bar__value" textAnchor="middle" x={x + 17} y={baseY - height - 4}>{item.value}{chart.unit}</text>
            <text className="rfc-mini-bar__label" textAnchor="middle" x={x + 17} y={baseY + 13}>{item.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * 根因链节点内嵌迷你散点图：实测值 vs 后台值，点落在 y=x 对角线附近表示数据一致
 */
function RfcMiniScatter({ chart }) {
  const values = chart.points.flatMap((point) => [point.x, point.y])
  const min = Math.min(...values) - 0.4
  const max = Math.max(...values) + 0.4
  const left = 36
  const right = 192
  const top = 8
  const bottom = 86
  const sx = (value) => left + ((value - min) / (max - min)) * (right - left)
  const sy = (value) => bottom - ((value - min) / (max - min)) * (bottom - top)
  return (
    <svg className="rfc-mini-scatter" viewBox="0 0 200 112" role="img" aria-label={chart.aria ?? ''}>
      <line className="rfc-mini-scatter__axis" x1={left} x2={right} y1={bottom} y2={bottom} />
      <line className="rfc-mini-scatter__axis" x1={left} x2={left} y1={top} y2={bottom} />
      <line className="rfc-mini-scatter__diagonal" x1={sx(min)} x2={sx(max)} y1={sy(min)} y2={sy(max)} />
      {chart.points.map((point) => (
        <g key={`${point.x}-${point.y}`}>
          <circle className="rfc-mini-scatter__dot" cx={sx(point.x)} cy={sy(point.y)} r="4" />
          <text className="rfc-mini-scatter__value" textAnchor="middle" x={sx(point.x)} y={sy(point.y) - 8}>
            {point.y}{chart.unit}
          </text>
        </g>
      ))}
      <text className="rfc-mini-scatter__label" textAnchor="end" x={right} y={bottom + 14}>{chart.xLabel}（{chart.unit}）</text>
      <text className="rfc-mini-scatter__label" textAnchor="start" x={left + 4} y={top + 2}>{chart.yLabel}</text>
    </svg>
  )
}

/**
 * 根因链节点内嵌迷你进度条：三段色区（低阻异常 / 中阻警戒 / 高阻正常），指针指示实测落点
 */
function RfcMiniGauge({ chart }) {
  const left = 10
  const width = 180
  const barY = 14
  const barHeight = 10
  const pointerX = left + chart.value * width
  let zoneStart = 0
  return (
    <svg className="rfc-mini-gauge" viewBox="0 0 200 48" role="img" aria-label={chart.aria ?? ''}>
      {chart.zones.map((zone) => {
        const x = left + zoneStart * width
        const zoneWidth = (zone.to - zoneStart) * width
        const labelX = x + zoneWidth / 2
        zoneStart = zone.to
        return (
          <g key={zone.label}>
            <rect className={`rfc-mini-gauge__zone is-${zone.tone}`} height={barHeight} width={zoneWidth} x={x} y={barY} />
            <text className="rfc-mini-gauge__label" textAnchor="middle" x={labelX} y={barY + barHeight + 13}>{zone.label}</text>
          </g>
        )
      })}
      <line className="rfc-mini-gauge__pointer" x1={pointerX} x2={pointerX} y1={barY - 8} y2={barY + barHeight} />
      <path className="rfc-mini-gauge__pointer" d={`M ${pointerX} ${barY - 2} l -4 -6 h 8 z`} stroke="none" />
    </svg>
  )
}

/**
 * 根因链节点内嵌迷你折线图：支持多序列、时段阴影高亮、突变点红圈标注
 */
function RfcMiniLine({ chart }) {
  const left = 10
  const right = 194
  const top = 10
  const bottom = 78
  const all = chart.series.flatMap((s) => s.points)
  const min = Math.min(...all) - 0.06
  const max = Math.max(...all) + 0.06
  const count = chart.series[0].points.length
  const sx = (index) => left + (index / (count - 1)) * (right - left)
  const sy = (value) => bottom - ((value - min) / (max - min)) * (bottom - top)
  const toPath = (points) => points.map((value, index) => `${index ? 'L' : 'M'} ${sx(index).toFixed(1)} ${sy(value).toFixed(1)}`).join(' ')
  const markSeries = chart.series[chart.series.length - 1]
  const markX = chart.markIndex != null ? sx(chart.markIndex) : 0
  const markY = chart.markIndex != null ? sy(markSeries.points[chart.markIndex]) : 0
  return (
    <svg className="rfc-mini-line" viewBox="0 0 200 104" role="img" aria-label={chart.aria ?? ''}>
      {(chart.shadeRanges ?? []).map(([from, to]) => (
        <rect className="rfc-mini-line__shade" height={bottom - top} key={`${from}-${to}`} width={sx(to) - sx(from)} x={sx(from)} y={top} />
      ))}
      <line className="rfc-mini-line__axis" x1={left} x2={right} y1={bottom} y2={bottom} />
      <line className="rfc-mini-line__axis" x1={left} x2={left} y1={top} y2={bottom} />
      {chart.series.map((s) => (
        <path className={`rfc-mini-line__path is-${s.tone}`} d={toPath(s.points)} key={s.name} />
      ))}
      {chart.markIndex != null && (
        <g>
          <circle className="rfc-mini-line__mark" cx={markX} cy={markY} r="4.5" />
          <path className="rfc-mini-line__mark-arrow" d={`M ${markX - 24} ${markY - 18} L ${markX - 6} ${markY - 6}`} />
          <text className="rfc-mini-line__mark-label" textAnchor="middle" x={markX - 26} y={markY - 22}>{chart.markLabel}</text>
        </g>
      )}
      {(chart.xLabels ?? []).map((tick) => (
        <text className="rfc-mini-line__tick" key={tick.label} textAnchor="middle" x={sx(tick.at)} y={bottom + 12}>{tick.label}</text>
      ))}
      {chart.series.length > 1 && chart.series.map((s, index) => (
        <g key={s.name}>
          <circle className={`rfc-mini-line__legend-dot is-${s.tone}`} cx={left + 6 + index * 56} cy={top - 4} r="3" />
          <text className="rfc-mini-line__tick" x={left + 12 + index * 56} y={top - 1}>{s.name}</text>
        </g>
      ))}
    </svg>
  )
}

/**
 * 根因分析流程（从左到右）：根卡（异常现象，对应数据收集六张图表）→ 候选分支（上下并列）→ 验证链（向右延伸）
 * 节点间用贝塞尔弧线连接（根卡与候选多对多），节点右上角为置信度，正确分支递增、错误分支递减
 */
function RootCauseFlow({ flow }) {
  const containerRef = useRef(null)
  const [links, setLinks] = useState([])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!flow || !container) return undefined
    const measure = () => {
      const cRect = container.getBoundingClientRect()
      const anchor = (id, side) => {
        const node = container.querySelector(`[data-rfc="${id}"]`)
        if (!node) return null
        const r = node.getBoundingClientRect()
        return {
          x: (side === 'right' ? r.right : r.left) - cRect.left,
          y: r.top + r.height / 2 - cRect.top,
        }
      }
      const next = []
      const addLink = (fromId, toId, kept) => {
        const p1 = anchor(fromId, 'right')
        const p2 = anchor(toId, 'left')
        if (!p1 || !p2) return
        const dx = Math.max(30, (p2.x - p1.x) / 2)
        next.push({
          d: `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${(p1.x + dx).toFixed(1)} ${p1.y.toFixed(1)}, ${(p2.x - dx).toFixed(1)} ${p2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
          kept,
        })
      }
      // 根卡与候选多对多：一种现象可能对应多种候选原因；命中分支的入线同为红色
      flow.root.cards.forEach((_, rootIndex) => {
        flow.branches.forEach((branch, branchIndex) => addLink(`root-${rootIndex}`, `branch-${branchIndex}`, branch.kept))
      })
      flow.branches.forEach((branch, branchIndex) => {
        if (branch.chain.length) addLink(`branch-${branchIndex}`, `chain-${branchIndex}-0`, branch.kept)
        branch.chain.forEach((_, chainIndex) => {
          if (chainIndex + 1 < branch.chain.length) addLink(`chain-${branchIndex}-${chainIndex}`, `chain-${branchIndex}-${chainIndex + 1}`, branch.kept)
        })
      })
      setLinks(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [flow])

  if (!flow) return null
  return (
    <div className="rootcause-flow" ref={containerRef}>
      <svg className="rfc-links" aria-hidden="true">
        {links.map((link) => (
          <path key={link.d} d={link.d} className={link.kept ? 'is-kept' : undefined} />
        ))}
      </svg>
      <div className="rfc-roots" style={{ gridColumn: 1, gridRow: `1 / span ${flow.branches.length}` }}>
        {flow.root.cards.map((card, cardIndex) => {
          const [main, ...rest] = card.split('（')
          return (
            <div className="rfc-node rfc-node--root" data-rfc={`root-${cardIndex}`} key={card}>
              <span className="rfc-node__title">{main}</span>
              {rest.length > 0 && <span className="rfc-node__note">（{rest.join('（')}</span>}
            </div>
          )
        })}
      </div>
      {flow.branches.map((branch, branchIndex) => (
        <Fragment key={branch.hypothesis}>
          <div
            className={`rfc-node is-candidate ${branch.kept ? 'is-kept' : 'is-dropped'}`}
            data-rfc={`branch-${branchIndex}`}
            style={{ gridColumn: 2, gridRow: branchIndex + 1 }}
          >
            <span className="rfc-node__conf">{branch.confidence}</span>
            <span className="rfc-node__title">{branch.hypothesis}</span>
          </div>
          {branch.chain.map((node, chainIndex) => (
            <div
              className={`rfc-node is-chain ${branch.kept ? 'is-kept' : 'is-dropped'}`}
              data-rfc={`chain-${branchIndex}-${chainIndex}`}
              key={node.title}
              style={{ gridColumn: 3 + chainIndex, gridRow: branchIndex + 1 }}
            >
              <span className="rfc-node__conf">{node.confidence}</span>
              <span className="rfc-node__title">{node.title}</span>
              {node.desc && <span className="rfc-node__desc">{node.desc}</span>}
              {node.table && (
                <table className="rfc-mini-table">
                  <tbody>
                    {node.table.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {node.chart && (node.chart.type === 'line' ? <RfcMiniLine chart={node.chart} /> : node.chart.type === 'scatter' ? <RfcMiniScatter chart={node.chart} /> : node.chart.type === 'gauge' ? <RfcMiniGauge chart={node.chart} /> : <RfcMiniBar chart={node.chart} />)}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}

// 处理建议选项卡图标：与 LUI 对话缺陷单的处置选项一致
const CONCLUSION_ACTION_ICONS = { clipboard: ClipboardCheck, drone: Airplane, pause: PauseCircle, user: UserFocus }

/**
 * 诊断结论卡处理建议：4 个可点击选项，动作复用 AppContext（转工单/挂起/无人机复检）
 */
function ConclusionActions({ actions, ticket }) {
  const { advanceTicket, requestDrone, showToast } = useApp()
  if (!actions?.length) return null
  const runAction = (action) => {
    if (!ticket) return
    if (action === 'drone') {
      requestDrone?.(ticket.id)
      return
    }
    if (action === 'manual') {
      showToast?.('已纳入人工巡检计划，下次巡检周期复核', 'success')
      return
    }
    Promise.resolve(advanceTicket?.(ticket.id, action)).catch((error) => showToast?.(error?.message ?? '操作未完成，请重试'))
  }
  return (
    <div className="chat-defect-card__choices">
      {actions.map((choice) => {
        const ChoiceIcon = CONCLUSION_ACTION_ICONS[choice.icon] ?? ClipboardCheck
        return (
          <button
            className={`chat-defect-card__choice${choice.recommended ? ' is-recommended' : ''}`}
            key={choice.key}
            type="button"
            onClick={() => runAction(choice.action)}
          >
            <span className="chat-defect-card__choice-head">
              <ChoiceIcon size={14} aria-hidden="true" />
              <strong>{choice.key} · {choice.label}</strong>
            </span>
            <span className="chat-defect-card__choice-desc">{choice.desc}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * 诊断结论面板：根因/风险摘要 + 处理方式选项卡，按钮动作复用 AppContext
 */
function ConclusionPanel({ panel, ticket }) {
  const { advanceTicket, requestDrone, showToast } = useApp()
  if (!panel) return null
  const runAction = (action) => {
    if (!ticket) return
    if (action === 'drone') {
      requestDrone?.(ticket.id)
      return
    }
    if (action === 'manual') {
      showToast?.('已纳入人工巡检计划，下次巡检周期复核', 'success')
      return
    }
    Promise.resolve(advanceTicket?.(ticket.id, action)).catch((error) => showToast?.(error?.message ?? '操作未完成，请重试'))
  }
  return (
    <div className="conclusion-panel">
      <MetricGrid items={panel.summary} />
      <div className="conclusion-panel__divider"><span>选一个方式处理</span></div>
      <div className="conclusion-panel__options">
        {panel.options.map((option) => {
          const OptionIcon = CONCLUSION_ACTION_ICONS[option.icon] ?? ClipboardCheck
          return (
            <div className="conclusion-panel__option ticket-stage-card" key={option.title}>
              <div className="ticket-stage-card__heading">
                <div><h4>{option.title}</h4></div>
                <OptionIcon size={16} aria-hidden="true" />
              </div>
              <dl className="ticket-stage-kv">
                <div><dt>耗时</dt><dd>{option.duration}</dd></div>
                <div>
                  <dt>说明</dt>
                  <dd>{option.lines.map((line) => <p className="conclusion-panel__kv-line" key={line}>{line}</p>)}</dd>
                </div>
              </dl>
              <div className="conclusion-panel__option-actions">
                {option.buttons.map((button) => (
                  <button
                    className={`conclusion-panel__btn${button.primary ? ' is-primary' : ''}`}
                    key={button.label}
                    type="button"
                    onClick={() => runAction(button.action)}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 反灌异常触发的数字孪生告警点位（演示映射：#7 方阵 → 场景里的光伏子阵 01）
const REFLUX_ALERT_ENTITY_ID = 'template-instance-1d93ebc5-d0ac-4967-a43a-0604e6985708'
const REFLUX_ALERTS = [
  {
    entityId: REFLUX_ALERT_ENTITY_ID,
    zone: 'subarray',
    title: '#7 方阵组串反灌',
    detail: '近 30 日反灌 12 次 · 早晚低辐照占 71%',
  },
  {
    entityId: REFLUX_ALERT_ENTITY_ID,
    zone: 'equipment',
    title: '防反二极管衰减',
    detail: '正向压降 0.82V · 阈值 0.60V',
  },
]

/**
 * 反灌工单的异常触发票：一句话总结（高亮关键词与数据）+ 数字孪生场景
 * 数据口径与 DEFECT_BUILDERS.reflux（stage2.diagnosis）一致
 */
function RefluxTriggerSummary() {
  return (
    <div className="reflux-trigger">
      <p className="reflux-trigger__summary">
        扎拉山 <mark className="is-danger">#7 方阵</mark> 组串发生
        <mark className="is-danger">反灌 12 次</mark>（站级均值 2 次），集中在早晚低辐照时段（占 <mark className="is-danger">71%</mark>），
        防反二极管<mark className="is-warning">压降 0.82V</mark> 已超 0.60V 衰减阈值，
        日发电损失 <mark className="is-danger">1.8%</mark>（约 ¥940 / 日）。
      </p>
      <div className="reflux-trigger__twin">
        <SolarPlantMonitor
          alerts={REFLUX_ALERTS}
          className="reflux-trigger__monitor"
          deviceStatuses={null}
          documents={solarPlantDocuments}
          environment={DEFAULT_ENVIRONMENT}
          performanceMode
        />
      </div>
    </div>
  )
}

// 排程甘特图：7 天日期轴，蓝段为本缺陷单处置任务，灰段为其它缺陷单任务
const GANTT_WEEK_AXIS = ['08-18', '08-19', '08-20', '08-21', '08-22', '08-23', '08-24']
// 天数换算为整周百分比
const weekPct = (day) => (day / 7) * 100

function ganttRows(mainTask) {
  return [
    {
      name: '现场工程师A',
      current: true,
      segments: [
        { tone: 'is-muted', label: '汇流箱缺陷处理', startDay: 0, days: 1 },
        { tone: 'is-muted', label: '逆变器告警复核', startDay: 1, days: 1 },
        { tone: 'is-blue', label: mainTask, startDay: 2, days: 1 },
        { tone: 'is-muted', label: '组件隐裂排查', startDay: 4, days: 1 },
      ],
    },
    {
      name: '现场工程师B',
      current: true,
      segments: [
        { tone: 'is-muted', label: '备件清点', startDay: 1, days: 1 },
        { tone: 'is-blue', label: mainTask, startDay: 2, days: 1 },
        { tone: 'is-muted', label: '红外复测支援', startDay: 5, days: 1 },
      ],
    },
  ]
}

function Gantt({ mainTask }) {
  const rows = ganttRows(mainTask)
  return (
    <div className="ticket-stage-gantt">
      <div className="ticket-stage-gantt__axis">
        {GANTT_WEEK_AXIS.map((label) => <span key={label}>{label}</span>)}
      </div>
      {rows.map((row) => (
        <div className={`ticket-stage-gantt__row${row.current ? ' is-current' : ''}`} key={row.name}>
          <span>{row.name}</span>
          <i>
            {row.segments.map((segment) => (
              <b
                key={`${segment.startDay}-${segment.days}`}
                className={segment.tone}
                data-tip={segment.label}
                style={{ left: `${weekPct(segment.startDay)}%`, width: `${weekPct(segment.days)}%` }}
              />
            ))}
          </i>
        </div>
      ))}
    </div>
  )
}

export function CheckList({ items }) {
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

/**
 * 缺陷示意图：组件阵列中第 7 块高亮发红
 */
function DefectFigure({ figure }) {
  return (
    <figure className="ticket-stage-hotspot">
      <svg viewBox="0 0 320 176" role="img" aria-label={figure.alt}>
        <defs>
          <radialGradient id="hotspot-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff4d2e" />
            <stop offset="45%" stopColor="#ff8a3c" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ff8a3c" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="320" height="176" rx="6" fill="#101418" />
        {Array.from({ length: 12 }, (_, i) => {
          const col = i % 4
          const row = Math.floor(i / 4)
          return (
            <rect
              key={i}
              x={10 + col * 78}
              y={10 + row * 54}
              width="70"
              height="46"
              rx="3"
              className={i === 6 ? 'is-hot' : ''}
            />
          )
        })}
        <circle cx="201" cy="87" r="44" fill="url(#hotspot-glow)" />
        <circle cx="201" cy="87" r="13" fill="#ff4d2e" />
        <circle cx="201" cy="87" r="5" fill="#ffd9a8" />
      </svg>
    </figure>
  )
}

// 7 天排程日历弹窗：每人一段可编辑主任务，灰段为固定其它缺陷单任务
function schedulePeople(mainTask) {
  return [
    { id: 'p1', name: '现场工程师A', crew: '川西检修一组', tone: 'is-blue', current: true, task: mainTask, start: 2, end: 2, segments: [{ day: 0, label: '汇流箱缺陷处理' }, { day: 1, label: '逆变器告警复核' }, { day: 4, label: '组件隐裂排查' }] },
    { id: 'p2', name: '现场工程师B', crew: '川西检修一组', tone: 'is-blue', current: true, task: mainTask, start: 2, end: 2, segments: [{ day: 1, label: '备件清点' }, { day: 5, label: '红外复测支援' }] },
    { id: 'p3', name: '现场工程师C', crew: '川西检修二组', tone: 'is-muted', task: '集电线路检修', start: 3, end: 3, segments: [{ day: 0, label: '箱变巡检' }] },
    { id: 'p4', name: '现场工程师D', crew: '川西检修二组', tone: 'is-muted', task: '逆变器更换支援', start: 4, end: 4, segments: [{ day: 1, label: '箱变巡检' }] },
    { id: 'p5', name: '无人机飞手E', crew: '巡检班', tone: 'is-muted', task: '红外复测', start: 0, end: 0, segments: [{ day: 3, label: '航线规划' }] },
    { id: 'p6', name: '无人机飞手F', crew: '巡检班', tone: 'is-muted', task: '红外复测', start: 5, end: 5, segments: [{ day: 1, label: '航线规划' }] },
    { id: 'p7', name: '继保工G', crew: '继保班', tone: 'is-muted', task: '保护定值核验', start: 3, end: 3, segments: [{ day: 0, label: '继保巡检' }] },
    { id: 'p8', name: '运维值班H', crew: '集控中心', tone: 'is-muted', task: '集控值班', start: 0, end: 6, segments: [] },
    { id: 'p9', name: '运维值班I', crew: '集控中心', tone: 'is-muted', task: '集控值班', start: 0, end: 6, segments: [] },
    { id: 'p10', name: '安全监护J', crew: '安全组', tone: 'is-blue', task: `${mainTask}监护`, start: 2, end: 2, segments: [{ day: 4, label: '安全工器具检查' }] },
  ]
}

function ScheduleDialog({ mainTask, onClose }) {
  const [people, setPeople] = useState(() => schedulePeople(mainTask))

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // 拖动主任务条左右边缘，按天吸附调整起止日期
  const startResize = (event, id, edge) => {
    event.preventDefault()
    const rect = event.currentTarget.closest('.ticket-stage-schedule-editor__track').getBoundingClientRect()
    const dayAt = (clientX) => Math.min(6, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 7)))
    const onMove = (moveEvent) => {
      const day = dayAt(moveEvent.clientX)
      setPeople((current) =>
        current.map((person) => {
          if (person.id !== id) return person
          if (edge === 'start') return { ...person, start: Math.min(day, person.end) }
          return { ...person, end: Math.max(day, person.start) }
        }),
      )
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return createPortal(
    <div
      className="ticket-stage-pdf-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="ticket-stage-pdf-dialog ticket-stage-schedule-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="排程日历"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ticket-stage-pdf-dialog__header">
          <div>
            <span>排程日历</span>
            <h3>作业排程（10 人 · 可编辑）</h3>
          </div>
          <button type="button" className="ticket-stage-pdf-dialog__close" onClick={onClose} aria-label="关闭排程">
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="ticket-stage-pdf-dialog__body">
          <div className="ticket-stage-schedule-editor">
            <div className="ticket-stage-schedule-editor__axis">
              {GANTT_WEEK_AXIS.map((label) => <span key={label}>{label}</span>)}
            </div>
            {people.map((person) => (
              <div className={`ticket-stage-schedule-editor__row${person.current ? ' is-current' : ''}`} key={person.id}>
                <div className="ticket-stage-schedule-editor__who">
                  <strong>{person.name}</strong>
                  <small>{person.crew}</small>
                </div>
                <div className="ticket-stage-schedule-editor__track">
                  {person.segments.map((segment) => (
                    <b
                      key={segment.day}
                      className="is-muted"
                      data-tip={segment.label}
                      style={{ left: `${weekPct(segment.day)}%`, width: `${weekPct(1)}%` }}
                    />
                  ))}
                  <b
                    className={person.tone}
                    data-tip={person.task}
                    style={{ left: `${weekPct(person.start)}%`, width: `${weekPct(person.end - person.start + 1)}%` }}
                  >
                    <i
                      className="ticket-stage-schedule-editor__handle is-start"
                      onPointerDown={(event) => startResize(event, person.id, 'start')}
                      aria-hidden="true"
                    />
                    <i
                      className="ticket-stage-schedule-editor__handle is-end"
                      onPointerDown={(event) => startResize(event, person.id, 'end')}
                      aria-hidden="true"
                    />
                  </b>
                </div>
              </div>
            ))}
          </div>
        </div>
        <footer className="ticket-stage-pdf-dialog__footer">
          <span>共 10 人 · 拖动色条左右边缘调整起止日期</span>
          <button type="button" className="ticket-stage-pdf-dialog__download" onClick={onClose}>
            <Check size={14} aria-hidden="true" />
            保存排程
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function RouteCard({ route }) {
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
        <strong>成都驻地 <small>→</small> {route.dest}</strong>
        <div><b>{route.km}</b><b>{route.dur}</b><span>{route.advice}</span></div>
      </div>
    </div>
  )
}

function ComparisonTable({ rows }) {
  return (
    <div className="ticket-stage-table-wrap">
      <table className="ticket-stage-table ticket-stage-table--comparison">
        <thead><tr><th>关键指标</th><th>处置前</th><th>处置后</th><th>变化</th></tr></thead>
        <tbody>{rows.map(([label, before, after, delta]) => <tr key={label}><th>{label}</th><td className="ticket-stage-data">{before}</td><td className="ticket-stage-data is-good">{after}</td><td className="ticket-stage-data is-good">{delta}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function StageOne({ c }) {
  return (
    <>
      <MetricGrid items={c.stage1.metrics} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="异常数据" icon={Gauge}>
          <KeyValueList items={c.stage1.device} />
        </StageCard>
        <StageCard title="证据已关联" icon={FileCheck2}>
          <EvidenceList items={c.stage1.evidence} />
        </StageCard>
      </div>
    </>
  )
}

function StageTwo({ c }) {
  return (
    <>
      <MetricGrid items={c.stage2.metrics} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="候选原因与置信度" icon={BrainCircuit}>
          <ConfidenceList threshold={c.stage2.threshold} causes={c.stage2.causes} />
          <p className="ticket-stage-note">{c.stage2.note}</p>
        </StageCard>
        <StageCard title="诊断结论" icon={ShieldCheck} className="is-emphasis">
          <div className="ticket-stage-callout"><strong>{c.stage2.conclusion[0]}</strong><p>{c.stage2.conclusion[1]}</p></div>
          <KeyValueList items={c.stage2.kv} />
        </StageCard>
      </div>
    </>
  )
}

function StageThree({ c }) {
  return (
    <>
      <StageCard title="趋势与关键数据" icon={Activity}>
        <div className="ticket-stage-grid ticket-stage-grid--two ticket-stage-grid--flush">
          <MiniTrend aria={c.stage3.trendAria} />
          <KeyValueList items={c.stage3.trendKv} />
        </div>
      </StageCard>
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="代价与后果" icon={AlertTriangle}>
          <KeyValueList items={c.stage3.cost} />
        </StageCard>
        <StageCard title="审批意见" icon={UserRound}>
          <div className="ticket-stage-empty-field">等待人工输入复核意见</div>
          <div className="ticket-stage-suggestion"><Sparkles size={13} /><span>{c.stage3.suggestion}</span></div>
        </StageCard>
      </div>
    </>
  )
}

// 缺陷单节点：头部编辑按钮打开输入项弹窗
function StageFour({ c, ticket, index = 4, generation, conclusion = false }) {
  const [editOpen, setEditOpen] = useState(false)
  const ready = generation?.ready ?? true

  return (
    <section className="ticket-stage-content" aria-label={`步骤 ${index} 业务内容`}>
      <StageHeader index={index} contentIndex={4} isGenerated stageMeta={conclusion ? DIAGNOSIS_CONCLUSION_META : undefined} action={conclusion ? <EditButton icon={ClipboardCheck} label="查看缺陷单" onClick={() => setEditOpen(true)} /> : <EditButton onClick={() => setEditOpen(true)} />} />
      <div
        key={`ticket-stage-${ticket?.id ?? 'ticket'}-${index}`}
        className={`ticket-stage-content__body is-generated${ready ? ' is-revealed' : ' is-generating'}`}
        data-stage-index={index}
        data-progress={generation?.progress ?? 100}
        aria-busy={!ready}
      >
        {ready ? (
          <>
            {conclusion && c.conclusionPanel ? (
              <>
                <ConclusionPanel panel={c.conclusionPanel} ticket={ticket} />
                <StageCard title="处理建议" icon={ClipboardCheck}>
                  <ConclusionActions actions={c.conclusionActions} ticket={ticket} />
                </StageCard>
              </>
            ) : (
              <>
                <MetricGrid items={c.defect.metrics} />
                <div className="ticket-stage-grid ticket-stage-grid--two">
                  <StageCard title="缺陷信息" icon={AlertTriangle} className="is-emphasis">
                    <div className="ticket-stage-callout"><strong>{c.defect.info[0]}</strong><p>{c.defect.info[1]}</p></div>
                  </StageCard>
                  <StageCard title="建议措施" icon={ClipboardCheck}>
                    <div className="ticket-stage-callout"><strong>{c.defect.measure[0]}</strong><p>{c.defect.measure[1]}</p></div>
                  </StageCard>
                </div>
                <StageCard title="代价与后果" icon={AlertTriangle}>
                  <KeyValueList items={c.defect.cost} />
                </StageCard>
                {conclusion && (
                  <StageCard title="处理建议" icon={ClipboardCheck}>
                    <ConclusionActions actions={c.conclusionActions} ticket={ticket} />
                  </StageCard>
                )}
              </>
            )}
            {editOpen ? <DefectFormDialog c={c} ticket={ticket} onClose={() => setEditOpen(false)} /> : null}
          </>
        ) : (
          <StageGeneration label={generation.label} detail={generation.detail} progress={generation.progress} />
        )}
      </div>
    </section>
  )
}

function StageFiveBody({ c }) {
  return (
    <>
      <MetricGrid items={c.stage5.metrics} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="工作内容步骤" icon={ClipboardCheck} className="is-emphasis">
          <CheckList items={c.stage5.checklist} />
          <DefectFigure figure={c.figure} />
        </StageCard>
        <StageCard title="措施与验收标准" icon={ShieldCheck}>
          <div className="ticket-stage-acceptance"><span>验收标准</span><strong>{c.stage5.acceptance}</strong></div>
        </StageCard>
      </div>
    </>
  )
}

// 工单生成节点：头部编辑按钮打开工单输入项弹窗
function StageFive({ c, ticket, index = 5, generation }) {
  const [editOpen, setEditOpen] = useState(false)
  const ready = generation?.ready ?? true

  return (
    <section className="ticket-stage-content" aria-label={`步骤 ${index} 业务内容`}>
      <StageHeader index={index} contentIndex={5} action={<EditButton onClick={() => setEditOpen(true)} />} />
      <div
        key={`ticket-stage-${ticket?.id ?? 'ticket'}-${index}`}
        className={`ticket-stage-content__body${ready ? ' is-revealed' : ' is-generating'}`}
        data-stage-index={index}
        data-progress={generation?.progress ?? 100}
        aria-busy={!ready}
      >
        {ready ? (
          <>
            <StageFiveBody c={c} />
            {editOpen ? <WorkOrderFormDialog c={c} ticket={ticket} onClose={() => setEditOpen(false)} /> : null}
          </>
        ) : (
          <StageGeneration label={generation.label} detail={generation.detail} progress={generation.progress} />
        )}
      </div>
    </section>
  )
}

function StageSix({ c }) {
  const [scheduleOpen, setScheduleOpen] = useState(false)

  return (
    <>
      <StageCard
        title="人员与资源排程"
        icon={CalendarClock}
        action={(
          <button className="ticket-stage-card__edit" type="button" onClick={() => setScheduleOpen(true)} aria-haspopup="dialog" title="打开排程日历">
            <CalendarClock size={14} aria-hidden="true" />
            <span>排程日历</span>
          </button>
        )}
      >
        <Gantt mainTask={c.mainTask} />
      </StageCard>
      {scheduleOpen ? <ScheduleDialog mainTask={c.mainTask} onClose={() => setScheduleOpen(false)} /> : null}
    </>
  )
}

function StageSeven({ c }) {
  return (
    <>
      <MetricGrid items={c.stage7.metrics} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="排程摘要" icon={CalendarClock} className="is-emphasis">
          <KeyValueList items={c.stage7.summary} />
        </StageCard>
        <StageCard title="资源冲突检查" icon={Users}>
          <ul className="ticket-stage-status-list">
            {[
              ...c.stage7.checks.map((label) => [CheckCircle2, label, 'success', '通过']),
              [AlertTriangle, '两票尚未提交，需现场工程师发起申请', 'warning', '下一步'],
            ].map(([StatusIcon, label, tone, status], checkIndex) => (
              <li key={label} style={{ '--check-delay': `${checkIndex * 160}ms` }}>
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

// 两票申请：头部编辑按钮打开原来的输入项弹窗
function StageEight({ c, ticket, index = 8 }) {
  const { updateTicket, showToast } = useApp()
  const [editDoc, setEditDoc] = useState(null)
  const operationEnabled = ticket?.operationPermitEnabled !== false

  // 操作票默认自动生成，首次进入时持久化默认值
  useEffect(() => {
    if (ticket?.id && ticket?.operationPermitEnabled === undefined) {
      updateTicket?.(ticket.id, { operationPermitEnabled: true })
    }
  }, [ticket?.id, ticket?.operationPermitEnabled, updateTicket])

  const toggleOperationPermit = () => {
    updateTicket?.(ticket?.id, { operationPermitEnabled: !operationEnabled })
    showToast?.(operationEnabled ? '已取消操作票，仅保留工作票与工序单' : '操作票已生成，AI 已预填票面内容')
  }

  return (
    <>
      <section className="ticket-stage-content" aria-label={`步骤 ${index} 工作票申请`}>
        <StageHeader
          index={index}
          contentIndex={8}
          stageMeta={{ title: '工作票', mode: '人工提交' }}
          action={<EditButton onClick={() => setEditDoc('work')} />}
        />
        <div className="ticket-stage-content__body is-revealed" data-stage-index={index}>
          <MetricGrid items={c.permits.workSummary} />
        </div>
      </section>
      <section className="ticket-stage-content" aria-label={`步骤 ${index} 操作票申请`}>
        <StageHeader
          index={index}
          contentIndex={8}
          stageMeta={{ title: '操作票', mode: '人工提交' }}
          action={<EditButton onClick={() => setEditDoc('op')} />}
        />
        <div className="ticket-stage-content__body is-revealed" data-stage-index={index}>
          <label className="ticket-stage-doc-toggle">
            <input type="checkbox" checked={operationEnabled} onChange={toggleOperationPermit} />
            <span>本次作业涉及倒闸操作，生成操作票</span>
          </label>
          {operationEnabled ? (
            <MetricGrid items={c.permits.opSummary} />
          ) : (
            <p className="ticket-stage-note">操作票为可选项：取消勾选后不生成操作票，仅提交工作票与工序单。</p>
          )}
        </div>
      </section>
      {editDoc === 'work' ? <WorkPermitDialog c={c} ticket={ticket} onClose={() => setEditDoc(null)} /> : null}
      {editDoc === 'op' ? <OperationFormDialog c={c} ticket={ticket} onClose={() => setEditDoc(null)} /> : null}
    </>
  )
}

// 两票批准：头部"查看"打开只读审批弹窗（AI 建议 + 审批意见），审批动作由外部审批面板完成
// branchRole：步骤栏会签分支过滤，'control' 只显示工作票审批卡片，'operations' 只显示操作票审批卡片
function StageNine({ c, ticket, index, signoffMessages = [], renderMessage, branchRole = '' }) {
  const [reviewDoc, setReviewDoc] = useState(null)
  const operationEnabled = ticket?.operationPermitEnabled !== false
  const signoffs = ticket?.permitSignoffs ?? {}
  const workPermitSigned = Boolean(signoffs.control)
  // 会签批准消息按角色穿插在两个批准区块之间
  const controlSignoff = signoffMessages.find((item) => item.role === 'control')
  const operationSignoff = signoffMessages.find((item) => item.role === 'operations')
  const showWork = !branchRole || branchRole === 'control'
  // 点了运维负责人分支就直接亮操作票卡片，不再被"工作票先签"门槛挡住
  const showOperation = operationEnabled && (branchRole === 'operations' || (!branchRole && workPermitSigned))

  return (
    <>
      {showWork ? (
        <section className="ticket-stage-content" aria-label={`步骤 ${index} 工作票批准`}>
          <StageHeader
            index={index}
            contentIndex={9}
            stageMeta={{ title: '工作票批准', mode: '人工审批' }}
            action={<ViewButton onClick={() => setReviewDoc('work')} />}
          />
          <div className="ticket-stage-content__body is-revealed" data-stage-index={index}>
            <StageCard title="工作票" icon={FileText}>
              <div className="ticket-stage-alert ticket-stage-alert--pass"><CheckCircle2 size={15} /><div><strong>{c.stage9.workAlert[0]}</strong><p>{c.stage9.workAlert[1]}</p></div></div>
              <MetricGrid items={c.permits.workSummary} />
            </StageCard>
          </div>
        </section>
      ) : null}
      {showWork && controlSignoff && renderMessage ? <div className="ticket-stage-signoff">{renderMessage(controlSignoff)}</div> : null}
      {showOperation ? (
        <section className="ticket-stage-content" aria-label={`步骤 ${index} 操作票批准`}>
          <StageHeader
            index={index}
            contentIndex={9}
            stageMeta={{ title: '操作票批准', mode: '人工审批' }}
            action={<ViewButton onClick={() => setReviewDoc('op')} />}
          />
          <div className="ticket-stage-content__body is-revealed" data-stage-index={index}>
            <StageCard title="操作票" icon={ClipboardCheck}>
              <div className="ticket-stage-alert"><AlertTriangle size={15} /><div><strong>{c.stage9.opAlert[0]}</strong><p>{c.stage9.opAlert[1]}</p></div></div>
              <MetricGrid items={c.permits.opSummary} />
              <div className="ticket-stage-inline-status">
                <CheckCircle2 size={14} />
                <span>运维负责人确认操作票后，任务进入现场执行</span>
              </div>
            </StageCard>
          </div>
        </section>
      ) : null}
      {showOperation && operationSignoff && renderMessage ? <div className="ticket-stage-signoff">{renderMessage(operationSignoff)}</div> : null}
      {reviewDoc ? <PermitReviewDialog c={c} ticket={ticket} doc={reviewDoc} onClose={() => setReviewDoc(null)} /> : null}
    </>
  )
}

function StageTen({ c }) {
  return (
    <>
      <RouteCard route={c.stage10.route} />
      <StageCard title="检修交待" icon={Wrench}>
        <CheckList items={c.stage10.checklist} />
      </StageCard>
    </>
  )
}

function StageEleven({ c }) {
  return (
    <>
      <MetricGrid items={c.stage11.metrics} />
      <StageCard title="处置前后数据对比" icon={Activity}>
        <ComparisonTable rows={c.stage11.comparison} />
        <div className="ticket-stage-inline-status"><CheckCircle2 size={14} /><span>全部关键指标满足验收标准，建议进入关单批准。</span></div>
      </StageCard>
    </>
  )
}

function StageTwelve({ c }) {
  return (
    <>
      <MetricGrid items={c.stage12.metrics} />
      <div className="ticket-stage-grid ticket-stage-grid--two">
        <StageCard title="关单通知" icon={FileCheck2} className="is-emphasis">
          <KeyValueList items={c.stage12.notice} />
        </StageCard>
        <StageCard title="证据汇总与验收" icon={ClipboardCheck}>
          <CheckList items={c.stage12.evidence} />
          <div className="ticket-stage-acceptance"><span>验收标准</span><strong>{c.stage12.acceptance}</strong></div>
        </StageCard>
      </div>
    </>
  )
}

function StageThirteen({ c }) {
  // 人工补充的经验条目（本地追加，并入经验规则列表）
  const [customLessons, setCustomLessons] = useState([])
  const [lessonDraft, setLessonDraft] = useState('')
  const ids = c.ids

  const addLesson = () => {
    const text = lessonDraft.trim()
    if (!text) return
    setCustomLessons((items) => [...items, text])
    setLessonDraft('')
  }

  return (
    <>
      <StageCard title="复盘案例已生成" icon={BrainCircuit} className="is-emphasis">
        <div className="ticket-stage-case-id"><span>案例编号</span><strong>{ids.case}</strong></div>
        <div className="ticket-stage-phase-grid">
          {c.stage13.phases.map(([label, actor, copy]) => <div key={label}><span>{label}</span><strong>{actor}</strong><small>{copy}</small></div>)}
        </div>
      </StageCard>
      <StageCard title="过程复盘" icon={Activity}>
        <div className="review-block">
          <h4>SLA 复盘</h4>
          <ul className="review-sla">
            {c.stage13.sla.map((item) => (
              <li key={item.stage}>
                <span className="review-sla__stage">{item.stage}</span>
                <strong>{item.actual}</strong>
                <span className="review-sla__planned">计划 {item.planned}</span>
                <Tag tone={item.met ? 'success' : 'warning'}>{item.met ? '达标' : '超时'}</Tag>
              </li>
            ))}
          </ul>
        </div>
        <div className="review-block">
          <h4>诊断准确性</h4>
          <p className="ticket-stage-note">诊断结论「{c.stage13.accuracy.conclusion}」（置信度 {c.stage13.accuracy.confidence}），现场验证：{c.stage13.accuracy.verified}。</p>
        </div>
        <div className="review-block">
          <h4>现场问答记录</h4>
          <ul className="review-qa">
            {c.stage13.qa.map((item) => (
              <li key={item.question}>
                <strong>{item.question}</strong>
                <span>{item.help}</span>
              </li>
            ))}
          </ul>
        </div>
      </StageCard>
      <StageCard title="经验规则沉淀" icon={Sparkles}>
        <ul className="review-lessons">
          {c.stage13.lessons.map((item) => (
            <li key={item.rule}>
              <span className="review-lessons__problem">问题：{item.problem}</span>
              <span className="review-lessons__rule">规则：{item.rule}</span>
            </li>
          ))}
          {customLessons.map((text, index) => (
            <li key={`custom-${index}`}>
              <span className="review-lessons__rule">{text}</span>
              <Tag tone="blue">人工补充</Tag>
            </li>
          ))}
        </ul>
        <div className="review-add">
          <input
            value={lessonDraft}
            onChange={(event) => setLessonDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addLesson()
              }
            }}
            placeholder="补充一条本次任务的真实经验"
            aria-label="补充经验条目"
          />
          <button type="button" disabled={!lessonDraft.trim()} onClick={addLesson}><Plus size={14} />添加</button>
        </div>
      </StageCard>
    </>
  )
}

function StageFallback({ ticket, index }) {
  return (
    <StageCard title="流程节点数据" icon={Activity}>
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
export function TicketStageContent({ step, ticket, selectedStep, currentStep, completed = false, signoffMessages = [], renderMessage, branchRole = '' }) {
  const [workOrderDocOpen, setWorkOrderDocOpen] = useState(false)
  const stepObject = typeof step === 'object' && step !== null ? step : null
  const index = Math.max(1, stepNumber(step ?? selectedStep ?? currentStep))
  // 合并流程的节点通过 contentStep 复用 13 步流程的内容；人工审批节点不走生成动画
  const contentIndex = Math.min(13, Math.max(1, Number(stepObject?.contentStep) || index))
  const isApprovalNode = stepObject?.advanceMode === 'approval'
  const c = contentFor(ticket)
  const activeStep = stepNumber(currentStep ?? ticket?.currentStep)
  const generation = useStageGeneration(
    contentIndex,
    ticket?.id,
    Boolean(GENERATION_META[contentIndex] && !isApprovalNode && index === activeStep && !completed),
  )
  let content
  // 合并流程的组合节点：工单+排程 节点单独渲染
  if (!stepObject?.combined) {
    switch (contentIndex) {
      case 1: content = <StageOne c={c} />; break
      case 2: content = <StageTwo c={c} />; break
      case 3: content = <StageThree c={c} />; break
      case 6: content = <StageSix c={c} />; break
      case 7: content = <StageSeven c={c} />; break
      case 8: content = <StageEight c={c} ticket={ticket} />; break
      case 10: content = <StageTen c={c} />; break
      case 11: content = <StageEleven c={c} />; break
      case 12: content = <StageTwelve c={c} />; break
      case 13: content = <StageThirteen c={c} />; break
      default: content = <StageFallback ticket={ticket} index={contentIndex} />
    }
  }
  // 合并流程的故障诊断节点：异常数据票 + AI 诊断卡 + 缺陷单卡，三张独立的票纵向排列
  if (stepObject?.combined === 'diagnose-defect') {
    return (
      <>
        <section className="ticket-stage-content" aria-label={`步骤 ${index} 异常触发`}>
          <StageHeader index={index} contentIndex={contentIndex} stageMeta={DIAGNOSIS_EVIDENCE_META} />
          <div
            className="ticket-stage-content__body is-revealed"
            data-stage-index={index}
          >
            {c.key === 'reflux'
              ? <RefluxTriggerSummary />
              : c.stage2.diagnosis ? <DiagnosisEvidence items={c.stage2.diagnosis} /> : null}
          </div>
        </section>
        <section className="ticket-stage-content" aria-label={`步骤 ${index} 数据收集`}>
          <StageHeader index={index} contentIndex={contentIndex} stageMeta={DATA_COLLECTION_META} />
          <div
            className="ticket-stage-content__body is-revealed"
            data-stage-index={index}
          >
            <DataCollectionPanel collection={c.collection} />
          </div>
        </section>
        <section className="ticket-stage-content" aria-label={`步骤 ${index} 根因分析`}>
          <StageHeader index={index} contentIndex={contentIndex} stageMeta={ROOT_CAUSE_META} />
          <div
            className="ticket-stage-content__body is-revealed"
            data-stage-index={index}
          >
            <RootCauseFlow flow={c.rootCauseFlow} />
          </div>
        </section>
        <StageFour c={c} conclusion ticket={ticket} index={index} generation={generation} />
      </>
    )
  }
  // 合并流程的工单节点自带头部，编辑按钮打开工单输入项弹窗，PDF 由排程区块的单据条目打开
  if (stepObject?.combined === 'order-schedule') {
    return (
      <section className="ticket-stage-content" aria-label={`步骤 ${index} 业务内容`}>
        <StageHeader
          index={index}
          contentIndex={contentIndex}
          stageMeta={stepObject?.stageMeta}
          action={<EditButton onClick={() => setWorkOrderDocOpen(true)} />}
        />
        <div
          key={`ticket-stage-${ticket?.id ?? 'ticket'}-${index}`}
          className="ticket-stage-content__body is-revealed"
          data-stage-index={index}
        >
          <StageFiveBody c={c} />
          <StageSix c={c} />
          {workOrderDocOpen ? <WorkOrderFormDialog c={c} ticket={ticket} onClose={() => setWorkOrderDocOpen(false)} /> : null}
        </div>
      </section>
    )
  }
  // 缺陷单审批节点自带头部，编辑按钮占用原标签位置
  if (!stepObject?.combined && contentIndex === 4) {
    return <StageFour c={c} ticket={ticket} index={index} generation={generation} />
  }
  // 工单生成审批节点自带头部
  if (!stepObject?.combined && contentIndex === 5) {
    return <StageFive c={c} ticket={ticket} index={index} generation={generation} />
  }
  // 两票申请拆分为工作票 / 操作票两个独立区块，不走单 section 包装
  if (!stepObject?.combined && contentIndex === 8) {
    return <StageEight c={c} ticket={ticket} index={index} />
  }
  // 两票批准拆分为两个独立卡片区块，不走单 section 包装
  if (!stepObject?.combined && contentIndex === 9) {
    return <StageNine c={c} ticket={ticket} index={index} signoffMessages={signoffMessages} renderMessage={renderMessage} branchRole={branchRole} />
  }
  return (
    <section className="ticket-stage-content" aria-label={`步骤 ${index} 业务内容`}>
      <StageHeader index={index} contentIndex={contentIndex} stageMeta={stepObject?.stageMeta} isGenerated={generation.isGenerated} />
      <div
        key={`ticket-stage-${ticket?.id ?? 'ticket'}-${index}`}
        className={`ticket-stage-content__body${generation.isGenerated ? ' is-generated' : ''}${generation.ready ? ' is-revealed' : ' is-generating'}`}
        data-stage-index={index}
        data-progress={generation.progress}
        aria-busy={!generation.ready}
      >
        {generation.ready ? (
          content
        ) : (
          <StageGeneration
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
