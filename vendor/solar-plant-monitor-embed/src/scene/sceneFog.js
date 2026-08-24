export const SCENE_BACKGROUND_COLOR = '#111111'

const EMPTY_CONTENT_RADIUS = 40
const FOG_CONTENT_PADDING = 20
const FOG_MIN_NEAR = 220
const FOG_MIN_FAR = 650
const FOG_MIN_RANGE = 80
const FOG_FAR_PLANE_SCALE = 0.92
const GROUND_FADE_MAX_NEAR = 450
const GROUND_FADE_MAX_FAR = 720

function getWorldExtents({ entity, bounds }) {
  const position = entity.transform.position
  const rotationY = entity.transform.rotationY
  const cos = Math.cos(rotationY)
  const sin = Math.sin(rotationY)
  const absoluteCos = Math.abs(cos)
  const absoluteSin = Math.abs(sin)
  const halfX = bounds.size[0] / 2
  const halfY = bounds.size[1] / 2
  const halfZ = bounds.size[2] / 2
  const centerX =
    position[0] + bounds.center[0] * cos + bounds.center[2] * sin
  const centerY = position[1] + bounds.center[1]
  const centerZ =
    position[2] - bounds.center[0] * sin + bounds.center[2] * cos
  const worldHalfX = absoluteCos * halfX + absoluteSin * halfZ
  const worldHalfZ = absoluteSin * halfX + absoluteCos * halfZ

  return {
    minX: centerX - worldHalfX,
    maxX: centerX + worldHalfX,
    minY: centerY - halfY,
    maxY: centerY + halfY,
    minZ: centerZ - worldHalfZ,
    maxZ: centerZ + worldHalfZ,
  }
}

export function getContentBoundingSphere(entries) {
  if (!entries.length) {
    return { center: [0, 0, 0], radius: EMPTY_CONTENT_RADIUS }
  }

  const extents = entries.map(getWorldExtents)
  const minX = Math.min(...extents.map((entry) => entry.minX))
  const maxX = Math.max(...extents.map((entry) => entry.maxX))
  const minY = Math.min(...extents.map((entry) => entry.minY))
  const maxY = Math.max(...extents.map((entry) => entry.maxY))
  const minZ = Math.min(...extents.map((entry) => entry.minZ))
  const maxZ = Math.max(...extents.map((entry) => entry.maxZ))
  const halfX = (maxX - minX) / 2
  const halfY = (maxY - minY) / 2
  const halfZ = (maxZ - minZ) / 2

  return {
    center: [
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    ],
    radius: Math.max(Math.hypot(halfX, halfY, halfZ), 1),
  }
}

export function getPerspectiveFogRange(camera, contentBounds) {
  const [centerX, centerY, centerZ] = contentBounds.center
  const distanceToContent = Math.hypot(
    camera.position.x - centerX,
    camera.position.y - centerY,
    camera.position.z - centerZ,
  )
  const desiredNear =
    distanceToContent + contentBounds.radius + FOG_CONTENT_PADDING
  const farLimit = camera.far * FOG_FAR_PLANE_SCALE
  const desiredFar = Math.max(
    FOG_MIN_FAR,
    desiredNear + Math.max(contentBounds.radius * 2, 250),
  )
  const far = Math.min(desiredFar, farLimit)
  const near = Math.min(Math.max(FOG_MIN_NEAR, desiredNear), far - FOG_MIN_RANGE)

  return [Math.max(camera.near + 1, near), far]
}

export function getGroundFadeRange(contentBounds) {
  const near = Math.min(
    Math.max(FOG_MIN_NEAR, contentBounds.radius * 1.5),
    GROUND_FADE_MAX_NEAR,
  )
  const desiredFar = Math.max(
    FOG_MIN_FAR,
    near + Math.max(contentBounds.radius * 2, 250),
  )

  return [near, Math.min(desiredFar, GROUND_FADE_MAX_FAR)]
}
