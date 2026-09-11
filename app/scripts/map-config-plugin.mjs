import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { normalizeGlassConfig } from '../src/components/stationGlassConfig.mjs'
import { mapSnapshot, updatePresetConfig } from '../src/components/mapConfig.mjs'

function validateSnapshot(value, template) {
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
  const { environment: e, camera: view, cloudMotion, theme } = value.geospatial
  range(e.year, 1900, 2200); range(e.dayOfYear, 1, 365)
  if (!Number.isInteger(e.year) || !Number.isInteger(e.dayOfYear)) throw new Error('日期必须是整数')
  range(e.timeOfDay, 0, 24); range(e.coverage, 0, 1); range(e.exposure, 1, 100)
  range(e.cloudAltitude, 750, 10000); range(e.haze, 0, 1); range(e.aerialPerspective, 0, 1)
  range(view.fov, 1, 179); range(view.zoom, 0.01, 100); range(view.near, 0.001, 1e9); range(view.far, view.near + 0.001, 1e12)
  range(Math.hypot(...view.position), 1, 1e12)
  for (const vector of [view.quaternion, view.up]) range(Math.hypot(...vector), 0.999, 1.001)
  for (const vector of Object.values(cloudMotion)) for (const n of vector) range(n, -1e9, 1e9)
  if (!['light', 'dark'].includes(theme)) throw new Error('未知主题')
  return { ...value, glassConfig: normalizeGlassConfig(value.glassConfig) }
}

export function validateMapConfig(value, template) {
  const sample = mapSnapshot(template)
  const snapshot = validateSnapshot(mapSnapshot(value), sample)
  const presets = value.presets
  if (!presets || Object.keys(presets).sort().join() !== 'defaultId,items,lastSelectedId' || !Array.isArray(presets.items) || !presets.items.length) throw new Error('参数列表不完整')
  const ids = new Set()
  const items = presets.items.map(item => {
    if (!item || Object.keys(item).sort().join() !== 'config,createdAt,id,name' || typeof item.id !== 'string' || !/^[\w-]{1,64}$/.test(item.id) || ids.has(item.id)) throw new Error('参数编号无效或重复')
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60) throw new Error('参数名称须为 1–60 个字符')
    if (typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) throw new Error('参数保存时间无效')
    ids.add(item.id)
    return { ...item, config: validateSnapshot(item.config, sample) }
  })
  if (!ids.has(presets.defaultId) || !ids.has(presets.lastSelectedId)) throw new Error('初始默认或最近使用的参数不存在')
  if (!isDeepStrictEqual(snapshot, items.find(item => item.id === presets.defaultId).config)) throw new Error('初始默认参数与项目配置不一致')
  return { ...snapshot, presets: { ...presets, items } }
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
      if (!['PUT', 'POST'].includes(request.method) || !request.headers['content-type']?.startsWith('application/json')) {
        response.statusCode = 405; response.end('{}'); return
      }
      let body = ''
      for await (const chunk of request) {
        body += chunk
        if (Buffer.byteLength(body) > 1048576) throw new Error('配置过大')
      }
      const current = JSON.parse(readFileSync(file, 'utf8'))
      const input = JSON.parse(body)
      const config = validateMapConfig(request.method === 'POST' ? updatePresetConfig(current, input) : input, current)
      // Atomic replacement preserves the previous complete file if writing fails.
      writeFileSync(`${file}.tmp`, JSON.stringify(config, null, 2) + '\n')
      renameSync(`${file}.tmp`, file)
      response.end(JSON.stringify(request.method === 'POST' ? config : { saved: true }))
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
