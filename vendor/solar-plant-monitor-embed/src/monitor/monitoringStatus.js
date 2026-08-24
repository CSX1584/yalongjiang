export const MONITORING_STATUSES = Object.freeze({
  WARNING: 'warning',
  FAULT: 'fault',
})

export const MONITORING_STATUS_OVERLAY_APPEARANCES = Object.freeze({})

export const DEFAULT_MOCK_STATUS_OPTIONS = Object.freeze({
  warningCount: 5,
  faultCount: 3,
  seed: 'solar-plant-monitor-preview',
})

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function normalizeCount(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : fallback
}

export function getPvPanelDeviceId(
  sceneInstanceId,
  componentId,
  row,
  column,
) {
  return `${sceneInstanceId}/${componentId}/pv/${row}/${column}`
}

export function getScenePvPanelDeviceIds(documents) {
  const templates = documents?.templates?.items ?? {}
  const instances = documents?.scene?.instances ?? []
  const deviceIds = []

  instances.forEach((instance) => {
    if (instance.kind !== 'template') return
    const template = templates[instance.templateId]
    if (!template) return

    template.components.forEach((component) => {
      if (component.kind !== 'pv-array') return
      const { rows, columns } = component.parameters
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          deviceIds.push(
            getPvPanelDeviceId(instance.id, component.id, row, column),
          )
        }
      }
    })
  })

  return deviceIds
}

export function createMockPvDeviceStatuses(documents, options = {}) {
  const settings = {
    ...DEFAULT_MOCK_STATUS_OPTIONS,
    ...options,
  }
  const faultCount = normalizeCount(
    settings.faultCount,
    DEFAULT_MOCK_STATUS_OPTIONS.faultCount,
  )
  const warningCount = normalizeCount(
    settings.warningCount,
    DEFAULT_MOCK_STATUS_OPTIONS.warningCount,
  )
  const seed = String(settings.seed)
  const rankedDeviceIds = getScenePvPanelDeviceIds(documents)
    .map((deviceId) => ({
      deviceId,
      rank: hashString(`${seed}:${deviceId}`),
    }))
    .sort(
      (first, second) =>
        first.rank - second.rank ||
        first.deviceId.localeCompare(second.deviceId),
    )
    .map(({ deviceId }) => deviceId)
  const statuses = {}
  let cursor = 0

  rankedDeviceIds.slice(cursor, cursor + faultCount).forEach((deviceId) => {
    statuses[deviceId] = MONITORING_STATUSES.FAULT
  })
  cursor += faultCount
  rankedDeviceIds.slice(cursor, cursor + warningCount).forEach((deviceId) => {
    statuses[deviceId] = MONITORING_STATUSES.WARNING
  })

  return statuses
}

export function readDeviceStatus(deviceStatuses, deviceId) {
  const value =
    deviceStatuses instanceof Map
      ? deviceStatuses.get(deviceId)
      : deviceStatuses?.[deviceId]
  const status = typeof value === 'string' ? value : value?.status

  return Object.values(MONITORING_STATUSES).includes(status)
    ? status
    : null
}
