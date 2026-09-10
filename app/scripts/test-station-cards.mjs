import assert from 'node:assert/strict'
import { getStationEvents, getStationKpis } from '../src/components/stationCardData.mjs'
const station = { id: 'test', type: '光伏', health: 96, availability: '99.08', metrics: { pr: '86.4%' }, alerts: [
  { id: '1', deviceId: 'd', severity: 'warning' },
  { id: '2', deviceId: 'e', severity: 'urgent' },
  { id: '3', deviceId: 'f', severity: 'urgent' },
  { id: '4', deviceId: 'g', severity: 'urgent' },
] }
assert.deepEqual(getStationEvents(station).map(e => e.id), ['2', '3'])
assert.equal(getStationEvents({ ...station, alerts: station.alerts.slice(0, 1) })[0].id, '1')
assert.deepEqual(getStationEvents({ ...station, alerts: [] }), [])
for (const [currentStep, expected] of [[1, 0], [2, 1], [4, 1], [5, 2], [6, 3], [7, 3], [8, 4]]) {
  assert.equal(getStationEvents(station, [{ stationId: 'test', deviceId: 'e', type: '缺陷单', currentStep }])[0].phase, expected)
}
assert.equal(getStationKpis(station)[2].value, '86.4%')
assert.equal(getStationKpis({ ...station, type: '光伏 + 储能' })[2].state, '待接入')
assert.equal(getStationKpis({ ...station, type: '风电' })[2].label, '功率曲线符合度')
assert.equal(getStationKpis({ ...station, health: 0 })[0].value, '0分')
console.log('Station cards: priority, limit, phases and KPI types passed')
