import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { DEFAULT_GLASS_CONFIG, glassSamplingPadding } from '../src/components/stationGlassConfig.mjs'

// Exercise the adapter's crop coordinates, failure fallback and cleanup without a GPU.
const listeners = new Map()
const classes = new Set()
const draws = []
let destroyed = false
let disconnected = false
let fail = false
const rendered = []
const context = { clearRect() {}, drawImage(...args) { if (fail) throw Error('lost source'); draws.push(args) } }
const canvas = () => ({ width: 0, height: 0, getContext: () => context, addEventListener() {}, removeEventListener() {} })
const output = canvas()
const card = {
  parentElement: { style: { opacity: '1' } },
  classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
  querySelector: () => output, closest: () => null,
  getBoundingClientRect: () => ({ left: 150, top: 100, right: 306, bottom: 149, width: 156, height: 49 }),
}
const mapCanvas = { width: 2000, height: 1200, getBoundingClientRect: () => ({ left: 50, top: 40, right: 1050, bottom: 640, width: 1000, height: 600 }) }
const map = { getCanvas: () => mapCanvas, triggerRepaint() {}, on: (type, fn) => listeners.set(type, fn), off: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type) } }
class Renderer {
  canvas = canvas()
  render(source, options) { rendered.push({ ...options, sourceWidth: source.width, sourceHeight: source.height }) }
  destroy() { destroyed = true }
}
const source = readFileSync(new URL('../src/components/stationGlass.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replace('export function', 'function')
const attach = runInNewContext(`${source}\nattachStationGlass`, {
  StudioGlassRenderer: Renderer, DEFAULT_GLASS_CONFIG, glassSamplingPadding, console: { warn() {} },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  document: { hidden: false, createElement: canvas, addEventListener() {}, removeEventListener() {} },
  getComputedStyle: () => ({ borderRadius: '999px', getPropertyValue: () => '1 1 1 0.25' }),
  ResizeObserver: class { observe() {} disconnect() { disconnected = true } },
})
const detach = attach(map, { querySelectorAll: () => [card] })
listeners.get('render')()
assert.deepEqual(draws[0].slice(1), [-216, -296, 1144, 930, 0, 0, 572, 465], 'Map origin and 2x backing pixels must map to the padded 1x crop')
assert.equal(output.width, 156)
assert.equal(output.height, 49)
assert.ok(classes.has('has-liquid-glass'))
assert.equal(rendered[0].radius, 24.5, 'Collapsed pills must clamp to half their height')
assert.equal(JSON.stringify(rendered[0].tint), '[1,1,1,0.25]', 'Shader must receive theme tint')
card.getBoundingClientRect = () => ({ left: 200, top: 120, right: 356, bottom: 169, width: 156, height: 49 })
listeners.get('render')()
assert.deepEqual(draws[2].slice(1, 3), [-116, -256], 'Moving cards must sample their new map position')
card.getBoundingClientRect = () => ({ left: 200, top: 120, right: 552, bottom: 344, width: 352, height: 224 })
listeners.get('render')()
assert.equal(output.width, 352, 'Expanded canvas must follow the existing card layout')
assert.equal(output.height, 224)
assert.equal(rendered[2].sourceWidth, 768, 'Expanded sampling must retain the refraction margin')
fail = true
listeners.get('render')()
assert.equal(classes.size, 0, 'Sampling failures must restore native glass')
assert.equal(listeners.size, 0)
detach()
assert.ok(destroyed && disconnected, 'Unmount must free the renderer and observer')
fail = false
draws.length = rendered.length = 0
const compactOutput = canvas()
const compact = { ...card, querySelector: () => compactOutput,
  getBoundingClientRect: () => ({ left: 400, top: 200, right: 615, bottom: 266, width: 215, height: 66 }) }
const detachPair = attach(map, { querySelectorAll: () => [card, compact] })
listeners.get('render')()
assert.equal(rendered[0].sourceWidth, rendered[1].sourceWidth, 'Mixed card sizes must share the GPU buffer size')
assert.deepEqual(draws[2].slice(1), [147, -254, 1536, 1280, 0, 0, 768, 640], 'Compact card sampling must remain centered in the shared crop')
assert.deepEqual(draws[3].slice(1), [276.5, 287, 215, 66, 0, 0, 215, 66], 'Only the compact card region should be copied out')
detachPair()
let liveConfig = { ...DEFAULT_GLASS_CONFIG }
const detachLive = attach(map, { querySelectorAll: () => [card] }, () => liveConfig)
listeners.get('render')()
liveConfig = { ...liveConfig, blurRadius: 0, glareAngle: 25 }
listeners.get('render')()
assert.equal(rendered.at(-1).config, liveConfig, 'Live control changes must reach the next frame without reattaching the renderer')
detachLive()
console.log('Station glass: live crop, DPR, movement, mixed sizes, fallback and cleanup passed')
