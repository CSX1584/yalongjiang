import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../src/components/DigitalTwin.jsx', import.meta.url), 'utf8')
assert.doesNotMatch(source, /requestFullscreen|exitFullscreen/)
const effect = source.match(/useEffect\(\(\) => \{\n    if \(!pageFullscreen\)[\s\S]*?\n  \}, \[pageFullscreen, active\]\)/)?.[0]
assert.ok(effect, 'Page fullscreen must handle Escape and inactive pages')
for (const active of [true, false]) {
  let fullscreen = true
  let handler
  let removed = false
  const cleanup = runInNewContext(effect, {
    useEffect: fn => fn(), pageFullscreen: true, active,
    setPageFullscreen: value => { fullscreen = value },
    panelRef: { current: { querySelectorAll: () => [] } },
    document: {
      addEventListener: (_, fn) => { handler = fn },
      removeEventListener: (_, fn) => { removed = fn === handler },
    },
  })
  if (active) {
    handler({ key: 'Enter' })
    assert.equal(fullscreen, true)
    handler({ key: 'Escape' })
    assert.equal(fullscreen, false)
    cleanup()
    assert.ok(removed, 'Listener is cleaned up')
  } else assert.equal(fullscreen, false)
}
console.log('Map page fullscreen: Escape, route exit and cleanup passed')
