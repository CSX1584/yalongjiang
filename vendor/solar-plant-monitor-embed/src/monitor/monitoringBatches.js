import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { ASSET_KINDS } from '../domain/constants.js'
import {
  getSceneAssetFoundation,
  getTemplateFoundation,
} from '../domain/documents.js'
import { MONITOR_DIMMED_COVERAGE_OPACITY } from './monitoringFocus.js'

const DEFAULT_POSITION = Object.freeze([0, 0, 0])
const DEFAULT_ROTATION = Object.freeze([0, 0, 0])
const DEFAULT_SCALE = Object.freeze([1, 1, 1])

function composeTransform(transform = {}, yOffset = 0) {
  const position = transform.position ?? DEFAULT_POSITION
  const rotation = transform.rotation ?? [
    0,
    transform.rotationY ?? 0,
    0,
  ]
  const scale = transform.scale ?? DEFAULT_SCALE

  return new Matrix4().compose(
    new Vector3(position[0], position[1] + yOffset, position[2]),
    new Quaternion().setFromEuler(new Euler(...(rotation ?? DEFAULT_ROTATION))),
    new Vector3(...scale),
  )
}

function appendInstance(instances, assetKind, entityId, matrix) {
  if (!assetKind) return
  instances.push({ assetKind, entityId, matrix })
}

function appendRepeatedInstances(
  instances,
  assetKind,
  entityId,
  parentMatrix,
  transforms,
) {
  transforms.forEach((transform) => {
    appendInstance(
      instances,
      assetKind,
      entityId,
      parentMatrix.clone().multiply(composeTransform(transform)),
    )
  })
}

function getPvArrayTransforms(component) {
  const { rows, columns, rowSpacing, columnSpacing } = component.parameters
  const xOffset = ((columns - 1) * columnSpacing) / 2
  const zOffset = ((rows - 1) * rowSpacing) / 2

  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    return {
      position: [
        column * columnSpacing - xOffset,
        0,
        row * rowSpacing - zOffset,
      ],
    }
  })
}

function getPcsGroupTransforms(component) {
  const { count, spacing } = component.parameters
  const xOffset = ((count - 1) * spacing) / 2
  return Array.from({ length: count }, (_, index) => ({
    position: [index * spacing - xOffset, 0, 0],
  }))
}

/**
 * Flatten the document hierarchy once so repeated assets can be submitted as
 * a handful of scene-wide InstancedMesh objects instead of one mesh per array.
 */
export function createMonitorAssetInstances(documents) {
  const templates = documents.templates.items
  const instances = []

  documents.scene.instances.forEach((entity) => {
    const entityMatrix = composeTransform(entity.transform)

    if (entity.kind !== 'template') {
      const foundation = getSceneAssetFoundation(entity)
      const assetMatrix = foundation
        ? entityMatrix.clone().multiply(
            composeTransform({}, foundation.thickness),
          )
        : entityMatrix
      appendInstance(instances, entity.assetKind, entity.id, assetMatrix)
      return
    }

    const template = templates[entity.templateId]
    if (!template) return
    const foundation = getTemplateFoundation(template)

    template.components.forEach((component) => {
      const componentMatrix = entityMatrix.clone().multiply(
        composeTransform(component.transform, foundation.thickness),
      )

      if (component.kind === 'pv-array') {
        appendRepeatedInstances(
          instances,
          ASSET_KINDS.PV_PANEL,
          entity.id,
          componentMatrix,
          getPvArrayTransforms(component),
        )
        return
      }

      if (component.kind === 'pcs-group') {
        appendRepeatedInstances(
          instances,
          ASSET_KINDS.PCS,
          entity.id,
          componentMatrix,
          getPcsGroupTransforms(component),
        )
        return
      }

      appendInstance(
        instances,
        component.assetKind,
        entity.id,
        componentMatrix,
      )
    })
  })

  return instances
}

/**
 * At overview there is one batch per asset kind. Focus mode only splits each
 * kind into selected and dimmed batches, keeping material count bounded.
 */
export function groupMonitorAssetInstances(instances, selectedEntityId) {
  const batches = new Map()

  instances.forEach((instance) => {
    const dimmed = Boolean(
      selectedEntityId && instance.entityId !== selectedEntityId,
    )
    const coverageOpacity = dimmed
      ? MONITOR_DIMMED_COVERAGE_OPACITY
      : 1
    const key = `${instance.assetKind}:${dimmed ? 'dimmed' : 'full'}`
    let batch = batches.get(key)
    if (!batch) {
      batch = {
        assetKind: instance.assetKind,
        coverageOpacity,
        instanceTransforms: [],
        key,
      }
      batches.set(key, batch)
    }
    batch.instanceTransforms.push({ matrix: instance.matrix })
  })

  return Array.from(batches.values())
}

export function getMonitorBatchStats(documents) {
  const instances = createMonitorAssetInstances(documents)
  const counts = Object.fromEntries(
    Object.values(ASSET_KINDS).map((assetKind) => [assetKind, 0]),
  )
  instances.forEach(({ assetKind }) => {
    counts[assetKind] = (counts[assetKind] ?? 0) + 1
  })
  return {
    batchCount: groupMonitorAssetInstances(instances, null).length,
    counts,
    instanceCount: instances.length,
  }
}
