import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { parse } from '@babel/parser'

const source = readFileSync(new URL('../src/components/DigitalTwin.jsx', import.meta.url), 'utf8')
const config = JSON.parse(readFileSync(new URL('../src/data/mapConfig.json', import.meta.url), 'utf8')).modelConfig
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] })
const names = ['normalizeModelEmission', 'clampModelParameter', 'addStationModelLayer', 'setStationBladeRotation', 'getModelRotationExpression']
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
runInNewContext(`${declarations}; this.normalize = normalizeModelEmission; this.add = addStationModelLayer`, context)

for (const value of [2, 1, -1, 'invalid']) {
  assert.equal(context.normalize(value), 0)
}
for (const value of [0, 0.25, 0.8]) {
  const emission = context.normalize(value)
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
  assert.equal(modelSource.models.test.lightOverrides?.['light-ambient-intensity'], 0.8)
}
console.log('Model shadows and emission limits passed.')
