export const roles = [
  {
    id: 'technical',
    name: '运维值班员',
    title: '运维值班员',
    description: '复核异常判断并确认缺陷单。',
    approvalSteps: [3, 5],
  },
  {
    id: 'operations',
    name: '运维负责人',
    title: '流域运维负责人',
    description: '负责排程、操作票与关单审批。',
    approvalSteps: [7, 9, 12],
  },
  {
    id: 'control',
    name: '工作许可人',
    title: '工作许可人',
    description: '审批工作票与工序单，确认安全措施完备。',
    approvalSteps: [9],
  },
  {
    id: 'field',
    name: '现场工程师',
    title: '现场执行工程师',
    description: '执行工单、回传现场证据并配合复测。',
    approvalSteps: [8],
  },
  {
    id: 'admin',
    name: '管理员',
    title: '系统管理员',
    description: '演示环境中可代办全部人工审批。',
    approvalSteps: [3, 5, 7, 8, 9, 12],
  },
]

export const agents = [
  {
    id: 'orchestrator',
    name: '总控Agent',
    shortName: '总控',
    type: 'agent',
    color: '#8d6ce5',
    status: '协调中',
    workload: 7,
    completedToday: 18,
    description: '跨智能体编排与任务状态汇总',
  },
  {
    id: 'perception',
    name: '感知Agent',
    shortName: '感知',
    type: 'agent',
    color: '#796eeb',
    status: '执行中',
    workload: 4,
    completedToday: 12,
    description: '融合 SCADA、无人机与巡检机器人数据',
  },
  {
    id: 'diagnosis',
    name: '诊断Agent',
    shortName: '诊断',
    type: 'agent',
    color: '#687bef',
    status: '执行中',
    workload: 3,
    completedToday: 9,
    description: '进行故障定位、根因分析与风险评估',
  },
  {
    id: 'dispatch',
    name: '派单Agent',
    shortName: '派单',
    type: 'agent',
    color: '#5c88f3',
    status: '执行中',
    workload: 5,
    completedToday: 8,
    description: '生成工单、优化排程并预审两票',
  },
  {
    id: 'execution',
    name: '执行Agent',
    shortName: '执行',
    type: 'agent',
    color: '#5194f6',
    status: '执行中',
    workload: 3,
    completedToday: 6,
    description: '协同现场人员导航、作业和证据回传',
  },
  {
    id: 'validation',
    name: '验证Agent',
    shortName: '验证',
    type: 'agent',
    color: '#46a0f8',
    status: '执行中',
    workload: 2,
    completedToday: 7,
    description: '对比消缺前后数据并生成复测结论',
  },
  {
    id: 'knowledge',
    name: '知识Agent',
    shortName: '知识',
    type: 'agent',
    color: '#37adf8',
    status: '执行中',
    workload: 2,
    completedToday: 5,
    description: '沉淀案例、复盘作业策略并更新知识库',
  },
  {
    id: 'inspection',
    name: '巡检Agent',
    shortName: '巡检',
    type: 'agent',
    color: '#2fbbf0',
    status: '执行中',
    workload: 3,
    completedToday: 6,
    description: '规划巡检路线并协同无人机完成数据采集与分析',
  },
]

// 无用代码（待确认后删除）：各角色默认推送的一级导航智能体
// export const roleAgents = {
//   technical: ['diagnosis', 'inspection', 'knowledge'],
//   operations: ['dispatch', 'validation', 'knowledge'],
//   control: ['dispatch'],
//   field: ['execution'],
// }

export const stations = [
  {
    id: 'lianghekou',
    name: '两河口光储电站',
    shortName: '两河口',
    type: '光伏 + 储能',
    capacity: '1.08 GW',
    health: 89,
    availability: '98.32',
    status: 'warning',
    statusLabel: '需关注',
    location: '四川省甘孜州雅江县',
    coordinates: '30.20°N / 101.02°E',
    weather: '晴 18℃ · 辐照 824 W/m²',
    weatherDetail: { condition: '晴', temperature: '18℃', irradiance: '824 W/m²', wind: '2.8 m/s' },
    output: '823.6 MW',
    metrics: { power: '823.6', generation: '6.42 GWh', pr: '83.7%', storageSoc: '68%' },
    alerts: [
      { id: 'A-LHK-001', deviceId: 'LHK-PV-03-07', severity: 'urgent', title: '#3方阵 7号组串热斑', time: '今日 08:42', status: '待复核' },
      { id: 'A-LHK-002', deviceId: 'LHK-CB-04', severity: 'warning', title: '汇流箱 04 绝缘阻抗低', time: '今日 07:58', status: '待处置' },
    ],
    devices: [
      { id: 'LHK-PV-03-07', name: '#3方阵 7号组串', type: '光伏组串', status: 'urgent', statusLabel: '严重告警', health: 61, power: '18.4 kW', issue: '热斑温差持续扩大', model: 'YJ-PV-550', sn: 'PV0307-2023-184', metrics: [{ id: 'temperature', label: '组件峰值温度', value: '84.6', unit: '℃', state: '异常' }, { id: 'current', label: '组串电流', value: '8.12', unit: 'A', state: '偏低' }, { id: 'voltage', label: '组串电压', value: '1,086', unit: 'V', state: '正常' }] },
      { id: 'LHK-CB-04', name: '汇流箱 04', type: '直流汇流箱', status: 'warning', statusLabel: '预警', health: 76, power: '382 kW', issue: '绝缘阻抗低告警', model: 'YJ-CB-20', sn: 'CB04-2022-062', metrics: [{ id: 'insulation', label: '绝缘阻抗', value: '0.42', unit: 'MΩ', state: '预警' }, { id: 'current', label: '直流输入电流', value: '386', unit: 'A', state: '正常' }, { id: 'voltage', label: '直流输入电压', value: '1,012', unit: 'V', state: '正常' }] },
      { id: 'LHK-ESS-01', name: '1#储能方阵', type: '储能单元', status: 'normal', statusLabel: '正常', health: 96, power: '-42.6 MW', issue: '', model: 'YJ-ESS-2.5', sn: 'ESS01-2024-001', metrics: [{ id: 'soc', label: 'SOC', value: '68', unit: '%', state: '正常' }, { id: 'soh', label: 'SOH', value: '97', unit: '%', state: '正常' }, { id: 'temperature', label: '电池均温', value: '27.1', unit: '℃', state: '正常' }] },
    ],
  },
  {
    id: 'kela',
    name: '柯拉一期光伏电站',
    shortName: '柯拉一期',
    type: '光伏',
    capacity: '1.00 GW',
    health: 96,
    availability: '99.08',
    status: 'normal',
    statusLabel: '运行正常',
    location: '四川省甘孜州雅江县',
    coordinates: '29.99°N / 101.37°E',
    weather: '多云 16℃ · 辐照 716 W/m²',
    weatherDetail: { condition: '多云', temperature: '16℃', irradiance: '716 W/m²', wind: '3.2 m/s' },
    output: '768.2 MW',
    metrics: { power: '768.2', generation: '5.96 GWh', pr: '86.4%', curtailment: '0.8%' },
    alerts: [
      { id: 'A-KELA-001', deviceId: 'KELA-INV-02-07', severity: 'urgent', title: '2区 #07 逆变器脱网', time: '今日 08:09', status: '待复核' },
    ],
    devices: [
      { id: 'KELA-INV-02-07', name: '2区 #07 逆变器', type: '组串式逆变器', status: 'urgent', statusLabel: '告警', health: 74, power: '0 kW', issue: '交流侧瞬时脱网', model: 'SUN2000-300KTL', sn: 'INV0207-2023-071', metrics: [{ id: 'voltage', label: '交流输出电压', value: '0', unit: 'V', state: '异常' }, { id: 'frequency', label: '电网频率', value: '49.98', unit: 'Hz', state: '正常' }, { id: 'temperature', label: '机内温度', value: '46.2', unit: '℃', state: '正常' }] },
      { id: 'KELA-PV-05-08', name: '#5方阵 第8-12组串', type: '光伏组串', status: 'warning', statusLabel: '需维护', health: 82, power: '86.7 kW', issue: '组串电流失配率 19%', model: 'YJ-PV-550', sn: 'PV0508-2023-208', metrics: [{ id: 'mismatch', label: '组串电流失配率', value: '19', unit: '%', state: '预警' }, { id: 'current', label: '组串电流', value: '7.86', unit: 'A', state: '偏低' }, { id: 'temperature', label: '组件温度', value: '41.8', unit: '℃', state: '正常' }] },
      { id: 'KELA-INV-01-03', name: '1区 #03 逆变器', type: '组串式逆变器', status: 'normal', statusLabel: '正常', health: 98, power: '286 kW', issue: '', model: 'SUN2000-300KTL', sn: 'INV0103-2023-014', metrics: [{ id: 'efficiency', label: '转换效率', value: '98.7', unit: '%', state: '正常' }, { id: 'frequency', label: '电网频率', value: '50.01', unit: 'Hz', state: '正常' }, { id: 'temperature', label: '机内温度', value: '42.4', unit: '℃', state: '正常' }] },
    ],
  },
  {
    id: 'zhalashan',
    name: '扎拉山光储电站',
    shortName: '扎拉山',
    type: '光伏 + 储能',
    capacity: '1.17 GW',
    health: 92,
    availability: '98.76',
    status: 'warning',
    statusLabel: '需关注',
    location: '四川省凉山州木里县',
    coordinates: '28.24°N / 100.83°E',
    weather: '晴 21℃ · 辐照 862 W/m²',
    weatherDetail: { condition: '晴', temperature: '21℃', irradiance: '862 W/m²', wind: '3.7 m/s' },
    output: '914.8 MW',
    metrics: { power: '914.8', generation: '7.08 GWh', pr: '84.9%', storageSoc: '74%' },
    alerts: [
      { id: 'A-ZLS-001', deviceId: 'ZLS-PV-07', severity: 'warning', title: '#7方阵低辐照组串反灌', time: '今日 08:31', status: '待复核' },
      { id: 'A-ZLS-002', deviceId: 'ZLS-INV-14', severity: 'warning', title: '#14 逆变器残余电流异常', time: '昨天 18:46', status: '待处置' },
    ],
    devices: [
      { id: 'ZLS-PV-07', name: '#7方阵组串', type: '光伏子阵', status: 'warning', statusLabel: '预警', health: 72, power: '72.3 MW', issue: '低辐照时段反灌多发', model: 'YJ-PV-550', sn: 'ZLS-PV07-2024', metrics: [{ id: 'reverse-events', label: '季度反灌次数', value: '12', unit: '次', state: '异常' }, { id: 'reverse-current', label: '最大反向电流', value: '-2.6', unit: 'A', state: '预警' }, { id: 'share', label: '全站事件占比', value: '71', unit: '%', state: '预警' }] },
      { id: 'ZLS-INV-14', name: '#14 逆变器', type: '集中式逆变器', status: 'warning', statusLabel: '需维护', health: 79, power: '2.41 MW', issue: '残余电流异常', model: 'YJ-CI-3.125', sn: 'ZLS-INV14-2024', metrics: [{ id: 'leakage', label: '残余电流', value: '286', unit: 'mA', state: '预警' }, { id: 'alarms', label: '季度告警次数', value: '8', unit: '次', state: '预警' }, { id: 'temperature', label: '机内温度', value: '48.1', unit: '℃', state: '正常' }] },
      { id: 'ZLS-ESS-02', name: '2#储能方阵', type: '储能单元', status: 'normal', statusLabel: '正常', health: 95, power: '36.8 MW', issue: '', model: 'YJ-ESS-2.5', sn: 'ZLS-ESS02-2024', metrics: [{ id: 'soc', label: 'SOC', value: '74', unit: '%', state: '正常' }, { id: 'soh', label: 'SOH', value: '96', unit: '%', state: '正常' }, { id: 'temperature', label: '电池均温', value: '26.8', unit: '℃', state: '正常' }] },
    ],
  },
  {
    id: 'labashan',
    name: '腊巴山光风储电站',
    shortName: '腊巴山',
    type: '光伏 + 风电 + 储能',
    capacity: '2.17 GW',
    health: 94,
    availability: '98.91',
    status: 'normal',
    statusLabel: '运行正常',
    location: '四川省凉山州德昌县',
    coordinates: '27.22°N / 102.12°E',
    weather: '少云 23℃ · 风速 6.4 m/s',
    weatherDetail: { condition: '少云', temperature: '23℃', irradiance: '792 W/m²', wind: '6.4 m/s' },
    output: '1.63 GW',
    metrics: { power: '1.63 GW', generation: '12.68 GWh', pr: '85.6%', windAvailability: '97.9%' },
    alerts: [
      { id: 'A-LBS-001', deviceId: 'LBS-WT-16', severity: 'warning', title: '#16 风机叶片轻度裂纹', time: '昨天 16:28', status: '计划复检' },
    ],
    devices: [
      { id: 'LBS-WT-16', name: '#16 风机', type: '风力发电机', status: 'warning', statusLabel: '需维护', health: 84, power: '4.82 MW', issue: '叶片轻度裂纹需复检', model: 'YJ-WT-6.25', sn: 'LBS-WT16-2024', metrics: [{ id: 'vibration', label: '机舱振动', value: '2.8', unit: 'mm/s', state: '正常' }, { id: 'rpm', label: '转速', value: '10.6', unit: 'rpm', state: '正常' }, { id: 'wind', label: '实时风速', value: '6.4', unit: 'm/s', state: '正常' }] },
      { id: 'LBS-PV-02', name: '#2 光伏方阵', type: '光伏子阵', status: 'normal', statusLabel: '正常', health: 97, power: '84.6 MW', issue: '', model: 'YJ-PV-550', sn: 'LBS-PV02-2024', metrics: [{ id: 'pr', label: 'PR', value: '86.8', unit: '%', state: '正常' }, { id: 'current', label: '组串电流', value: '9.42', unit: 'A', state: '正常' }, { id: 'temperature', label: '组件温度', value: '39.4', unit: '℃', state: '正常' }] },
      { id: 'LBS-ESS-01', name: '1#储能方阵', type: '储能单元', status: 'normal', statusLabel: '正常', health: 96, power: '-56.2 MW', issue: '', model: 'YJ-ESS-2.5', sn: 'LBS-ESS01-2024', metrics: [{ id: 'soc', label: 'SOC', value: '63', unit: '%', state: '正常' }, { id: 'soh', label: 'SOH', value: '97', unit: '%', state: '正常' }, { id: 'temperature', label: '电池均温', value: '27.5', unit: '℃', state: '正常' }] },
    ],
  },
]

export const flowSteps = [
  { index: 1, id: 'sense', shortLabel: '感知', name: '异常感知', stage: '感知研判', executor: '感知Agent', executorId: 'perception', executorType: 'agent', advanceMode: 'auto' },
  { index: 2, id: 'diagnose', shortLabel: '诊断', name: 'AI 诊断', stage: '感知研判', executor: '诊断Agent', executorId: 'diagnosis', executorType: 'agent', advanceMode: 'auto' },
  { index: 3, id: 'review', shortLabel: '复核', name: '异常复核', stage: '感知研判', executor: '技术负责人', executorId: 'technical', executorType: 'human', approverRole: 'technical', advanceMode: 'approval' },
  { index: 4, id: 'defect', shortLabel: '缺陷单', name: '缺陷单生成', stage: '缺陷生成', executor: '诊断Agent', executorId: 'diagnosis', executorType: 'agent', advanceMode: 'space' },
  { index: 5, id: 'work-order', shortLabel: '工单', name: '工单生成', stage: '缺陷生成', executor: '技术负责人', executorId: 'technical', executorType: 'human', approverRole: 'technical', advanceMode: 'approval' },
  { index: 6, id: 'schedule', shortLabel: '排程', name: '工单排程', stage: '派单执行', executor: '派单Agent', executorId: 'dispatch', executorType: 'agent', advanceMode: 'space' },
  { index: 7, id: 'schedule-approval', shortLabel: '排程批', name: '排程批准', stage: '派单执行', executor: '运维负责人', executorId: 'operations', executorType: 'human', approverRole: 'operations', advanceMode: 'approval' },
  { index: 8, id: 'permit-request', shortLabel: '两票申请', name: '工作票与操作票申请', stage: '派单执行', executor: '派单Agent · 现场工程师', executorId: 'dispatch', executorType: 'agent', approverRole: 'field', advanceMode: 'approval' },
  { index: 9, id: 'permit-approval', shortLabel: '两票批准', name: '工作票与操作票批准', stage: '派单执行', executor: '运维负责人', executorId: 'operations', executorType: 'human', approverRole: 'operations', advanceMode: 'approval' },
  { index: 10, id: 'execute', shortLabel: '执行', name: '现场执行', stage: '派单执行', executor: '执行Agent · 现场工程师', executorId: 'execution', executorType: 'agent', advanceMode: 'space' },
  { index: 11, id: 'validate', shortLabel: '验证', name: '复测验证', stage: '缺陷闭环', executor: '验证Agent', executorId: 'validation', executorType: 'agent', advanceMode: 'space' },
  { index: 12, id: 'close', shortLabel: '关单', name: '关闭工单批准', stage: '缺陷闭环', executor: '运维负责人', executorId: 'operations', executorType: 'human', approverRole: 'operations', advanceMode: 'approval' },
  { index: 13, id: 'learn', shortLabel: '沉淀', name: 'AI 复盘沉淀', stage: '缺陷闭环', executor: '知识Agent', executorId: 'knowledge', executorType: 'agent', advanceMode: 'auto' },
]

const SPACE_ADVANCE_STEPS = [4, 6, 10, 11]

// 第二种流程：感知+诊断+复核+缺陷单合并为"故障诊断"，工单批准+工单排程合并为"工单"。
// contentStep 指向 13 步流程的原始内容节点，combined 标记该节点需要拼接多个原始节点的内容。
export const flowStepsV2 = [
  { index: 1, id: 'diagnose', shortLabel: '故障诊断', name: '故障诊断', stage: '感知研判', executor: '运维值班员', executorId: 'technical', executorType: 'human', approverRole: 'technical', advanceMode: 'approval', contentStep: 2, combined: 'diagnose-defect', stageMeta: { eyebrow: '感知研判 · 数据汇聚与诊断', title: 'AI 诊断', copy: '感知数据已汇聚，多源证据对齐后完成根因诊断，运维值班员确认缺陷后转工单。', mode: '人工审批' } },
  { index: 2, id: 'work-order-approval', shortLabel: '工单核定', name: '工单核定', stage: '派单执行', executor: '运维负责人', executorId: 'operations', executorType: 'human', approverRole: 'operations', advanceMode: 'approval', contentStep: 5, combined: 'order-schedule', stageMeta: { eyebrow: '派单执行 · 工单与排程', title: '工单', copy: '运维负责人确认工单内容与排程方案后批准工单。', mode: '人工审批' } },
  { index: 3, id: 'permit-request', shortLabel: '两票提交', name: '两票提交', stage: '派单执行', executor: '现场工程师', executorId: 'dispatch', executorType: 'agent', approverRole: 'field', advanceMode: 'approval', contentStep: 8 },
  { index: 4, id: 'permit-approval', shortLabel: '作业审批', name: '作业审批', stage: '派单执行', executor: '工作许可人 · 运维负责人', executorId: 'control', executorType: 'human', approverRole: 'control', approverRoles: ['control', 'operations'], advanceMode: 'approval', contentStep: 9 },
  { index: 5, id: 'execute', shortLabel: '现场作业', name: '现场作业', stage: '派单执行', executor: '现场工程师', executorId: 'execution', executorType: 'agent', advanceMode: 'space', contentStep: 10 },
  { index: 6, id: 'validate', shortLabel: '结果验证', name: '结果验证', stage: '缺陷闭环', executor: '验证Agent', executorId: 'validation', executorType: 'agent', advanceMode: 'space', contentStep: 11 },
  { index: 7, id: 'close', shortLabel: '工单结案', name: '工单结案', stage: '缺陷闭环', executor: '运维负责人', executorId: 'operations', executorType: 'human', approverRole: 'operations', advanceMode: 'approval', contentStep: 12 },
  { index: 8, id: 'learn', shortLabel: '案例沉淀', name: '案例沉淀', stage: '缺陷闭环', executor: '知识Agent', executorId: 'knowledge', executorType: 'agent', advanceMode: 'auto', contentStep: 13 },
]

export const flowVariants = {
  standard: {
    id: 'standard',
    label: '标准流程（13步）',
    steps: flowSteps,
    spaceSteps: SPACE_ADVANCE_STEPS,
    rejectTargets: { 5: 5, 7: 7, 8: 7, 9: 8, 12: 10 },
    reviewStep: 3,
  },
  merged: {
    id: 'merged',
    label: '合并流程（8步）',
    steps: flowStepsV2,
    spaceSteps: [4, 5, 6],
    rejectTargets: { 2: 1, 3: 2, 4: 3, 7: 5 },
    reviewStep: 1,
  },
  // 版本3：流程内容与合并流程一致，但不渲染页面底部的步骤条
  v3: {
    id: 'v3',
    label: '版本3',
    steps: flowStepsV2,
    spaceSteps: [4, 5, 6],
    rejectTargets: { 2: 1, 3: 2, 4: 3, 7: 5 },
    reviewStep: 1,
    hideTaskFlow: true,
  },
}

// 两种流程的节点索引换算，用于切换流程时迁移任务进度
export const STANDARD_TO_MERGED_STEP = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 3, 9: 4, 10: 5, 11: 6, 12: 7, 13: 8 }
export const MERGED_TO_STANDARD_STEP = { 1: 2, 2: 5, 3: 8, 4: 9, 5: 10, 6: 11, 7: 12, 8: 13 }

/**
 * 解析流程节点当前归属角色，作为角色显示与审批权限的唯一数据源：
 * 审批节点取 approverRole，会签节点按签署进度取当前待签角色，
 * 其余节点按节点 id 映射展示角色
 */
export function resolveStepRole(step, ticket) {
  const id = step?.id ?? ''
  const roleName = (roleId) => roles.find((item) => item.id === roleId)?.name ?? ''

  // 新建缺陷单自动流转的工单：关单节点由标记角色收口（运维值班员）
  if (id === 'close' && ticket?.closeOwnerRole) {
    return { id: ticket.closeOwnerRole, name: roleName(ticket.closeOwnerRole) }
  }

  if (Array.isArray(step?.approverRoles) && step.approverRoles.length) {
    const required = step.approverRoles.filter((item) => item !== 'operations' || Boolean(ticket?.operationPermitEnabled))
    const pending = required.find((item) => !ticket?.permitSignoffs?.[item]) ?? required[required.length - 1]
    return { id: pending, name: roleName(pending) }
  }
  if (step?.approverRole) {
    return { id: step.approverRole, name: roleName(step.approverRole) }
  }
  if (['sense', 'diagnose', 'defect', 'collect', 'analyze'].includes(id)) return { id: 'technical', name: roleName('technical') }
  if (['work-order', 'schedule'].includes(id)) return { id: 'operations', name: roleName('operations') }
  if (id === 'execute') return { id: 'field', name: roleName('field') }
  if (id === 'learn') return { id: 'admin', name: roleName('admin') }
  return { id: 'operations', name: roleName('operations') }
}

export const cockpitKpis = [
  { id: 'generation', label: '今日发电量', value: '32.14', unit: 'GWh', trend: '+4.8%', tone: 'normal', trendTone: 'positive', note: '较昨日同期', caption: '较昨日同期' },
  { id: 'power', label: '实时功率', value: '4.14', unit: 'GW', trend: '+1.6%', tone: 'normal', trendTone: 'positive', note: '额定容量 5.42 GW', caption: '额定容量 5.42 GW' },
  { id: 'availability', label: '设备可用率', value: '98.76', unit: '%', trend: '+0.32%', tone: 'normal', trendTone: 'positive', note: '本月平均', caption: '本月平均' },
  { id: 'tasks', label: '在办任务', value: '7', unit: '项', trend: '+3', tone: 'warning', trendTone: 'warning', note: '3 项待审批', caption: '今日已完成 18 项' },
  { id: 'alerts', label: '未闭环告警', value: '12', unit: '条', trend: '-5', tone: 'urgent', trendTone: 'positive', note: '3 条严重', caption: '较昨日 -5 条' },
  { id: 'agents', label: 'Agent 在线', value: '7', unit: '/ 7', trend: '+2', tone: 'storage', trendTone: 'positive', note: '当前队列 26 项', caption: '当前队列 26 项' },
]

const ticketHistory = {
  hotspot: [
    { id: 'H-001-1', step: 1, type: 'agent', actor: '异常感知', role: 'perception', time: '08:42', title: '无人机红外异常感知', content: '#3方阵第7组串电流 6.1A，较同方阵均值 7.9A 低 23%；红外最高温差 38℃，已触发规则 R-017。', attachments: ['红外影像 4 张', 'SCADA 趋势 24h', 'IV 曲线扫描'] },
    { id: 'H-001-2', step: 2, type: 'agent', actor: 'AI 诊断', role: 'diagnosis', time: '08:44', title: 'AI 根因诊断完成', content: '结合温差、电流偏差与 IV 曲线，组件热斑置信度 91%，达到 90% 确诊阈值，建议人工复核。', attachments: ['AI 诊断报告 v1'] },
  ],
  reverse: [
    { id: 'H-002-1', step: 1, type: 'agent', actor: '异常感知', role: 'perception', time: '08:31', title: '低辐照反灌异常聚类', content: '近 30 日反灌 12 次，71% 集中于 #7 方阵早晚低辐照时段。', attachments: ['反灌事件序列'] },
    { id: 'H-002-2', step: 2, type: 'agent', actor: 'AI 诊断', role: 'diagnosis', time: '08:35', title: '回路防反保护诊断', content: '诊断指向防反二极管性能衰减，不影响当前并网安全，建议计划性处置。', attachments: ['回路损耗对比'] },
  ],
  trip: [
    { id: 'H-003-1', step: 1, type: 'agent', actor: '异常感知', role: 'perception', time: '08:18', title: '逆变器脱网事件感知', content: '2区 #07 逆变器在 08:09 保护性脱网，相邻设备运行正常。', attachments: ['故障录波 12s', '告警序列'] },
    { id: 'H-003-2', step: 2, type: 'agent', actor: 'AI 诊断', role: 'diagnosis', time: '08:22', title: '交流侧瞬时过压诊断', content: '故障录波与站端保护数据一致，疑似交流侧接触器抖动，需现场检查。', attachments: ['AI 诊断报告 v1'] },
  ],
}

export const initialTickets = [
  {
    id: 'DF-20260820-001',
    demoKey: 'hotspot',
    type: '缺陷单',
    title: '两河口 #3方阵 7号组串热斑',
    station: '两河口光储电站',
    stationId: 'lianghekou',
    deviceId: 'LHK-PV-03-07',
    severity: '严重',
    status: '待运维值班员确认',
    stage: 'defect',
    currentStep: 1,
    assignee: '运维值班员',
    updatedAt: '08-20 08:44',
    description: '第7组串电流 6.1A，较同方阵均值低 23%；红外最高温差 38℃，AI 判断组件热斑置信度 91%。',
    workflowIds: {
      ticket: 'WO-20260813-012',
      event: 'EVT-20260812-0092',
      defect: 'QXD-20260813-012',
      workOrder: 'GD-20260813-017',
      workPermit: 'GZP-20260813-031',
      operationPermit: 'CZP-20260813-045',
      operationPermitBase: 'CZP-20260813-045',
      case: 'CA-2026-0147',
    },
    evidence: [
      { id: 'E-001-1', source: '无人机红外', label: '红外最高温差', value: '38℃', baseline: '验收标准 ≤8℃', status: '异常', time: '08:42' },
      { id: 'E-001-2', source: 'SCADA', label: '组串电流', value: '6.1 A', baseline: '同方阵均值 7.9 A', status: '偏低 23%', time: '08:42' },
      { id: 'E-001-3', source: 'AI 诊断', label: '组件热斑置信度', value: '91%', baseline: '确诊阈值 90%', status: '高置信', time: '08:44' },
    ],
    history: ticketHistory.hotspot,
  },
  {
    id: 'DF-20260820-002',
    type: '缺陷单',
    title: '扎拉山 #7方阵组串反灌',
    station: '扎拉山光储电站',
    stationId: 'zhalashan',
    deviceId: 'ZLS-PV-07',
    severity: '高',
    status: '待运维值班员确认',
    stage: 'defect',
    currentStep: 1,
    assignee: '运维值班员',
    updatedAt: '08-20 08:35',
    description: '#7方阵季度累计发生组串反灌 12 次，集中于早晚低辐照时段，占全站同类事件 71%。',
    evidence: [
      { id: 'E-002-1', source: 'SCADA', label: '季度反灌次数', value: '12 次', baseline: '站级均值 2 次', status: '异常', time: '08:31' },
      { id: 'E-002-2', source: '事件聚类', label: '全站占比', value: '71%', baseline: '阈值 30%', status: '异常', time: '08:33' },
      { id: 'E-002-3', source: 'AI 诊断', label: '防反回路衰减置信度', value: '87%', baseline: '阈值 80%', status: '高置信', time: '08:35' },
    ],
    history: ticketHistory.reverse,
  },
  {
    id: 'DF-20260820-003',
    type: '缺陷单',
    title: '柯拉一期 2区 #07 逆变器脱网',
    station: '柯拉一期光伏电站',
    stationId: 'kela',
    deviceId: 'KELA-INV-02-07',
    severity: '严重',
    status: '待运维值班员确认',
    stage: 'defect',
    currentStep: 1,
    assignee: '运维值班员',
    updatedAt: '08-20 08:22',
    description: '2区 #07 逆变器保护性脱网，录波显示交流侧瞬时过压且接触器状态抖动，建议现场检查。',
    evidence: [
      { id: 'E-003-1', source: '故障录波', label: '交流侧峰值电压', value: '1.18 p.u.', baseline: '限值 1.10 p.u.', status: '越限', time: '08:09' },
      { id: 'E-003-2', source: 'SCADA', label: '有功功率', value: '286 → 0 kW', baseline: '相邻设备稳定', status: '跳变', time: '08:09' },
      { id: 'E-003-3', source: 'AI 诊断', label: '接触器抖动置信度', value: '89%', baseline: '阈值 80%', status: '高置信', time: '08:22' },
    ],
    history: ticketHistory.trip,
  },
  {
    // 运维负责人演示工单：停在「工单核定」节点，总览面板推送待批准
    id: 'DF-20260820-004',
    type: '缺陷单',
    title: '两河口 #3方阵 7号组串热斑处置',
    station: '两河口光储电站',
    stationId: 'lianghekou',
    deviceId: 'LHK-PV-03-07',
    severity: '严重',
    status: '待运维负责人审批',
    stage: 'dispatch',
    currentStep: 2,
    assignee: '运维负责人',
    updatedAt: '08-20 09:06',
    description: '缺陷信息已确认，消缺工单 GD-20260813-017 已生成，待运维负责人核定批准。',
    workflowIds: {
      ticket: 'WO-20260813-012',
      event: 'EVT-20260812-0092',
      defect: 'QXD-20260813-012',
      workOrder: 'GD-20260813-017',
      workPermit: 'GZP-20260813-031',
      operationPermit: 'CZP-20260813-045',
      operationPermitBase: 'CZP-20260813-045',
      case: 'CA-2026-0147',
    },
    evidence: [
      { id: 'E-004-1', source: '无人机红外', label: '红外最高温差', value: '38℃', baseline: '验收标准 ≤8℃', status: '异常', time: '08:42' },
      { id: 'E-004-2', source: 'SCADA', label: '组串电流', value: '6.1 A', baseline: '同方阵均值 7.9 A', status: '偏低 23%', time: '08:42' },
      { id: 'E-004-3', source: 'AI 诊断', label: '组件热斑置信度', value: '91%', baseline: '确诊阈值 90%', status: '高置信', time: '08:44' },
    ],
    history: [
      ...ticketHistory.hotspot,
      { id: 'H-004-3', step: 1, type: 'human', actor: '运维值班员 王磊', role: 'technical', time: '09:05', title: '缺陷信息已确认', content: '缺陷信息确认无误，同意转工单处置。', attachments: [] },
      { id: 'H-004-4', step: 1, type: 'agent', actor: '派单Agent', role: 'dispatch', time: '09:06', title: '工单已生成', content: '工单 GD-20260813-017 已生成，推送运维负责人批准。', attachments: [] },
    ],
  },
  {
    id: 'INS-20260715-001',
    type: '巡检任务',
    flowType: 'inspection',
    title: '2026 Q3 巡检任务',
    station: '雅砻江流域四站',
    stationId: 'lianghekou',
    stationIds: ['lianghekou', 'kela', 'zhalashan', 'labashan'],
    inspectionMode: 'drone',
    severity: '关注',
    status: '待运维值班员审批',
    stage: 'inspection',
    currentStep: 4,
    assignee: '运维值班员',
    updatedAt: '08-20 17:40',
    description: '2026 Q3 智能巡检覆盖 4 座在运电站，报告已生成，待运维值班员审批发布。',
    purpose: '季度智能巡检与报告发布',
    evidence: [],
    history: [
      { id: 'INS-Q3-1', step: 1, type: 'human', actor: '运维值班员', role: 'technical', time: '07-15 09:12', title: '巡检计划已确认', content: '四站无人机巡检路线方案已确认，进入数据采集阶段。' },
      { id: 'INS-Q3-2', step: 2, type: 'agent', actor: '巡检Agent', role: 'perception', time: '07-28 18:02', title: '数据采集完成', content: '126 项巡检任务数据全部回传归档，含红外影像与 SCADA 24h 回放。' },
      { id: 'INS-Q3-3', step: 3, type: 'agent', actor: '巡检Agent', role: 'diagnosis', time: '08-10 16:45', title: '智能分析完成', content: '发现异常 47 项，19 项转缺陷单，4 类高风险问题已定位。' },
    ],
  },
]

// 无用代码（待确认后删除）：initialTickets 的旧别名
// export const tickets = initialTickets

// 运维负责人演示工单：停在「工单核定」节点，总览面板推送待批准，批准后走对话演示流
export const OPS_DEMO_TICKET_ID = 'DF-20260820-004'

export const reportActions = [
  { id: 'generate-defect', label: '一键生成缺陷单', type: 'defect', description: '将已确诊问题直接送入工单生成步骤', status: '待处理', ticketId: null },
  { id: 'create-onsite', label: '生成现场任务', type: 'onsite', description: '生成现场检查工单并提交技术负责人', status: '待处理', ticketId: null },
  { id: 'start-iv', label: '发起 IV 诊断', type: 'diagnosis', description: '从异常感知开始执行完整诊断流程', status: '待处理', ticketId: null },
  { id: 'start-drone', label: '发起无人机巡检', type: 'drone', description: '新建精细化无人机复测任务', status: '待处理', ticketId: null },
  { id: 'add-watchlist', label: '加入观察清单', type: 'watch', description: '保留问题并纳入下个巡检周期', status: '待处理', ticketId: null },
  { id: 'dismiss-advice', label: '关闭该建议', type: 'dismiss', description: '归档建议且不再生成任务', status: '待处理', ticketId: null },
]

// 无用代码（待确认后删除）：reportActions 的旧别名
// export const actions = reportActions

export const reportSections = [
  {
    id: 'overview',
    index: 1,
    title: '一、季度巡检总览',
    subtitle: '巡检周期 2026-07-15 – 08-10',
    status: '已完成',
    summary: '四站实现全量数据巡检，高风险问题已全部进入处置流程。',
    metrics: [
      { label: '巡检任务', value: '126', unit: '项' },
      { label: '执行完成率', value: '100', unit: '%' },
      { label: '覆盖电站', value: '4', unit: '座' },
      { label: '无人机巡检', value: '12', unit: '架次' },
      { label: '发现异常', value: '47', unit: '项' },
      { label: '新增缺陷单', value: '19', unit: '张' },
      { label: '已闭环', value: '41', unit: '项' },
      { label: '闭环率', value: '87.2', unit: '%' },
    ],
    items: [],
    actionIds: [],
  },
  {
    id: 'station-health',
    index: 2,
    title: '二、电站健康排行',
    subtitle: '基于可用率、告警、发电性能与缺陷闭环综合评估',
    status: '已评估',
    summary: '柯拉一期综合表现最佳；两河口受热斑与绝缘预警影响，健康度环比下降 3 分。',
    metrics: [],
    items: [
      { rank: 1, stationId: 'kela', name: '柯拉一期光伏电站', health: 96, change: '+1', issues: 2, status: '正常' },
      { rank: 2, stationId: 'labashan', name: '腊巴山光风储电站', health: 94, change: '0', issues: 1, status: '正常' },
      { rank: 3, stationId: 'zhalashan', name: '扎拉山光储电站', health: 92, change: '-1', issues: 4, status: '需关注' },
      { rank: 4, stationId: 'lianghekou', name: '两河口光储电站', health: 89, change: '-3', issues: 5, status: '需关注' },
    ],
    actionIds: [],
  },
  {
    id: 'problem-map',
    index: 3,
    title: '三、问题全景',
    subtitle: 'TOP10 问题与频率 × 风险分布',
    status: '47 项问题',
    summary: '反灌、组串失配和逆变器瞬时脱网构成本季度主要问题簇。',
    metrics: [],
    items: [
      { rank: 1, title: '低辐照组串反灌', count: 12, risk: '高', frequency: '高', stations: ['扎拉山'], devices: ['#7方阵组串'], trend: '+18%' },
      { rank: 2, title: '光伏组件热斑', count: 32, risk: '严重', frequency: '中', stations: ['两河口', '柯拉一期'], devices: ['#3方阵7号组串', '#9方阵'], trend: '+9%' },
      { rank: 3, title: '组串电流失配', count: 27, risk: '高', frequency: '中', stations: ['柯拉一期', '两河口'], devices: ['#5方阵第8-12组串'], trend: '-4%' },
      { rank: 4, title: '逆变器瞬时脱网', count: 11, risk: '严重', frequency: '低', stations: ['柯拉一期'], devices: ['2区#07逆变器'], trend: '+3%' },
    ],
    actionIds: [],
  },
  {
    id: 'priority-risks',
    index: 4,
    title: '四、重点风险',
    subtitle: '四类高风险场景及 AI 分析证据',
    status: '4 类风险',
    summary: '两项风险可能造成停机或直流侧安全事件，建议 72 小时内完成现场处置。',
    metrics: [],
    items: [
      { id: 'risk-hotspot', title: '组件热斑持续恶化', level: '严重', count: 4, station: '两河口', device: '#3方阵7号组串', insight: '最高温度 84.6℃，热斑面积较上次复检增长 12%。', evidence: ['无人机红外复测', 'IV 曲线阶梯特征', 'SCADA 电流偏差'], recommendation: '确认缺陷并安排组件更换。', diagnosis: { metrics: [{ label: '组串电流', value: '6.1', unit: 'A', note: '同方阵均值 7.9 A', tone: 'warning' }, { label: '电流偏差', value: '-23', unit: '%', note: '规则 R-017 触发', tone: 'danger' }, { label: '红外最高温差', value: '84.6', unit: '℃', note: '验收标准 ≤8℃', tone: 'danger' }, { label: '热斑面积', value: '+12', unit: '%', note: '较上次复检', tone: 'danger' }], data: [['设备', 'LHK-PV-03-07'], ['组串电压', '1,086 V · 正常'], ['辐照 / 环境', '824 W/m² · 晴 18℃'], ['采集窗口', '过去 24 h · 3 秒刷新']], evidence: [{ source: '无人机红外', label: '红外影像 4 张', value: '已归档' }, { source: 'IV 扫描', label: '曲线阶梯特征', value: '已归档' }, { source: 'SCADA', label: '电流偏差趋势', value: '已归档' }] }, action: { type: 'defect', label: '生成缺陷单', task: { title: '两河口 #3方阵7号组串热斑处置', stationId: 'lianghekou', deviceId: 'LHK-PV-03-07', severity: '严重', currentStep: 4, description: '巡检中已完成感知核验与 AI 诊断，待运维值班员确认缺陷信息。' } } },
      { id: 'risk-trip', title: '逆变器保护性脱网', level: '严重', count: 1, station: '柯拉一期', device: '2区#07逆变器', insight: '交流侧接触器状态抖动，单次损失电量约 0.46 MWh。', evidence: ['12 秒故障录波', '站端保护时序'], recommendation: '安排无人机现场复测确认。', diagnosis: { metrics: [{ label: '脱网次数', value: '1', unit: '次', note: '过去 24 h 内', tone: 'danger' }, { label: '接触器抖动', value: '7', unit: 'ms', note: '阈值 ≤2 ms', tone: 'danger' }, { label: '损失电量', value: '0.46', unit: 'MWh', note: '单次估算', tone: 'warning' }, { label: '交流电压偏差', value: '+4.2', unit: '%', note: '规则 R-023 触发', tone: 'warning' }], data: [['设备', 'KELA-INV-2-07'], ['直流侧输入', '1,102 V · 正常'], ['并网状态', '已重合闸 · 运行中'], ['采集窗口', '过去 24 h · 故障录波']], evidence: [{ source: '故障录波', label: '12 秒录波文件', value: '已归档' }, { source: '站端保护', label: '保护动作时序', value: '已归档' }, { source: 'SCADA', label: '接触器状态量', value: '已归档' }] }, action: { type: 'drone', label: '发起无人机巡检', task: { kind: 'inspection', type: '巡检任务', title: '柯拉一期 2区#07逆变器脱网无人机复测', stationId: 'kela', severity: '严重', currentStep: 1, purpose: '逆变器脱网现场复测', description: '执行红外与可见光同步拍摄，确认交流侧接触器状态。' } } },
      { id: 'risk-backfeed', title: '低辐照组串反灌', level: '高', count: 12, station: '扎拉山', device: '#7方阵组串', insight: '季度反灌 12 次，早晚低辐照时段集中 71%，防反二极管性能衰减形成反灌回路。', evidence: ['SCADA 反灌事件统计', '辐照关联分析', '回路压降复测'], recommendation: '计划检修窗口更换防反二极管并复紧回路接线。', diagnosis: { metrics: [{ label: '季度反灌', value: '12', unit: '次', note: '低辐照时段占 71%', tone: 'danger' }, { label: '回路压降', value: '0.62', unit: 'V', note: '阈值 ≤0.5 V', tone: 'warning' }, { label: '发电损耗', value: '-1.8', unit: '%', note: '约 ¥940/日', tone: 'warning' }, { label: '衰减置信度', value: '87', unit: '%', note: 'AI 诊断', tone: 'warning' }], data: [['设备', 'ZLS-PV-07'], ['组串电压', '1,082 V · 正常'], ['辐照关联', '低辐照时段集中 71%'], ['采集窗口', '本季度 · 逐日统计']], evidence: [{ source: 'SCADA', label: '反灌事件统计', value: '已归档' }, { source: '气象站', label: '辐照关联分析', value: '已归档' }, { source: '现场复测', label: '回路压降记录', value: '已归档' }] }, action: { type: 'defect', label: '生成缺陷单', task: { title: '扎拉山 #7方阵组串反灌处置', stationId: 'zhalashan', deviceId: 'ZLS-PV-07', severity: '高', currentStep: 4, description: '巡检中已完成感知核验与 AI 诊断，待运维值班员确认缺陷信息。' } } },
      { id: 'risk-mismatch', title: '组串失配导致性能损失', level: '中', count: 5, station: '柯拉一期', device: '#5方阵第8-12组串', insight: '电流失配率 19%，估算季度发电量损失 18.6 MWh。', evidence: ['SCADA 同辐照横向对比', '红外影像无热斑'], recommendation: '发起 IV 曲线诊断确认根因。', diagnosis: { metrics: [{ label: '电流失配率', value: '19', unit: '%', note: '阈值 ≤5%', tone: 'danger' }, { label: '发电损失', value: '18.6', unit: 'MWh', note: '季度估算', tone: 'warning' }, { label: '失配组串', value: '5', unit: '路', note: '第 8-12 组串', tone: 'warning' }, { label: '红外温差', value: '3.2', unit: '℃', note: '无明显热斑', tone: 'success' }], data: [['设备', 'KELA-PV-05-08'], ['组串电压', '1,079 V · 正常'], ['同辐照对比', '偏差 19% · 异常'], ['采集窗口', '过去 24 h · 同辐照分析']], evidence: [{ source: 'SCADA', label: '同辐照横向对比', value: '已归档' }, { source: '无人机红外', label: '红外影像无热斑', value: '已归档' }, { source: 'IV 扫描', label: '待补充诊断', value: '待采集' }] }, action: { type: 'diagnosis', label: '发起 IV 诊断', task: { title: '柯拉一期 #5方阵组串 IV 曲线诊断', stationId: 'kela', deviceId: 'KELA-PV-05-08', severity: '高', currentStep: 1, description: '组串电流失配率 19%，执行 IV 曲线扫描确认根因。' } } },
    ],
    actionIds: [],
  },
  {
    id: 'next-quarter',
    index: 5,
    title: '五、下季度智能巡检计划',
    subtitle: '2026 Q4 · 一键生成 126 项任务',
    status: '待审批',
    summary: '对高风险方阵提频，对已闭环问题安排定向复检，其余设备保持常规周期。',
    metrics: [
      { label: '计划任务', value: '126', unit: '项' },
      { label: '提频巡检', value: '18', unit: '项' },
      { label: '专项诊断', value: '12', unit: '项' },
      { label: '预计工时', value: '386', unit: 'h' },
    ],
    items: [
      { id: 'plan-drone', type: '无人机红外', count: 36, cadence: '半月 / 月度', scope: '扎拉山 #5/#6 方阵及两河口热斑设备' },
      { id: 'plan-iv', type: 'IV 曲线诊断', count: 12, cadence: '月度', scope: '柯拉一期高失配率组串' },
      { id: 'plan-robot', type: '巡检机器人', count: 18, cadence: '月度', scope: '逆变器与汇流箱设备区' },
      { id: 'plan-scada', type: 'SCADA 全量回放', count: 60, cadence: '周 / 月度', scope: '全部在运电站' },
    ],
    actionIds: [],
  },
]

// 巡检任务流程：计划与报告由运维值班员负责，采集与分析由巡检Agent执行
export const inspectionFlow = [
  { index: 1, id: 'plan', shortLabel: '计划', name: '计划', stage: '巡检', executor: '运维值班员', executorId: 'technical', executorType: 'human', approverRole: 'technical', advanceMode: 'approval', stageMeta: { eyebrow: '巡检计划 · 路线规划', title: '巡检计划', copy: '巡检Agent 已根据所选电站与巡检方式生成路线方案，待运维值班员确认。', mode: '人工审批' } },
  { index: 2, id: 'collect', shortLabel: '采集', name: '采集', stage: '巡检', executor: '巡检Agent', executorId: 'perception', executorType: 'agent', advanceMode: 'auto', stageMeta: { eyebrow: '数据采集 · 多源回传', title: '数据采集', copy: '按确认的巡检路线执行采集，红外、可见光与运行数据实时回传归档。', mode: 'Agent 自动完成' } },
  { index: 3, id: 'analyze', shortLabel: '分析', name: '分析', stage: '巡检', executor: '巡检Agent', executorId: 'diagnosis', executorType: 'agent', advanceMode: 'auto', stageMeta: { eyebrow: '智能分析 · 问题定位', title: '智能分析', copy: '对采集数据进行交叉分析，输出候选问题与置信度，形成报告素材。', mode: 'Agent 自动完成' } },
  { index: 4, id: 'report', shortLabel: '报告', name: '报告', stage: '巡检', executor: '运维值班员', executorId: 'technical', executorType: 'human', approverRole: 'technical', advanceMode: 'approval', stageMeta: { eyebrow: '巡检报告 · 人工审批', title: '巡检报告', copy: '报告由采集与分析结果自动汇总生成，待运维值班员审批发布。', mode: '人工审批' } },
]

/**
 * 按电站设备表生成巡检路线方案
 * mode = 'drone' 无人机航点序列；mode = 'manual' 人工点位清单
 */
function buildRoutePlan(station, mode = 'drone') {
  const devices = Array.isArray(station?.devices) ? station.devices : []
  const points = devices.slice(0, 6).map((device) => device.name)
  const isDrone = mode === 'drone'
  return {
    mode,
    dest: station?.shortName || station?.name || '目标电站',
    km: `${(devices.length * (isDrone ? 0.8 : 0.3) + 2).toFixed(1)} km`,
    dur: isDrone ? `${Math.round(20 + devices.length * 6)} min` : `${Math.round(60 + devices.length * 15)} min`,
    advice: isDrone ? '沿主巡检航线飞行，逆风返航' : '按设备区步行巡检路线逐项核验',
    waypoints: [isDrone ? '站控楼起飞点' : '站控楼集合点', ...points, isDrone ? '返航降落点' : '巡检终点签退'],
  }
}

/**
 * 巡检任务计划/采集/分析步骤的内容包，数据与 2026 Q3 智能巡检报告对齐
 */
export function buildInspectionContent(ticket, stationList) {
  const list = Array.isArray(stationList) && stationList.length ? stationList : []
  const mode = ticket?.inspectionMode || 'drone'
  const routes = list.map((station) => ({ station, route: buildRoutePlan(station, mode) }))
  const waypointTotal = routes.reduce((count, item) => count + item.route.waypoints.length, 0)
  const isDrone = mode === 'drone'

  return {
    routes,
    planMetrics: [
      { label: '覆盖电站', value: String(list.length), unit: '座' },
      { label: '巡检方式', value: isDrone ? '无人机' : '人工', note: isDrone ? '红外 + 可见光' : '人工逐项核验' },
      { label: '巡检点位', value: String(waypointTotal), unit: '个' },
      { label: '预计时长', value: isDrone ? '3.2' : '8.5', unit: 'h', note: '含转场与数据回传' },
    ],
    collectMetrics: [
      { label: '完成航点', value: String(waypointTotal), unit: '个' },
      { label: '回传影像', value: isDrone ? '112' : '68', unit: '张', note: '红外 / 可见光' },
      { label: '运行数据', value: '24', unit: 'h', note: 'SCADA 全量回放' },
      { label: '覆盖率', value: '100', unit: '%', tone: 'good' },
    ],
    collectChecklist: [
      ...list.map((station) => ({ label: `${station.shortName} ${isDrone ? '红外 + 可见光影像采集' : '设备区人工巡检记录'}`, note: '已回传归档', state: 'done' })),
      { label: 'SCADA 运行数据全量回放', note: '24h · 已对齐时间轴', state: 'done' },
      { label: 'IV 曲线扫描（高失配组串）', note: '12 组 · 已归档', state: 'done' },
      { label: '气象站环境数据关联', note: '辐照 / 温湿度 · 已归档', state: 'done' },
    ],
    analyzeMetrics: [
      { label: '分析对象', value: String(list.length), unit: '座电站' },
      { label: '发现异常', value: '47', unit: '项', note: '全部归档' },
      { label: '转缺陷单', value: '19', unit: '张', tone: 'warning' },
      { label: '高风险', value: '4', unit: '类', tone: 'danger' },
    ],
    analyzeThreshold: '80%',
    analyzeCauses: [
      ['低辐照组串反灌', '87%', 87, 'warning'],
      ['光伏组件热斑', '91%', 91, 'danger'],
      ['组串电流失配', '84%', 84, 'warning'],
      ['逆变器瞬时脱网', '89%', 89, 'danger'],
    ],
    analyzeNote: '反灌、组串失配和逆变器瞬时脱网构成本季度主要问题簇，与 SCADA 及红外证据交叉验证一致。',
    analyzeConclusion: ['47 项异常全部定位并归档', '两项高风险问题可能造成停机或直流侧安全事件，建议 72 小时内完成现场处置；分析结论已自动汇入巡检报告。'],
    analyzeKv: [
      ['异常总量', '47 项 · 19 项转缺陷单'],
      ['闭环率', '87.2%（41 项已闭环）'],
      ['高风险', '组件热斑 / 逆变器脱网'],
      ['证据链', '红外影像 · 故障录波 · SCADA 趋势'],
    ],
  }
}

export const chatSessions = [
  {
    id: 'chat-today',
    title: '今日运行简报',
    agentId: 'orchestrator',
    updatedAt: '09:16',
    preview: '4 座电站整体运行平稳，3 项严重异常待复核。',
    messages: [
      { id: 'M-T-1', role: 'user', actor: '技术负责人', time: '09:15', content: '总结今天流域电站的运行情况。' },
      { id: 'M-T-2', role: 'agent', actor: '总控Agent', time: '09:16', content: '今日 4 座电站整体运行平稳，实时功率 4.14 GW，设备可用率 98.76%。当前有 3 项严重异常停在技术复核环节，其中两河口组件热斑和柯拉逆变器脱网建议优先处理。', suggestions: ['查看待复核任务', '对比各站健康度', '生成今日工单摘要'] },
    ],
  },
  {
    id: 'chat-hotspot',
    title: '两河口热斑诊断',
    agentId: 'diagnosis',
    updatedAt: '08:52',
    preview: '热斑缺陷置信度 91%，建议无人机复检或直接确认缺陷。',
    messages: [
      { id: 'M-H-1', role: 'user', actor: '技术负责人', time: '08:49', content: '两河口 #3 方阵热斑是否已经达到缺陷标准？' },
      { id: 'M-H-2', role: 'agent', actor: 'AI 诊断', time: '08:52', content: '已达到。组件最高温度 84.6℃，比同方阵基线高 41.4℃，且 IV 曲线呈现与热斑匹配的阶梯特征。AI 诊断给出 91% 置信度，建议确认缺陷。', suggestions: ['打开异常复核', '发起无人机复检'] },
    ],
  },
  {
    id: 'chat-report',
    title: '2026 Q3 巡检报告',
    agentId: 'orchestrator',
    updatedAt: '昨天',
    preview: '本季度完成 126 项巡检任务，闭环率 87.2%。',
    messages: [
      { id: 'M-R-1', role: 'agent', actor: '总控Agent', time: '昨天 17:40', content: '2026 Q3 智能巡检报告已生成。本季度完成 126 项巡检任务，覆盖 4 座电站，发现异常 47 项，当前闭环率 87.2%。', suggestions: ['打开巡检报告', '查看 AI 行动建议'] },
    ],
  },
]

// ==================== 柯拉一期多 Agent 全链路演示 ====================

// 总览页侧栏输入框的预制触发文案
export const KOLA_TRIGGER = '帮我分析柯拉一期电站的运行情况'

// 告警管理页演示数据：各站告警交错平铺 + 柯拉一期反灌系列（近 30 天 12 条）
export const ALARM_LIST = [
  { id: 'A-LHK-001', stationId: 'lianghekou', station: '两河口光储电站', device: '#3方阵 7号组串', severity: 'urgent', title: '组件热斑（温差 38℃）', time: '今日 08:42', status: '待复核' },
  { id: 'A-KELA-031', stationId: 'kela', station: '柯拉一期光伏电站', device: '2区 #07 逆变器', severity: 'urgent', title: '交流侧瞬时脱网', time: '今日 08:09', status: '已复归' },
  { id: 'A-ZLS-001', stationId: 'zhalashan', station: '扎拉山光储电站', device: '#7方阵组串', severity: 'warning', title: '低辐照组串反灌', time: '今日 08:31', status: '待复核' },
  { id: 'A-KELA-038', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第9组串', severity: 'warning', title: '组串反灌（早低辐照）', time: '今日 07:12', status: '待复核' },
  { id: 'A-LHK-002', stationId: 'lianghekou', station: '两河口光储电站', device: '汇流箱 04', severity: 'warning', title: '绝缘阻抗低', time: '今日 07:58', status: '待处置' },
  { id: 'A-KELA-037', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第8组串', severity: 'warning', title: '组串反灌（晚低辐照）', time: '昨天 18:36', status: '待复核' },
  { id: 'A-ZLS-002', stationId: 'zhalashan', station: '扎拉山光储电站', device: '#14 逆变器', severity: 'warning', title: '残余电流异常', time: '昨天 18:46', status: '待处置' },
  { id: 'A-KELA-036', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第10组串', severity: 'warning', title: '组串反灌（早低辐照）', time: '昨天 07:05', status: '已确认' },
  { id: 'A-LBS-001', stationId: 'labashan', station: '腊巴山光风储电站', device: '#16 风机', severity: 'warning', title: '叶片轻度裂纹', time: '昨天 16:28', status: '计划复检' },
  { id: 'A-KELA-035', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第11组串', severity: 'warning', title: '组串反灌（晚低辐照）', time: '08-28 18:41', status: '已确认' },
  { id: 'A-LHK-003', stationId: 'lianghekou', station: '两河口光储电站', device: '#9方阵 2号组串', severity: 'warning', title: '组串电流偏低 12%', time: '昨天 15:20', status: '已确认' },
  { id: 'A-KELA-034', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第12组串', severity: 'warning', title: '组串反灌（早低辐照）', time: '08-28 07:09', status: '已确认' },
  { id: 'A-KELA-033', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第8组串', severity: 'warning', title: '组串电流失配 19%', time: '08-27 11:24', status: '待处置' },
  { id: 'A-KELA-032', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第9组串', severity: 'warning', title: '组串反灌（晚低辐照）', time: '08-27 18:33', status: '已确认' },
  { id: 'A-ZLS-003', stationId: 'zhalashan', station: '扎拉山光储电站', device: '#6方阵 3号组串', severity: 'info', title: '积灰遮蔽预警', time: '08-27 10:05', status: '已闭环' },
  { id: 'A-KELA-030', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第10组串', severity: 'warning', title: '组串反灌（早低辐照）', time: '08-26 07:02', status: '已确认' },
  { id: 'A-LBS-002', stationId: 'labashan', station: '腊巴山光风储电站', device: '#2 光伏方阵', severity: 'info', title: 'PR 短时波动', time: '08-26 13:44', status: '已闭环' },
  { id: 'A-KELA-029', stationId: 'kela', station: '柯拉一期光伏电站', device: '1区 通讯管理机', severity: 'info', title: '通讯抖动 3 次', time: '08-25 14:17', status: '已闭环' },
  { id: 'A-KELA-028', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第11组串', severity: 'warning', title: '组串反灌（晚低辐照）', time: '08-25 18:39', status: '已确认' },
  { id: 'A-KELA-027', stationId: 'kela', station: '柯拉一期光伏电站', device: '#5方阵 第8-12组串', severity: 'warning', title: '防反回路正向压降升高', time: '08-24 09:52', status: '待复核' },
]

// 柯拉一期缺陷单打字机预填字段（字段序与缺陷管理页表单一致）
export const KOLA_DEFECT_ROWS = [
  ['缺陷编号', 'QX-20260831-005'], ['发现单位', '雅砻江流域集控中心'], ['发现人', '诊断Agent'], ['发现日期', '2026-08-31'],
  ['缺陷类别', 'III 级 / 一般缺陷'], ['责任班组', '川西检修一组'], ['责任人', '张斌'], ['厂站', '柯拉一期光伏电站'],
  ['设备码', 'KELA-PV-05-08'], ['设备描述', '#5 方阵第 8-12 组串防反回路'], ['状态', '待确认转工单'], ['故障类别', '组串反灌'],
  ['辅助现象', '近 30 天早晚低辐照时段反灌 12 次'], ['工单编号', 'GD-20260831-011'],
  ['缺陷原因', '防反二极管性能衰减，低辐照时段相邻组串经汇流母排反灌'],
  ['处理措施', '停电更换防反二极管 2 支，复紧直流接头 6 处，复测回路压降'],
]

// 演示步骤脚本：空格逐步推进；diagnose 步骤等待缺陷卡选项点击（空格等同选 A）
// 消息协议：queue 依次落流；think.duration 为思考计时毫秒（思考完成才出气泡）；
// checklist 为依次打勾步骤；defectCard 渲染缺陷卡样式选项卡；staff 标记人员气泡（右侧）
// 步骤级：nav/navDelay 页面跳转（思考中间打开）；effect/effectDelay 副作用；
// waitEvent 'alarm-typed' 表示该步等待告警页搜索打字完成回调后自动推进
export const KOLA_DEMO_STEPS = [
  {
    id: 'sense',
    queue: [{
      actor: '感知Agent',
      think: {
        duration: 2000,
        lines: ['调取 SCADA 遥测 2.6 万条、红外影像 12 组、IV 曲线 86 条', '对齐时间轴并剔除坏点，数据完整率 99.2%', '同步至数字孪生电站模型'],
      },
      content: '数据汇聚完成：柯拉一期近 30 天运行数据已同步数字孪生，数据完整率 99.2%，具备诊断条件。',
    }],
    nav: { path: '/station/kela' },
    navDelay: 1000,
  },
  {
    id: 'alarm-open',
    queue: [{
      actor: '感知Agent',
      think: {
        duration: 1600,
        lines: ['打开告警管理，定位检索入口', '输入「柯拉一期」筛选该站近 30 天告警'],
      },
      content: '正在告警管理中检索柯拉一期近 30 天告警记录。',
    }],
    nav: { path: '/alarm', state: { alarmTyping: '柯拉一期' } },
    navDelay: 800,
    waitEvent: 'alarm-typed',
  },
  {
    id: 'alarm-result',
    queue: [{
      actor: '主控Agent',
      think: {
        duration: 1800,
        lines: ['12 条告警按现象聚类：反灌 8 条、电流失配 1 条、通讯抖动 1 条、瞬时脱网 1 条、防反压降 1 条', '脱网已复归、通讯抖动已闭环，剩余风险集中在反灌'],
      },
      content: '检索完成：柯拉一期近 30 天告警 12 条，反灌类 8 条占七成，集中在 #5 方阵；逆变器脱网 1 条已复归。',
    }],
  },
  {
    id: 'diagnose',
    queue: [{
      actor: '诊断agent',
      think: {
        duration: 3200,
        lines: ['红外温差与 IV 曲线核对：排除组件热斑与 PID 衰减', '反灌事件 100% 落在早晚低辐照窗口', '防反回路正向压降 0.45V → 0.82V，超过 0.6V 衰减阈值'],
      },
      content: '诊断结论：柯拉一期整体运行正常，无热斑与脱网风险；#5 方阵防反回路衰减导致组串反灌，日发电损耗约 0.6%，建议处置。',
      defectCard: {
        title: '柯拉一期 #5方阵 第8-12组串反灌',
        cause: '防反二极管性能衰减，早晚低辐照时段相邻组串经汇流母排反灌',
        cost: '日发电损耗约 0.6% · 更换防反二极管 2 支 · 2 人 × 2h',
        choices: [
          { key: 'A', label: '生成缺陷单', icon: 'clipboard', desc: '推荐：当日派单止损最快，占用检修资源 2 人时' },
          { key: 'B', label: '无人机巡检复核', icon: 'drone', desc: '红外复核后再处置更稳妥，但需等 1 天，损耗持续' },
          { key: 'C', label: '人工巡检重点关注', icon: 'user', desc: '零成本纳入下周巡检计划，但依赖人工周期，可能延误' },
          { key: 'D', label: '挂起不关注', icon: 'pause', desc: '不占用资源，但损耗累积，防反回路可能进一步劣化' },
        ],
      },
    }],
  },
  {
    id: 'draft-defect',
    queue: [{
      actor: '派单Agent',
      think: {
        duration: 1600,
        lines: ['按诊断结论生成缺陷单草稿', 'AI 预填缺陷类别、责任班组与设备编码'],
      },
      content: '已受理。缺陷单草稿已生成，16 项字段正在自动预填…',
    }],
    nav: { path: '/production/defect', state: { fromWorkbench: true } },
    navDelay: 800,
    effect: 'typewriter-defect',
    effectDelay: 900,
  },
  {
    id: 'submit-defect',
    queue: [{
      actor: '派单Agent',
      think: {
        duration: 1200,
        lines: ['校验缺陷单 16 项字段完整性', '提交缺陷单并推送运维值班员确认'],
      },
      content: '缺陷单 QX-20260831-005 已提交，推送运维值班员确认。',
    }],
    effect: 'submit-defect',
  },
  {
    id: 'confirm-order',
    queue: [
      { actor: '运维值班员', staff: true, content: '缺陷信息确认无误，同意转工单处置。' },
      {
        actor: '派单Agent',
        think: {
          duration: 2200,
          lines: ['汇总诊断证据，生成工单 GD-20260831-011', '核定处置内容、责任班组与备件清单', '评估停机影响，编排低辐照作业窗口'],
        },
        content: '工单 GD-20260831-011 已生成，推送运维负责人批准。',
      },
    ],
    effect: { type: 'advance-ticket', action: 'approve' },
  },
  {
    id: 'approve-order',
    queue: [
      { actor: '运维负责人', staff: true, content: '工单已批准：川西检修一组 2 人作业，窗口明日 10:30-12:00 低辐照时段，备件防反二极管 2 支已锁定。' },
    ],
    effect: { type: 'advance-ticket', action: 'approve' },
  },
  {
    id: 'permit-request',
    queue: [
      {
        actor: '派单Agent',
        think: {
          duration: 2000,
          lines: ['生成电气工作票与操作票草稿', '校验负责人资质与作业窗口冲突', '推送现场工程师核对填写'],
        },
        content: '工作票、操作票草稿已生成，推送现场工程师核对填写。',
      },
      { actor: '现场工程师', staff: true, content: '工作票、操作票已按现场实际核对填写完毕，安措与现场一致，提交审批。' },
    ],
    effect: { type: 'advance-ticket', action: 'approve' },
  },
  {
    id: 'permit-approval',
    queue: [
      { actor: '工作许可人', staff: true, content: '工作票与工序单已批准，停电范围与挂牌上锁清单核对无误。' },
      { actor: '运维负责人', staff: true, content: '操作票已批准，现场具备开工条件，同意开工。' },
    ],
    effect: { type: 'advance-ticket', action: { type: 'approve', signRole: 'control' } },
  },
  {
    id: 'execute',
    queue: [{
      actor: '执行Agent',
      think: {
        duration: 1400,
        lines: ['下发作业指导卡与安全交底', '回传作业照片与更换记录'],
      },
      checklist: ['停电验电，落实安全措施', '更换防反二极管 2 支，复紧直流接头 6 处', '复测送电，回收作业照片与更换记录'],
      content: '现场作业完成：三步操作逐项确认，记录已回传归档。',
    }],
    // 会签节点批准后停在原地，先空格推进到现场作业，再空格完成现场作业
    effect: { type: 'advance-ticket', action: ['space', 'space'] },
    effectDelay: 3600,
  },
  {
    id: 'validate',
    queue: [{
      actor: '验证Agent',
      think: {
        duration: 2000,
        lines: ['组串电流回正，早晚低辐照时段无反灌', '防反回路压降恢复至 0.45V 基准', '红外复测无异常温升'],
      },
      content: '复测验证通过：组串电流回正，低辐照时段无反灌，设备恢复正常。',
    }],
    effect: { type: 'advance-ticket', action: 'space' },
    effectDelay: 2200,
  },
  {
    id: 'close',
    queue: [
      { actor: '运维负责人', staff: true, content: '处置过程与复测结果确认无误，工单结案，缺陷闭环。' },
    ],
    effect: { type: 'advance-ticket', action: 'approve' },
  },
  {
    id: 'learn',
    queue: [{
      actor: '知识Agent',
      think: {
        duration: 2200,
        lines: ['提炼处置要点入库，同类告警自动推荐诊断路径', '更新故障树分支先验与备件定额策略', '向 3 座同类电站推送排查建议'],
      },
      content: '案例已沉淀知识库：反灌类告警诊断路径已更新，3 座同类电站已推送排查建议。',
    }],
    effect: { type: 'advance-ticket', action: 'auto' },
    effectDelay: 2400,
  },
  {
    id: 'summary',
    queue: [{
      actor: '主控Agent',
      content: '柯拉一期全链路闭环演示完成：告警感知 → AI 诊断 → 缺陷单 → 工单 → 两票 → 现场执行 → 复测验证 → 结案 → 知识沉淀，反灌缺陷从发现到消缺全程可追溯。',
    }],
  },
]

// 非 A 选项只回气泡不展开，停留在选项步骤等待重新选择
export const KOLA_CHOICE_REPLIES = {
  B: { actor: '巡检Agent', content: '已安排无人机红外复检：UAV-02 明日 09:00 起飞，结果回传后再评估。仍可改选 A 直接生成缺陷单。' },
  C: { actor: '主控Agent', content: '已加入人工巡检重点关注清单，下周巡检计划将覆盖 #5 方阵第 8-12 组串。仍可改选 A 直接生成缺陷单。' },
  D: { actor: '主控Agent', content: '已挂起关注，#5 方阵反灌告警将转为低频提示，可随时恢复。仍可改选 A 直接生成缺陷单。' },
}
