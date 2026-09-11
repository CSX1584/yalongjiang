export const GLASS_STORAGE_KEY = 'ops-station-glass-config-v1'

// Shared by the controls and the persistence boundary: key, label, min, max, step, default.
export const GLASS_PARAMETER_GROUPS = [
  { label: '折射与模糊', fields: [
    ['refThickness', '边缘厚度', 1, 80, 0.01, 18.7],
    ['refDistance', '折射距离', 0, 0.2, 0.001, 0.07],
    ['refFactor', '折射率', 1, 4, 0.01, 1.71],
    ['refDispersion', '色散强度', 0, 50, 0.01, 12.3],
    ['blurRadius', '模糊半径', 0, 200, 1, 30],
  ] },
  { label: '边缘反光', fields: [
    ['refFresnelRange', '反光范围', 1, 100, 0.01, 30],
    ['refFresnelHardness', '反光硬度', 0, 100, 1, 20],
    ['refFresnelFactor', '反光强度', 0, 100, 1, 20],
  ] },
  { label: '高光', fields: [
    ['glareRange', '高光范围', 1, 100, 0.01, 24.38],
    ['glareHardness', '高光硬度', 0, 100, 1, 20],
    ['glareFactor', '高光强度', 0, 120, 1, 90],
    ['glareConvergence', '高光聚合度', 0, 100, 1, 50],
    ['glareOppositeFactor', '背侧高光', 0, 100, 1, 80],
    ['glareAngle', '高光角度', -180, 180, 1, -45],
  ] },
  { label: '底色与阴影', fields: [
    ['tintOpacity', '底色不透明度 %', 0, 100, 0.01, 32.16],
    ['shadowExpand', '阴影柔化', 0, 100, 0.01, 17.54],
    ['shadowFactor', '阴影强度 %', 0, 100, 1, 15],
    ['shadowX', '阴影横向偏移', -100, 100, 1, 0],
    ['shadowY', '阴影纵向偏移', -100, 100, 1, -10],
  ] },
]
const fields = GLASS_PARAMETER_GROUPS.flatMap(group => group.fields)
export const DEFAULT_GLASS_CONFIG = Object.freeze({
  ...Object.fromEntries(fields.map(([key, , , , , value]) => [key, value])),
  blurEdge: true, tintColor: '#ffffff',
})

export function normalizeGlassConfig(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const result = { ...DEFAULT_GLASS_CONFIG }
  for (const [key, , min, max, step, fallback] of fields) {
    const number = input[key]
    result[key] = typeof number === 'number' && Number.isFinite(number)
      ? Number((Math.round(Math.min(max, Math.max(min, number)) / step) * step).toFixed(3))
      : fallback
  }
  if (typeof input.blurEdge === 'boolean') result.blurEdge = input.blurEdge
  if (typeof input.tintColor === 'string' && /^#[\da-f]{6}$/i.test(input.tintColor)) result.tintColor = input.tintColor.toLowerCase()
  return result
}

export function loadGlassConfig(storage) {
  try { return normalizeGlassConfig(JSON.parse((storage || window.localStorage).getItem(GLASS_STORAGE_KEY))) }
  catch { return { ...DEFAULT_GLASS_CONFIG } }
}

export function saveGlassConfig(config, storage) {
  // Let the panel report quota/permission errors; never claim an unsuccessful save.
  const safe = normalizeGlassConfig(config)
  const target = storage || window.localStorage
  target.setItem(GLASS_STORAGE_KEY, JSON.stringify(safe))
  return safe
}

export function glassCssVariables(config) {
  const rgb = config.tintColor.slice(1).match(/../g).map(hex => parseInt(hex, 16))
  const alpha = config.tintOpacity / 100
  const tint = [...rgb.map(channel => channel / 255), alpha].join(' ')
  const surface = `rgb(${rgb.join(' ')} / ${alpha})`
  return {
    '--ops-station-glass-tint': tint, '--ops-station-glass-tint-open': tint,
    '--ops-station-glass': surface, '--ops-station-glass-open': surface,
    '--ops-station-glass-blur': `${config.blurRadius / 3}px`,
    '--ops-station-glass-shadow': `${config.shadowX}px ${-config.shadowY}px ${config.shadowExpand}px rgb(0 0 0 / ${config.shadowFactor / 100})`,
  }
}

export function glassUniforms(config) {
  const uniforms = {}
  for (const [key] of fields) {
    if (key.startsWith('ref') || key.startsWith('glare')) uniforms[`u_${key}`] = config[key]
  }
  for (const key of ['refFresnelHardness', 'refFresnelFactor', 'glareHardness', 'glareFactor', 'glareConvergence', 'glareOppositeFactor']) uniforms[`u_${key}`] /= 100
  uniforms.u_glareAngle = config.glareAngle * Math.PI / 180
  return { ...uniforms, u_blurRadius: config.blurRadius, u_blurEdge: Number(config.blurEdge) }
}

export function glassSamplingPadding(config) {
  const reach = 1414.214 * config.refDistance * Math.sqrt(config.refFactor ** 2 - 1) * (1 + 0.02 * config.refDispersion) + config.blurRadius
  // ponytail: 512px crop limit; use full-map textures if extreme refraction must stay exact.
  return Math.max(32, Math.min(512, Math.ceil(reach / 8) * 8))
}
