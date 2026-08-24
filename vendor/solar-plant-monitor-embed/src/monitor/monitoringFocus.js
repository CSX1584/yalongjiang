const MIN_CAMERA_DISTANCE = 8
const MAX_CAMERA_DISTANCE = 500
const CAMERA_FRAME_PADDING = 1.2
const MINIMUM_ASPECT = 0.01

export const MONITOR_DIMMED_COVERAGE_OPACITY = 0.16
export const MONITOR_CAMERA_TRANSITION_SECONDS = 0.55

export function isMonitorSubarrayEntity(entity) {
  return entity?.kind === 'template'
}

export function easeOutQuart(progress) {
  const t = Math.min(1, Math.max(0, progress))
  return 1 - (1 - t) ** 4
}

export function getMonitorCameraFrame(
  contentBounds,
  { aspect = 1, fov = 50 } = {},
) {
  const verticalHalfFov = (fov * Math.PI) / 360
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * Math.max(aspect, MINIMUM_ASPECT),
  )
  const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov)
  const desiredDistance =
    (contentBounds.radius * CAMERA_FRAME_PADDING) /
    Math.max(Math.sin(limitingHalfFov), 0.001)
  const distance = Math.min(
    MAX_CAMERA_DISTANCE,
    Math.max(MIN_CAMERA_DISTANCE, desiredDistance),
  )
  const obliqueOffset = distance * Math.SQRT1_2
  const [centerX, centerY, centerZ] = contentBounds.center

  return {
    position: [
      centerX,
      centerY + obliqueOffset,
      centerZ + obliqueOffset,
    ],
    target: [...contentBounds.center],
  }
}

export function getMonitorOutlineMatrices(
  entries,
  hoveredEntityId,
  selectedEntityId,
) {
  if (selectedEntityId) return []

  const hoveredEntry = entries.find(
    (entry) => entry.entity.id === hoveredEntityId,
  )

  return hoveredEntry?.outlineMatrices ?? []
}

export function getMonitorHitAreaEntries(entries, selectedEntityId) {
  if (!selectedEntityId) {
    return entries.filter((entry) => entry.hoverable)
  }

  return entries.filter(
    (entry) =>
      entry.selectable && entry.entity.id === selectedEntityId,
  )
}
