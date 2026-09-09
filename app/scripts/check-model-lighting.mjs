import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { parse } from '@babel/parser'

const source = readFileSync(new URL('../src/components/DigitalTwin.jsx', import.meta.url), 'utf8')
const config = JSON.parse(readFileSync(new URL('../src/data/stationModelConfig.json', import.meta.url), 'utf8'))
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] })
const names = ['normalizeModelEmission', 'clampModelParameter', 'loadStationModelConfig', 'addStationModelLayer', 'setStationBladeRotation', 'getModelRotationExpression']
const functions = ast.program.body.filter((node) => node.type === 'FunctionDeclaration' && names.includes(node.id.name))
const declarations = functions.map((node) => source.slice(node.start, node.end)).join('\n')
const context = {
  DEFAULT_STATION_MODEL_CONFIG: config,
  MODEL_CONFIG_STORAGE_KEY: 'test',
  MODEL_SCALE_MIN: 100, MODEL_SCALE_MAX: 10000,
  MODEL_ELEVATION_MIN: -100000, MODEL_ELEVATION_MAX: 100000,
  STATION_MODEL_SOURCE_ID: 'source', STATION_MODEL_LAYER_ID: 'layer',
  STATION_MODEL_BLADE_NODE: 'blade', STATION_MODEL_BLADE_STATE: 'rotation',
}
runInNewContext(`${declarations}; this.load = loadStationModelConfig; this.add = addStationModelLayer`, context)

const saved = { ...config, scale: 4200, rotation: 91, emissive: 2 }
delete saved.lightingVersion
context.window = { localStorage: { getItem: () => JSON.stringify(saved) } }
const migrated = context.load()
assert.equal(migrated.emissive, 0)
assert.equal(migrated.scale, saved.scale)
assert.equal(migrated.rotation, saved.rotation)
assert.equal(JSON.stringify(migrated.stationElevations), JSON.stringify(saved.stationElevations))
saved.lightingVersion = config.lightingVersion
saved.emissive = 0.25
assert.equal(context.load().emissive, 0.25)
for (const value of [2, 1, -1, 'invalid']) {
  saved.emissive = value
  assert.equal(context.load().emissive, 0)
}
for (const value of [0, 0.25, 0.8]) {
  saved.emissive = value
  const emission = context.load().emissive
  const mix = (lit) => lit * (1 - emission) + 0.8 * emission
  assert.ok(mix(0.2) < mix(0.6), 'Shadow must remain darker than the lit surface')
}

for (const model of ['/models/station.glb', '/models/station_light.glb']) {
  let layer
  let modelSource
  const map = { addSource(id, value) { modelSource = value }, setFeatureState() {}, addLayer(value) { layer = value } }
  assert.equal(context.add(map, { features: [{ properties: { id: 'test' }, geometry: { coordinates: [101, 28] } }] }, model), true)
  assert.equal(modelSource.models.test.lightOverrides?.['light-directional-intensity'], 1)
  assert.equal(layer.paint['model-cast-shadows'], true)
  assert.equal(layer.paint['model-receive-shadows'], true)
  assert.equal(modelSource.models.test.lightOverrides?.['light-ambient-intensity'], 0.5)
}
console.log('Model shadows and saved lighting migration passed.')
