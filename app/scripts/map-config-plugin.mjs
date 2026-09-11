import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeGlassConfig } from '../src/components/stationGlassConfig.mjs'

export function validateMapConfig(value, template) {
  function check(input, sample) {
    if (typeof sample === 'number') {
      if (typeof input !== 'number' || !Number.isFinite(input)) throw new Error('参数必须是有限数值')
    } else if (sample && typeof sample === 'object') {
      if (!input || Array.isArray(input) !== Array.isArray(sample) || Object.keys(input).sort().join() !== Object.keys(sample).sort().join()) throw new Error('配置字段不完整')
      for (const key of Object.keys(sample)) check(input[key], sample[key])
    } else if (typeof input !== typeof sample) throw new Error('参数类型错误')
  }
  check(value, template)
  const range = (n, min, max) => { if (n < min || n > max) throw new Error('参数超出范围') }
  const m = value.modelConfig, c = value.savedCamera
  range(m.scale, 100, 10000); range(m.rotation, -180, 180); range(m.emissive, 0, 0.8)
  for (const n of [m.elevation, ...Object.values(m.stationElevations)]) range(n, -100000, 100000)
  if (!Object.hasOwn(m.stationElevations, m.stationId)) throw new Error('未知电站')
  range(c.center[0], -180, 180); range(c.center[1], -85, 85)
  range(c.zoom, 5.5, 15); range(c.pitch, 0, 80); range(c.bearing, -180, 180)
  range(value.sunAzimuth, 0, 360); range(value.sunElevation, 0, 90)
  if (!['day', 'dawn', 'dusk', 'night'].includes(value.lightPreset)) throw new Error('未知光照时段')
  if (!Object.values(value.materialColors).every(color => /^#[\da-f]{6}$/i.test(color))) throw new Error('颜色格式错误')
  return { ...value, glassConfig: normalizeGlassConfig(value.glassConfig) }
}

export function mapConfigPlugin() {
  let file
  const install = server => { server.middlewares.use('/__map-config', async (request, response) => {
    response.setHeader('Content-Type', 'application/json')
    try {
      const host = request.headers.host
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host || '') ||
          (request.method !== 'GET' && (!request.headers.origin || new URL(request.headers.origin).host !== host))) {
        response.statusCode = 403; response.end('{"error":"仅允许本机同源保存"}'); return
      }
      if (request.method === 'GET') { response.setHeader('Cache-Control', 'no-store'); response.end(readFileSync(file, 'utf8')); return }
      if (request.method !== 'PUT' || !request.headers['content-type']?.startsWith('application/json')) {
        response.statusCode = 405; response.end('{}'); return
      }
      let body = ''
      for await (const chunk of request) {
        body += chunk
        if (Buffer.byteLength(body) > 16384) throw new Error('配置过大')
      }
      const config = validateMapConfig(JSON.parse(body), JSON.parse(readFileSync(file, 'utf8')))
      // Atomic replacement preserves the previous complete file if writing fails.
      writeFileSync(`${file}.tmp`, JSON.stringify(config, null, 2) + '\n')
      renameSync(`${file}.tmp`, file)
      response.end('{"saved":true}')
    } catch (error) { response.statusCode = 400; response.end(JSON.stringify({ error: error.message })) }
  }) }
  return {
    name: 'project-map-config',
    configResolved(config) { file = resolve(config.root, 'src/data/mapConfig.json') },
    configureServer: install,
    configurePreviewServer: install,
    handleHotUpdate(context) {
      if (context.file !== file) return
      // Future reloads read the new file; saving must not remount the running map.
      context.modules.forEach(module => context.server.moduleGraph.invalidateModule(module))
      return []
    },
  }
}
