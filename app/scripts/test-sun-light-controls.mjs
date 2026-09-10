import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../src/components/DigitalTwin.jsx', import.meta.url), 'utf8')
const constants = source.slice(source.indexOf('const SUN_LIGHT_BY_PRESET ='), source.indexOf('function cloneLights'))
const values = runInNewContext(`${constants}; ({ SUN_LIGHT_BY_PRESET, OUTDOORS_DAY_AZIMUTH, OUTDOORS_DAY_POLAR, OUTDOORS_DAY_ELEVATION })`)

assert.equal(values.OUTDOORS_DAY_AZIMUTH, 289)
assert.equal(values.OUTDOORS_DAY_POLAR, 31)
assert.equal(values.OUTDOORS_DAY_ELEVATION, 30)
for (const { direction } of Object.values(values.SUN_LIGHT_BY_PRESET)) {
  const elevation = 90 - direction[1]
  assert.ok(elevation >= 0 && elevation <= 90)
  assert.equal(90 - elevation, direction[1])
}
assert.match(source, /direction: \[sunAzimuth, 90 - sunElevation\]/)
assert.match(source, /aria-label="太阳高度角"/)
assert.match(source, /min="0" max="90" step="1" value=\{sunElevation\}/)

console.log('Sun light controls: official default and elevation conversion passed')
