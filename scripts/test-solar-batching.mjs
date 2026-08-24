import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  createMonitorAssetInstances,
  getMonitorBatchStats,
  groupMonitorAssetInstances,
} from '../vendor/solar-plant-monitor-embed/src/monitor/monitoringBatches.js'
import {
  createMonitorSubarrayLabels,
} from '../vendor/solar-plant-monitor-embed/src/monitor/monitoringLabels.js'

const documents = JSON.parse(
  fs.readFileSync(
    new URL('../src/data/solar-plant-scene-2026-08-20.json', import.meta.url),
    'utf8',
  ),
)

const expectedCounts = {
  'pv-panel': 10_496,
  battery: 84,
  transformer: 110,
  pcs: 504,
  grid: 1,
  'control-room': 1,
}
const assetFiles = {
  'pv-panel': 'PV.gltf',
  battery: 'ESS.gltf',
  transformer: 'Transformer.gltf',
  pcs: 'PCS.gltf',
  grid: 'Grid.gltf',
  'control-room': 'Monitoring Room.gltf',
}
const primitiveCounts = Object.fromEntries(
  Object.entries(assetFiles).map(([assetKind, fileName]) => {
    const gltf = JSON.parse(
      fs.readFileSync(
        new URL(
          `../vendor/solar-plant-monitor-embed/src/assets/${fileName}`,
          import.meta.url,
        ),
        'utf8',
      ),
    )
    return [
      assetKind,
      gltf.meshes.reduce(
        (count, mesh) => count + (mesh.primitives?.length ?? 0),
        0,
      ),
    ]
  }),
)
const instances = createMonitorAssetInstances(documents)
const subarrayLabels = createMonitorSubarrayLabels(documents.scene.instances)
const overview = getMonitorBatchStats(documents)
const selectedEntityId = documents.scene.instances.find(
  (entity) => entity.kind === 'template' && entity.templateId === 'pv-subarray',
)?.id
const focusBatches = groupMonitorAssetInstances(instances, selectedEntityId)

assert.deepEqual(overview.counts, expectedCounts)
assert.equal(overview.instanceCount, 11_196)
assert.equal(overview.batchCount, 6)
assert.equal(focusBatches.length, 8)
assert.equal(subarrayLabels.size, 96)
assert.equal(
  Object.values(primitiveCounts).reduce((sum, count) => sum + count, 0),
  14,
)
assert.ok(
  instances.every(({ matrix }) =>
    matrix.isMatrix4 && matrix.elements.every(Number.isFinite),
  ),
  '所有合批实例都必须有有效的世界变换矩阵',
)

console.log(JSON.stringify({
  after: {
    assetBatches: overview.batchCount,
    assetDrawCalls: 14,
    focusBatches: focusBatches.length,
    instances: overview.instanceCount,
    subarrayLabels: subarrayLabels.size,
  },
  before: {
    pvPrimitiveBatches: 82 * 8 * 2,
  },
  counts: overview.counts,
}, null, 2))
