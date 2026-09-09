// Mapbox 3.29.0 exposes no public shadow-map resolution option.
// Keep this adapter version-gated; recheck the renderer lifecycle before upgrading Mapbox.
export function upgradeModelShadows(map, version) {
  if (version !== '3.29.0') return false
  const renderer = map.painter?._shadowRenderer
  const gl = map.painter?.context?.gl
  if (!renderer?._shadowParameters || typeof renderer.destroy !== 'function' || !gl || gl.isContextLost()) return false
  if (Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) < 4096) return false
  if (renderer._shadowParameters.shadowMapResolution === 4096) return true
  // Release the old cascades first: Mapbox's resize path otherwise drops their GPU handles.
  renderer.destroy()
  renderer._shadowParameters.shadowMapResolution = 4096
  map.triggerRepaint()
  return true
}
