import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import {
  ActivityIcon as Activity,
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
  PencilLine,
  Plus,
  Robot as Bot,
  ShieldCheck,
  Sparkle as Sparkles,
  User as UserRound,
  Users,
  Wrench,
  X,
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

// 合并流程「故障诊断」节点的三张票：异常数据票 / AI 诊断卡的头部元信息（缺陷单卡沿用 STEP_META[4]）
const DIAGNOSIS_EVIDENCE_META = { eyebrow: '感知研判 · 证据汇聚', title: '异常数据', copy: '', mode: 'Agent 自动完成' }
const AI_DIAGNOSIS_META = { eyebrow: '异常感知 · AI 诊断', title: 'AI 诊断', copy: '', mode: 'Agent 自动完成' }

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
 * 节点头部的"编辑"按钮，打开对应单据的输入项弹窗
 */
function EditButton({ onClick }) {
  return (
    <button className="ticket-stage-card__edit" type="button" onClick={onClick} aria-haspopup="dialog">
      <PencilLine size={14} aria-hidden="true" />
      <span>编辑</span>
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

/**
 * AI 诊断根因置信度排行：按置信度降序，首位确诊、其余排除
 */
function RootCauseRanking({ threshold, causes }) {
  return (
    <div className="rootcause-ranking">
      <div className="rootcause-ranking__threshold"><span>确诊阈值</span><b>{threshold}</b></div>
      {causes.map(([label, value, percent, tone], index) => (
        <div className={`rootcause-ranking__row is-${tone}`} key={label}>
          <b className="rootcause-ranking__rank">{index + 1}</b>
          <span className="rootcause-ranking__label">{label}</span>
          <i className="rootcause-ranking__track"><b className={`is-${tone}`} style={{ width: `${percent}%` }} /></i>
          <strong className="rootcause-ranking__value">{value}</strong>
          <em className={`rootcause-ranking__verdict${index === 0 ? ' is-hit' : ''}`}>{index === 0 ? '确诊' : '排除'}</em>
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
function StageFour({ c, ticket, index = 4, generation }) {
  const [editOpen, setEditOpen] = useState(false)
  const ready = generation?.ready ?? true

  return (
    <section className="ticket-stage-content" aria-label={`步骤 ${index} 业务内容`}>
      <StageHeader index={index} contentIndex={4} isGenerated action={<EditButton onClick={() => setEditOpen(true)} />} />
      <div
        key={`ticket-stage-${ticket?.id ?? 'ticket'}-${index}`}
        className={`ticket-stage-content__body is-generated${ready ? ' is-revealed' : ' is-generating'}`}
        data-stage-index={index}
        data-progress={generation?.progress ?? 100}
        aria-busy={!ready}
      >
        {ready ? (
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
        <section className="ticket-stage-content" aria-label={`步骤 ${index} 异常数据`}>
          <StageHeader index={index} contentIndex={contentIndex} stageMeta={DIAGNOSIS_EVIDENCE_META} />
          <div
            className="ticket-stage-content__body is-revealed"
            data-stage-index={index}
          >
            {c.stage2.diagnosis ? <DiagnosisEvidence items={c.stage2.diagnosis} /> : null}
          </div>
        </section>
        <section className="ticket-stage-content" aria-label={`步骤 ${index} AI 诊断`}>
          <StageHeader index={index} contentIndex={contentIndex} stageMeta={AI_DIAGNOSIS_META} />
          <div
            className="ticket-stage-content__body is-revealed"
            data-stage-index={index}
          >
            <StageCard title="根因置信度排行" icon={BrainCircuit}>
              <RootCauseRanking causes={c.stage2.causes} threshold={c.stage2.threshold} />
            </StageCard>
          </div>
        </section>
        <StageFour c={c} ticket={ticket} index={index} generation={generation} />
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
