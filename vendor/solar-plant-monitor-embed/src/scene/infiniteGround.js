export const INFINITE_GROUND_MIN_SIZE = 2_000

const PERSPECTIVE_FAR_SCALE = 2.5
const ORTHOGRAPHIC_VIEW_SCALE = 1.5

export function getInfiniteGroundSize(camera) {
  const farSize =
    Number.isFinite(camera?.far) && camera.far > 0
      ? camera.far * PERSPECTIVE_FAR_SCALE
      : 0

  if (!camera?.isOrthographicCamera) {
    return Math.max(INFINITE_GROUND_MIN_SIZE, farSize)
  }

  const zoom = Math.max(camera.zoom || 1, 0.001)
  const width = Math.abs(camera.right - camera.left) / zoom
  const height = Math.abs(camera.top - camera.bottom) / zoom
  const viewSize = Math.hypot(width, height) * ORTHOGRAPHIC_VIEW_SCALE

  return Math.max(INFINITE_GROUND_MIN_SIZE, farSize, viewSize)
}

export function syncInfiniteGroundToCamera(mesh, camera) {
  if (!mesh || !camera) return

  const size = getInfiniteGroundSize(camera)
  mesh.position.x = camera.position.x
  mesh.position.z = camera.position.z
  mesh.scale.set(size, size, 1)
}
