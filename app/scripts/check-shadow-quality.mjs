import assert from 'node:assert/strict'
import { upgradeModelShadows } from '../src/components/modelShadowQuality.js'

let releases = 0
let repaints = 0
let limit = 8192
const renderer = { _shadowParameters: { shadowMapResolution: 2048 }, destroy() { releases++ } }
const map = {
  painter: { _shadowRenderer: renderer, context: { gl: {
    MAX_TEXTURE_SIZE: 1, MAX_RENDERBUFFER_SIZE: 2,
    getParameter: () => limit, isContextLost: () => false,
  } } },
  triggerRepaint() { repaints++ },
}
assert.equal(upgradeModelShadows(map, '3.30.0'), false)
limit = 2048
assert.equal(upgradeModelShadows(map, '3.29.0'), false)
assert.equal(releases, 0)
limit = 8192
assert.equal(upgradeModelShadows(map, '3.29.0'), true)
assert.equal(renderer._shadowParameters.shadowMapResolution, 4096)
assert.equal(releases, 1)
assert.equal(repaints, 1)
upgradeModelShadows(map, '3.29.0')
assert.equal(releases, 1)
assert.equal(upgradeModelShadows({}, '3.29.0'), false)
console.log('4K shadow upgrade, fallback and allocation cleanup passed.')
