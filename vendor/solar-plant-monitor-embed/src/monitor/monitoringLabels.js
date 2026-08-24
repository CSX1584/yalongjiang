import { TEMPLATE_IDS } from '../domain/constants.js'

const SUBARRAY_LABEL_PREFIXES = Object.freeze({
  [TEMPLATE_IDS.PV]: '#L2-PV',
  [TEMPLATE_IDS.ESS]: '#L1-ESS',
})
const SUBARRAY_LABEL_TOP_OFFSET = 1.2
const SUBARRAY_LABEL_WORLD_Z_OFFSET = -12

export function createMonitorSubarrayLabels(instances = []) {
  const counters = new Map()
  const labels = new Map()

  instances.forEach((instance) => {
    if (instance?.kind !== 'template') return

    const prefix = SUBARRAY_LABEL_PREFIXES[instance.templateId]
    if (!prefix) return

    const sequence = (counters.get(instance.templateId) ?? 0) + 1
    counters.set(instance.templateId, sequence)
    labels.set(instance.id, `${prefix}${String(sequence).padStart(2, '0')}`)
  })

  return labels
}

export function getMonitorSubarrayLabelPosition(bounds, rotationY = 0) {
  return [
    bounds.center[0] - Math.sin(rotationY) * SUBARRAY_LABEL_WORLD_Z_OFFSET,
    bounds.center[1] + bounds.size[1] / 2 + SUBARRAY_LABEL_TOP_OFFSET,
    bounds.center[2] + Math.cos(rotationY) * SUBARRAY_LABEL_WORLD_Z_OFFSET,
  ]
}
