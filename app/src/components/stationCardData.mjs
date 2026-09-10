export const EVENT_PHASES = ['诊断', '排单', '修复', '验证', '闭环']

export function getStationEvents(station, tickets = []) {
  const events = (station.alerts || []).map((alert) => {
    const ticket = tickets.filter((item) => item.stationId === station.id && item.deviceId === alert.deviceId && item.type === '缺陷单')
      .sort((a, b) => b.currentStep - a.currentStep)[0]
    const step = ticket?.currentStep
    const phase = ticket ? (ticket.completed || step >= 8 ? 4 : step >= 6 ? 3 : step === 5 ? 2 : step >= 2 ? 1 : 0)
      : alert.status === '计划复检' ? 3 : alert.status === '待处置' ? 1 : 0
    return { ...alert, phase }
  })
  const severity = ['urgent', 'warning', 'normal'].find((level) => events.some((event) => event.severity === level))
  return events.filter((event) => event.severity === severity).slice(0, 2)
}

export function getStationKpis(station) {
  const third = station.type.includes('风电') ? ['功率曲线符合度', station.metrics?.powerCurveFit, 'powerCurveFit']
    : station.type.includes('储能') ? ['储能充放电效率 RTE', station.metrics?.rte, 'rte']
      : ['系统效率 PR', station.metrics?.pr, 'pr']
  return [
    ['综合健康度评分', station.health == null ? null : `${station.health}分`, 'health'],
    ['设备可用率', station.availability == null ? null : `${station.availability}%`, 'availability'],
    third,
  ].map(([label, value, key]) => ({ label, value: value ?? '—', state: value == null ? '待接入' : station.kpiStates?.[key] || '待评估' }))
}
