import {
  BoxGeometry,
  BufferGeometry,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ASSET_KINDS } from '../domain/constants.js'
import {
  getAssetBounds,
  getSceneAssetFoundation,
  getTemplateFoundation,
} from '../domain/documents.js'

const IDENTITY_ROTATION = Object.freeze([0, 0, 0])
const IDENTITY_SCALE = Object.freeze([1, 1, 1])

function composeMatrix({
  position = [0, 0, 0],
  rotationY = 0,
  scale = IDENTITY_SCALE,
}) {
  return new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(
      new Euler(
        IDENTITY_ROTATION[0],
        rotationY,
        IDENTITY_ROTATION[2],
      ),
    ),
    new Vector3(...scale),
  )
}

function createSceneEntityMatrix(entity) {
  return composeMatrix({
    position: entity.transform.position,
    rotationY: entity.transform.rotationY,
  })
}

function createDeviceBoundsMatrix(parentMatrix, assetKind, assetRegistry) {
  const bounds = getAssetBounds(assetRegistry[assetKind])
  return parentMatrix
    .clone()
    .multiply(
      composeMatrix({
        position: bounds.center,
        scale: bounds.size,
      }),
    )
}

function createComponentMatrix(component, foundationThickness) {
  const [x, y, z] = component.transform.position
  return composeMatrix({
    position: [x, y + foundationThickness, z],
    rotationY: component.transform.rotationY,
  })
}

export function getTemplateDeviceOutlineMatrices(template, assetRegistry) {
  if (!template) return []

  const foundation = getTemplateFoundation(template)
  const matrices = []

  template.components.forEach((component) => {
    const componentMatrix = createComponentMatrix(
      component,
      foundation.thickness,
    )

    if (component.kind === 'pv-array') {
      const { rows, columns, rowSpacing, columnSpacing } = component.parameters
      const xOffset = ((columns - 1) * columnSpacing) / 2
      const zOffset = ((rows - 1) * rowSpacing) / 2

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const panelMatrix = componentMatrix.clone().multiply(
            composeMatrix({
              position: [
                column * columnSpacing - xOffset,
                0,
                row * rowSpacing - zOffset,
              ],
            }),
          )
          matrices.push(
            createDeviceBoundsMatrix(
              panelMatrix,
              ASSET_KINDS.PV_PANEL,
              assetRegistry,
            ),
          )
        }
      }
      return
    }

    if (component.kind === 'pcs-group') {
      const { count, spacing } = component.parameters
      const xOffset = ((count - 1) * spacing) / 2
      for (let index = 0; index < count; index += 1) {
        const pcsMatrix = componentMatrix.clone().multiply(
          composeMatrix({ position: [index * spacing - xOffset, 0, 0] }),
        )
        matrices.push(
          createDeviceBoundsMatrix(pcsMatrix, ASSET_KINDS.PCS, assetRegistry),
        )
      }
      return
    }

    if (component.kind === 'asset') {
      matrices.push(
        createDeviceBoundsMatrix(
          componentMatrix,
          component.assetKind,
          assetRegistry,
        ),
      )
    }
  })

  return matrices
}

export function getSceneAssetEquipmentOutlineMatrices(entity, assetRegistry) {
  if (entity?.kind !== 'asset') return []
  const foundation = getSceneAssetFoundation(entity)
  const parentMatrix = composeMatrix({
    position: [0, foundation?.thickness ?? 0, 0],
  })

  return [
    createDeviceBoundsMatrix(parentMatrix, entity.assetKind, assetRegistry),
  ]
}

export function getWorldOutlineMatrices(entity, localMatrices) {
  const entityMatrix = createSceneEntityMatrix(entity)
  return localMatrices.map((matrix) => entityMatrix.clone().multiply(matrix))
}

export function createMonitorHitArea(entries) {
  const geometries = []
  const entityIdsByFace = []

  entries.forEach(({ bounds, entity }) => {
    if (!bounds || bounds.size.some((value) => value <= 0)) return

    const geometry = new BoxGeometry(...bounds.size)
    geometry.translate(...bounds.center)
    geometry.applyMatrix4(createSceneEntityMatrix(entity))
    geometries.push(geometry)

    const faceCount =
      (geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 3
    for (let faceIndex = 0; faceIndex < faceCount; faceIndex += 1) {
      entityIdsByFace.push(entity.id)
    }
  })

  if (geometries.length === 0) {
    return { entityIdsByFace, geometry: new BufferGeometry() }
  }

  const geometry = mergeGeometries(geometries, false) ?? new BufferGeometry()
  geometries.forEach((entry) => entry.dispose())
  return { entityIdsByFace, geometry }
}
