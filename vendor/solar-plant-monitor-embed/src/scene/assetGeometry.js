import { Box3, Vector3 } from 'three'

const measurementCache = new WeakMap()

function getMeasurementSignature(definition) {
  return JSON.stringify([
    definition.autoAnchor !== false,
    definition.modelOffset ?? [0, 0, 0],
    definition.modelRotation ?? [0, 0, 0],
    definition.modelScale ?? [1, 1, 1],
  ])
}

function boundsFromBox(box) {
  return {
    center: box.getCenter(new Vector3()).toArray(),
    size: box.getSize(new Vector3()).toArray(),
  }
}

export function measureAssetScene(sourceScene, definition) {
  const signature = getMeasurementSignature(definition)
  let cachedByTransform = measurementCache.get(sourceScene)
  if (!cachedByTransform) {
    cachedByTransform = new Map()
    measurementCache.set(sourceScene, cachedByTransform)
  }
  const cached = cachedByTransform.get(signature)
  if (cached) return cached

  const modelRotation = definition.modelRotation ?? [0, 0, 0]
  const modelScale = definition.modelScale ?? [1, 1, 1]
  const probe = sourceScene.clone(true)
  probe.position.set(0, 0, 0)
  probe.rotation.set(...modelRotation)
  probe.scale.set(...modelScale)
  probe.updateMatrixWorld(true)

  const unanchoredBox = new Box3().setFromObject(probe, true)
  if (unanchoredBox.isEmpty()) return null

  const center = unanchoredBox.getCenter(new Vector3())
  const modelOffset =
    definition.autoAnchor === false
      ? [...(definition.modelOffset ?? [0, 0, 0])]
      : [-center.x, -unanchoredBox.min.y, -center.z]
  const anchoredBox = unanchoredBox
    .clone()
    .translate(new Vector3(...modelOffset))
  const measurement = {
    modelOffset,
    bounds: boundsFromBox(anchoredBox),
  }
  cachedByTransform.set(signature, measurement)
  return measurement
}
