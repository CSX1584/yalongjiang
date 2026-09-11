import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../src/components/DigitalTwin.jsx', import.meta.url), 'utf8')
assert.doesNotMatch(source, /requestFullscreen|exitFullscreen/)
const effect = source.match(/useEffect\(\(\) => \{\n    if \(!fullscreen\)[\s\S]*?\n  \}, \[fullscreen\]\)/)?.[0]
const activeEffect = source.match(/useEffect\(\(\) => \{\n    if \(!active\) setFullscreen\(false\)\n  \}, \[active\]\)/)?.[0]
assert.ok(effect, 'Page fullscreen must handle keyboard navigation')
assert.ok(activeEffect, 'Page fullscreen must exit on inactive pages')
for (const active of [true, false]) {
  let fullscreen = true
  let handler
  let removed = false
  const first = { focus: () => { document.activeElement = first }, getClientRects: () => [1] }
  const last = { focus: () => { document.activeElement = last }, getClientRects: () => [1] }
  const previous = { isConnected: true, focus: () => { document.activeElement = previous } }
  const document = {
      activeElement: previous,
      addEventListener: (_, fn) => { handler = fn },
      removeEventListener: (_, fn) => { removed = fn === handler },
  }
  const context = {
    useEffect: fn => fn(), fullscreen: true, active,
    setFullscreen: value => { fullscreen = value },
    panelRef: { current: { querySelector: () => first, querySelectorAll: () => [first, last] } },
    document,
  }
  runInNewContext(activeEffect, context)
  if (active) {
    const cleanup = runInNewContext(effect, context)
    assert.equal(document.activeElement, first)
    let prevented = false
    handler({ key: 'Tab', shiftKey: true, preventDefault: () => { prevented = true } })
    assert.equal(document.activeElement, last)
    assert.ok(prevented)
    handler({ key: 'Tab', preventDefault: () => {} })
    assert.equal(document.activeElement, first)
    handler({ key: 'Enter' })
    assert.equal(fullscreen, true)
    handler({ key: 'Escape' })
    assert.equal(fullscreen, false)
    cleanup()
    assert.ok(removed, 'Listener is cleaned up')
    assert.equal(document.activeElement, previous, 'Focus returns to the triggering control')
  } else assert.equal(fullscreen, false)
}
console.log('Map page fullscreen: Escape, route exit, focus cycle and cleanup passed')
