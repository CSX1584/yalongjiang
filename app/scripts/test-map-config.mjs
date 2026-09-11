import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { mapConfigPlugin, validateMapConfig } from './map-config-plugin.mjs'
import { saveMapConfig } from '../src/components/mapConfig.mjs'

const config = JSON.parse(readFileSync(new URL('../src/data/mapConfig.json', import.meta.url)))
const root = mkdtempSync(join(tmpdir(), 'map-config-'))
mkdirSync(join(root, 'src/data'), { recursive: true })
const file = join(root, 'src/data/mapConfig.json')
writeFileSync(file, JSON.stringify(config))
let server
const boot = async () => {
  server = await createServer({ configFile: false, root, plugins: [mapConfigPlugin()], server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { noDiscovery: true } })
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
  const put = (body, origin = url) => fetch(`${url}/__map-config`, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })
  assert.equal((await put(edited)).status, 200)
  assert.deepEqual(JSON.parse(readFileSync(file)), edited)
  assert.equal((await put(config, 'https://example.com')).status, 403)
  assert.equal((await put({ ...edited, sunElevation: 999 })).status, 400)
  assert.deepEqual(JSON.parse(readFileSync(file)), edited, 'Rejected saves preserve the file')
  await server.close()
  url = await boot()
  assert.deepEqual(await (await fetch(`${url}/__map-config`, { headers: { Connection: 'close' } })).json(), edited, 'Server restart preserves every field')
  assert.throws(() => validateMapConfig({ ...config, savedCamera: { ...config.savedCamera, pitch: NaN } }, config))
  const nativeFetch = globalThis.fetch
  const writes = []
  globalThis.fetch = async (_, options) => { writes.push(JSON.parse(options.body).sunElevation); return { ok: writes.length !== 1 } }
  const results = await Promise.allSettled([saveMapConfig({ sunElevation: 1 }), saveMapConfig({ sunElevation: 2 })])
  globalThis.fetch = nativeFetch
  assert.deepEqual(writes, [1, 2]); assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled')
  console.log('Map persistence: disk write, restart, full configuration, invalid input, origin guard and ordered retry passed')
} finally { await server?.close(); rmSync(root, { recursive: true, force: true }) }
