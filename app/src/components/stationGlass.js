import { StudioGlassRenderer } from './stationGlassRenderer.js'
import { DEFAULT_GLASS_CONFIG, glassSamplingPadding } from './stationGlassConfig.mjs'

// Use upstream refraction shaders, with Mapbox's live frame instead of DOM capture.
export function attachStationGlass(map, root, getConfig = () => DEFAULT_GLASS_CONFIG) {
  const reduced = matchMedia('(prefers-reduced-transparency: reduce)')
  if (reduced.matches) return () => {}
  const renderer = new StudioGlassRenderer()
  const source = document.createElement('canvas')
  const context = source.getContext('2d')
  const cards = [...root.querySelectorAll('.map-station-layer .map-station-detail')]
  const outputs = cards.map(card => ({ card, canvas: card.querySelector('.station-glass-canvas') }))
  let disposed = false
  const hide = () => cards.forEach(card => card.classList.remove('has-liquid-glass'))
  const repaint = () => { if (!disposed) map.triggerRepaint() }
  const observer = new ResizeObserver(repaint)
  cards.forEach(card => observer.observe(card))

  function render() {
    if (disposed || document.hidden || reduced.matches || renderer.contextLost) { hide(); return }
    try {
      const mapCanvas = map.getCanvas()
      const bounds = mapCanvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const sx = mapCanvas.width / bounds.width
      const sy = mapCanvas.height / bounds.height
      const config = getConfig()
      const padding = glassSamplingPadding(config)
      const visible = outputs.map(output => ({ ...output, rect: output.card.getBoundingClientRect() }))
        .filter(({ card, rect }) => card.parentElement.style.opacity !== '0' && !card.closest('.is-hidden') &&
          rect.width && rect.height && rect.right >= bounds.left && rect.left <= bounds.right && rect.bottom >= bounds.top && rect.top <= bounds.bottom)
      if (!visible.length) return
      // Share the largest crop so differently sized cards don't reallocate GPU buffers every draw.
      const sourceWidth = Math.ceil(Math.max(...visible.map(({ rect }) => rect.width))) + padding * 2
      const sourceHeight = Math.ceil(Math.max(...visible.map(({ rect }) => rect.height))) + padding * 2
      if (source.width !== sourceWidth || source.height !== sourceHeight) { source.width = sourceWidth; source.height = sourceHeight }
      for (const { card, canvas, rect } of visible) {
        // ponytail: 1x effect resolution keeps four live panels cheap; DOM text stays native resolution.
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)
        const padX = (source.width - width) / 2
        const padY = (source.height - height) / 2
        context.clearRect(0, 0, source.width, source.height)
        context.drawImage(mapCanvas,
          (rect.left - bounds.left - padX) * sx,
          (rect.top - bounds.top - padY) * sy,
          source.width * sx, source.height * sy,
          0, 0, source.width, source.height)
        const style = getComputedStyle(card)
        const radius = Math.min(parseFloat(style.borderRadius), width / 2, height / 2)
        const tint = style.getPropertyValue('--ops-station-glass-tint').trim().split(/\s+/).map(Number)
        renderer.render(source, { width, height, radius, tint, config })
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
        const output = canvas.getContext('2d')
        output.clearRect(0, 0, width, height)
        output.drawImage(renderer.canvas, padX, padY, width, height, 0, 0, width, height)
        card.classList.add('has-liquid-glass')
      }
    } catch (error) {
      hide()
      map.off('render', render)
      console.warn('Station glass unavailable; using native glass.', error)
    }
  }
  // The render event runs before the WebGL drawing buffer is discarded.
  const onLost = event => { event.preventDefault(); hide() }
  const onRestored = () => {
    try { renderer.restore(); repaint() }
    catch (error) { hide(); console.warn('Station glass restoration failed; using native glass.', error) }
  }
  map.on('render', render)
  renderer.canvas.addEventListener('webglcontextlost', onLost)
  renderer.canvas.addEventListener('webglcontextrestored', onRestored)
  reduced.addEventListener('change', repaint)
  document.addEventListener('visibilitychange', repaint)
  repaint()
  return () => {
    disposed = true
    map.off('render', render)
    observer.disconnect()
    reduced.removeEventListener('change', repaint)
    document.removeEventListener('visibilitychange', repaint)
    renderer.canvas.removeEventListener('webglcontextlost', onLost)
    renderer.canvas.removeEventListener('webglcontextrestored', onRestored)
    hide()
    renderer.destroy()
  }
}
