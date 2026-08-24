import { MOUSE } from 'three'

const MINIMUM_VISIBLE_HEIGHT = 0.001

export const CAMERA_MOUSE_BUTTONS = Object.freeze({
  LEFT: null,
  MIDDLE: MOUSE.PAN,
  RIGHT: MOUSE.ROTATE,
})

export const CAMERA_ORBIT_LIMITS = Object.freeze({
  minPolarAngle: 0,
  maxPolarAngle: Math.PI / 4,
  minAzimuthAngle: -Math.PI / 12,
  maxAzimuthAngle: Math.PI / 12,
})

export const CAMERA_OBLIQUE_POSITION = Object.freeze([0, 104, 104])

export const CAMERA_CLIP_PLANES = Object.freeze({
  orthographicNear: 0.1,
  perspectiveNear: 1,
  far: 1200,
})

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function constrainDirectionToCameraOrbit(direction) {
  const x = Number(direction?.[0])
  const y = Number(direction?.[1])
  const z = Number(direction?.[2])
  const resolvedX = Number.isFinite(x) ? x : 0
  const resolvedY = Number.isFinite(y) ? y : 1
  const resolvedZ = Number.isFinite(z) ? z : 0
  const polarAngle = clamp(
    Math.atan2(Math.hypot(resolvedX, resolvedZ), resolvedY),
    CAMERA_ORBIT_LIMITS.minPolarAngle,
    CAMERA_ORBIT_LIMITS.maxPolarAngle,
  )
  const azimuthAngle = clamp(
    Math.atan2(resolvedX, resolvedZ),
    CAMERA_ORBIT_LIMITS.minAzimuthAngle,
    CAMERA_ORBIT_LIMITS.maxAzimuthAngle,
  )
  const horizontalLength = Math.sin(polarAngle)

  return [
    horizontalLength * Math.sin(azimuthAngle),
    Math.cos(polarAngle),
    horizontalLength * Math.cos(azimuthAngle),
  ]
}

export function getOrthographicZoomForVisibleHeight(
  viewportHeight,
  visibleHeight,
) {
  return (
    Math.max(viewportHeight, 1) /
    Math.max(visibleHeight, MINIMUM_VISIBLE_HEIGHT)
  )
}
