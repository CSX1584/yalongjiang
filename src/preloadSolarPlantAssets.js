import { useGLTF } from '@react-three/drei'
import { DEFAULT_ASSET_REGISTRY } from 'solar-plant-monitor-embed'

const ASSET_PRELOAD_ORDER = [
  'pv-panel',
  'grid',
  'battery',
  'pcs',
  'transformer',
  'control-room',
]

let preloadStarted = false

function scheduleIdleTask(callback, timeout) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout })
    return () => window.cancelIdleCallback(id)
  }

  const id = window.setTimeout(callback, Math.min(timeout, 600))
  return () => window.clearTimeout(id)
}

export function scheduleSolarPlantAssetPreload() {
  if (preloadStarted || typeof window === 'undefined') return () => {}
  preloadStarted = true

  let cancelled = false
  let cancelPendingTask = () => {}

  const schedule = (callback, timeout = 1600) => {
    cancelPendingTask = scheduleIdleTask(() => {
      cancelPendingTask = () => {}
      if (!cancelled) callback()
    }, timeout)
  }

  const startPreload = () => {
    const queue = ASSET_PRELOAD_ORDER
      .map((assetKind) => DEFAULT_ASSET_REGISTRY[assetKind]?.url)
      .filter(Boolean)
      .map((url) => () => useGLTF.preload(url))

    const preloadNext = () => {
      if (cancelled || queue.length === 0) return

      schedule(() => {
        queue.shift()()
        preloadNext()
      })
    }

    preloadNext()
  }

  schedule(startPreload, 800)

  return () => {
    cancelled = true
    cancelPendingTask()
  }
}
