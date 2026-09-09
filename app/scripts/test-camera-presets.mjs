import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// Exercise the actual preset data and camera effect without a WebGL dependency.
const source = readFileSync(new URL('../src/components/DigitalTwin.jsx', import.meta.url), 'utf8')
const data = source.slice(source.indexOf('const DEFAULT_CAMERA ='), source.indexOf('const TERRAIN_SOURCE_ID ='))
const presets = runInNewContext(`${data}; CAMERA_PRESETS`)
assert.equal(presets.length, 2)
assert.equal(presets[0].name, '镜头01')
assert.equal(presets[1].name, '镜头02')
assert.equal(presets[0].camera.zoom, 8.0942241286)
assert.equal(presets[1].camera.zoom, 9.081086751597558)
assert.equal(presets[1].camera.center[0], 101.37661223434884)
const effect = source.match(/useEffect\(\(\) => \{\n    if \(!cameraRequest[\s\S]*?\n  \}, \[cameraRequest, flat, mapReady\]\)/)?.[0]
assert.ok(effect)
for (const { camera } of presets) {
  for (const ready of [false, true]) {
    for (const reduced of [false, true]) {
      let actual
      let cleared = false
      runInNewContext(effect, {
        useEffect: (fn) => fn(), cameraRequest: camera, flat: false, mapReady: ready,
        mapRef: { current: { easeTo: (value) => { actual = value } } },
        window: { matchMedia: () => ({ matches: reduced }) },
        setCameraRequest: (value) => { cleared = value === null },
      })
      assert.equal(cleared, ready)
      assert.equal(actual?.zoom, ready ? camera.zoom : undefined)
      if (ready) {
        assert.equal(actual.center, camera.center)
        assert.equal(actual.pitch, camera.pitch)
        assert.equal(actual.bearing, camera.bearing)
        assert.equal(actual.duration, reduced ? 0 : 900)
      }
    }
  }
}
console.log('Camera presets: both saved positions, readiness and reduced motion passed')
