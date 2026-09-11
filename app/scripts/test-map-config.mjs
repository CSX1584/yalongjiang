import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { mapConfigPlugin, validateMapConfig } from './map-config-plugin.mjs'
import { saveMapConfig, mapSnapshot } from '../src/components/mapConfig.mjs'

const config = JSON.parse(readFileSync(new URL('../src/data/mapConfig.json', import.meta.url)))
const root = mkdtempSync(join(tmpdir(), 'map-config-'))
mkdirSync(join(root, 'src/data'), { recursive: true })
const file = join(root, 'src/data/mapConfig.json')
writeFileSync(file, JSON.stringify(config))
let server
const boot = async (port = 0) => {
  server = await createServer({ configFile: false, root, plugins: [mapConfigPlugin()], server: { host: '127.0.0.1', port }, optimizeDeps: { noDiscovery: true } })
  await server.listen()
  return `http://127.0.0.1:${server.httpServer.address().port}`
}
try {
  let url = await boot()
  const edited = structuredClone(config)
  edited.modelConfig.scale = 5000
  edited.modelConfig.stationElevations.kela = -21000
  edited.savedCamera.bearing = 12
  edited.sunElevation = 31
  edited.weatherEnabled = true
  edited.glassConfig.blurRadius = 42
  edited.materialColors['底座'] = '#123456'
  edited.geospatial.environment.aerialPerspective = 0.37
  edited.geospatial.environment.timeOfDay = 14.2
  edited.geospatial.camera.position[0] += 100
  edited.geospatial.cloudMotion.localWeatherOffset[0] = 0.55
  edited.geospatial.fullscreen = !config.geospatial.fullscreen
  edited.geospatial.theme = 'dark'
  edited.presets.items.find(item => item.id === edited.presets.defaultId).config = mapSnapshot(edited)
  const put = (body, origin = url) => fetch(`${url}/__map-config`, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })
  assert.equal((await put(edited)).status, 200)
  assert.deepEqual(JSON.parse(readFileSync(file)), edited)
  assert.equal((await put(config, 'https://example.com')).status, 403)
  assert.equal((await put({ ...edited, sunElevation: 999 })).status, 400)
  const invalid = structuredClone(edited)
  invalid.geospatial.camera.quaternion = [0, 0, 0, 0]
  assert.equal((await put(invalid)).status, 400)
  invalid.geospatial.camera = edited.geospatial.camera
  invalid.geospatial.environment.coverage = 2
  assert.equal((await put(invalid)).status, 400)
  assert.deepEqual(JSON.parse(readFileSync(file)), edited, 'Rejected saves preserve the file')
  const firstUrl = url
  await server.close()
  url = await boot(Number(new URL(firstUrl).port) + 1)
  assert.notEqual(url, firstUrl, 'Reload test uses a different origin/port')
  assert.deepEqual(await (await fetch(`${url}/__map-config`, { headers: { Connection: 'close' } })).json(), edited, 'Server restart on another port preserves models, weather, camera, cloud motion and display defaults')
  const post = action => fetch(`${url}/__map-config`, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(action) })
  const second = mapSnapshot(config)
  second.geospatial = structuredClone(second.geospatial)
  second.geospatial.environment.coverage = 0.61
  const third = structuredClone(second)
  third.modelConfig.scale = 750
  const additions = await Promise.all([
    post({ type: 'save', id: 'test-second', name: '低云', config: second }),
    post({ type: 'save', id: 'test-third', name: '近景', config: third }),
  ])
  for (const response of additions) assert.equal(response.status, 200)
  let stored = JSON.parse(readFileSync(file))
  assert.equal(stored.presets.items.length, edited.presets.items.length + 2, 'Concurrent saves append to the latest disk list without lost updates')
  assert.deepEqual(mapSnapshot(stored), mapSnapshot(edited), 'Saving a new preset does not replace the initial default')
  assert.equal((await post({ type: 'select', id: 'test-second' })).status, 200)
  assert.equal(JSON.parse(readFileSync(file)).presets.lastSelectedId, 'test-second', 'Switching persists its selection')
  assert.equal((await post({ type: 'default', id: 'test-third' })).status, 200)
  stored = JSON.parse(readFileSync(file))
  assert.equal(stored.presets.defaultId, 'test-third')
  assert.deepEqual(mapSnapshot(stored), third, 'Setting initial default publishes its complete snapshot')
  const presetPort = Number(new URL(url).port)
  await server.close(); url = await boot(presetPort + 1)
  assert.deepEqual(await (await fetch(`${url}/__map-config`)).json(), stored, 'Preset list, selected item and initial default survive another port/restart')
  assert.equal((await post({ type: 'save', id: 'test-third', name: '重复', config: third })).status, 400)
  assert.equal((await post({ type: 'select', id: 'missing' })).status, 400)
  assert.equal((await post({ type: 'save', id: 'bad', name: '非法天气', config: { ...second, geospatial: { ...second.geospatial, environment: { ...second.geospatial.environment, coverage: 2 } } } })).status, 400)
  assert.deepEqual(JSON.parse(readFileSync(file)), stored, 'Invalid operations never replace a valid preset file')
  assert.equal((await post({ type: 'delete', id: 'test-third' })).status, 200)
  stored = JSON.parse(readFileSync(file))
  assert.equal(stored.presets.defaultId, edited.presets.items[0].id, 'Deleting default selects the first remaining preset')
  assert.equal((await post({ type: 'delete', id: 'test-second' })).status, 200)
  stored = JSON.parse(readFileSync(file))
  assert.equal(stored.presets.lastSelectedId, stored.presets.defaultId, 'Deleting selected preset falls back to initial default')
  for (const item of stored.presets.items.slice(1)) assert.equal((await post({ type: 'delete', id: item.id })).status, 200)
  assert.equal((await post({ type: 'delete', id: stored.presets.items[0].id })).status, 400, 'Last preset cannot be removed')
  assert.throws(() => validateMapConfig({ ...config, savedCamera: { ...config.savedCamera, pitch: NaN } }, config))
  const nativeFetch = globalThis.fetch
  const writes = []
  globalThis.fetch = async (_, options) => { writes.push(JSON.parse(options.body).sunElevation); return { ok: writes.length !== 1, json: async () => ({}) } }
  const results = await Promise.allSettled([saveMapConfig({ sunElevation: 1 }), saveMapConfig({ sunElevation: 2 })])
  globalThis.fetch = nativeFetch
  assert.deepEqual(writes, [1, 2]); assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled')
  console.log('Map persistence: full snapshots, preset CRUD/switch/default, concurrent additions, restart/port changes, validation, origin guard and ordered retry passed')
} finally { await server?.close(); rmSync(root, { recursive: true, force: true }) }
