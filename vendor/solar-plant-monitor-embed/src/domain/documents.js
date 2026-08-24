import {
  Box3,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import {
  ASSET_KINDS,
  DOCUMENT_SCHEMA_VERSION,
  TEMPLATE_IDS,
} from './constants.js'
import { createEntityId } from './ids.js'

export const DEFAULT_TEMPLATE_FOUNDATION = Object.freeze({
  kind: 'rounded-plot',
  paddingGridUnits: 2,
  thickness: 0.24,
  cornerRadius: 0.8,
})

const SCENE_ASSET_FOUNDATION_KINDS = new Set([
  ASSET_KINDS.GRID,
])

export function createTemplateFoundation() {
  return { ...DEFAULT_TEMPLATE_FOUNDATION }
}

export function getTemplateFoundation(template) {
  return {
    ...DEFAULT_TEMPLATE_FOUNDATION,
    ...(template?.foundation ?? {}),
  }
}

export function supportsSceneAssetFoundation(assetKind) {
  return SCENE_ASSET_FOUNDATION_KINDS.has(assetKind)
}

export function getSceneAssetFoundation(entity) {
  if (
    entity?.kind !== 'asset' ||
    !supportsSceneAssetFoundation(entity.assetKind)
  ) {
    return null
  }

  return {
    ...DEFAULT_TEMPLATE_FOUNDATION,
    ...(entity.foundation ?? {}),
  }
}

export function createTransform(x = 0, z = 0, rotationY = 0) {
  return {
    position: [x, 0, z],
    rotationY,
  }
}

export function createPvArrayComponent(index = 0) {
  const column = index % 4
  const row = Math.floor(index / 4)

  return {
    id: createEntityId('pv-array'),
    kind: 'pv-array',
    name: `光伏阵列 ${String(index + 1).padStart(2, '0')}`,
    transform: createTransform((column - 1.5) * 13, (row - 0.5) * 10),
    parameters: {
      rows: 2,
      columns: 4,
      rowSpacing: 2.5,
      columnSpacing: 3.2,
    },
  }
}

export function createPcsGroupComponent(index = 0) {
  const column = index % 3
  const row = Math.floor(index / 3)

  return {
    id: createEntityId('pcs-group'),
    kind: 'pcs-group',
    name: `PCS 组 ${String(index + 1).padStart(2, '0')}`,
    transform: createTransform((column - 1) * 9, (row - 0.5) * 9),
    parameters: {
      count: 6,
      spacing: 1.8,
    },
  }
}

export function createAssetComponent(assetKind, index = 0, position) {
  const labelByKind = {
    [ASSET_KINDS.BATTERY]: '储能设备',
    [ASSET_KINDS.TRANSFORMER]: '变压器',
    [ASSET_KINDS.PCS]: 'PCS',
  }

  return {
    id: createEntityId(assetKind),
    kind: 'asset',
    assetKind,
    name: `${labelByKind[assetKind] ?? '设备'} ${String(index + 1).padStart(2, '0')}`,
    transform: position ?? createTransform(index * 3, 0),
  }
}

export function createDefaultPvTemplate() {
  const arrays = Array.from({ length: 8 }, (_, index) =>
    createPvArrayComponent(index),
  )
  const transformer = createAssetComponent(
    ASSET_KINDS.TRANSFORMER,
    0,
    createTransform(0, 13),
  )

  return {
    id: TEMPLATE_IDS.PV,
    kind: 'pv',
    name: '光伏子阵',
    foundation: createTemplateFoundation(),
    components: [...arrays, transformer],
  }
}

export function createDefaultEssTemplate() {
  const batteries = Array.from({ length: 6 }, (_, index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    return createAssetComponent(
      ASSET_KINDS.BATTERY,
      index,
      createTransform((column - 1) * 4.2, row * 4.2 - 9),
    )
  })
  const transformers = Array.from({ length: 2 }, (_, index) =>
    createAssetComponent(
      ASSET_KINDS.TRANSFORMER,
      index,
      createTransform((index - 0.5) * 9, 0),
    ),
  )
  const pcsGroups = Array.from({ length: 6 }, (_, index) =>
    createPcsGroupComponent(index),
  )

  return {
    id: TEMPLATE_IDS.ESS,
    kind: 'ess',
    name: '储能子阵',
    foundation: createTemplateFoundation(),
    components: [...batteries, ...transformers, ...pcsGroups],
  }
}

export function createSceneTemplateInstance(templateId, index = 0, position) {
  return {
    id: createEntityId('template-instance'),
    kind: 'template',
    templateId,
    name: `${templateId === TEMPLATE_IDS.PV ? '光伏子阵' : '储能子阵'} ${String(index + 1).padStart(2, '0')}`,
    transform: position ?? createTransform(0, 0),
  }
}

export function createSceneAssetInstance(assetKind, index = 0, position) {
  const labelByKind = {
    [ASSET_KINDS.GRID]: '电网设备',
    [ASSET_KINDS.CONTROL_ROOM]: '监控室',
  }

  const foundation = supportsSceneAssetFoundation(assetKind)
    ? createTemplateFoundation()
    : null

  return {
    id: createEntityId('asset-instance'),
    kind: 'asset',
    assetKind,
    name: `${labelByKind[assetKind] ?? '独立设备'} ${String(index + 1).padStart(2, '0')}`,
    transform: position ?? createTransform(0, 0),
    ...(foundation ? { foundation } : {}),
  }
}

export function createDefaultScene() {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: 'solar-plant-scene',
    name: '电站场景 01',
    instances: [
      createSceneTemplateInstance(TEMPLATE_IDS.PV, 0, createTransform(-32, -18)),
      createSceneTemplateInstance(TEMPLATE_IDS.PV, 1, createTransform(18, -18)),
      createSceneTemplateInstance(TEMPLATE_IDS.PV, 2, createTransform(-32, 23)),
      createSceneTemplateInstance(TEMPLATE_IDS.PV, 3, createTransform(18, 23)),
      createSceneTemplateInstance(TEMPLATE_IDS.ESS, 0, createTransform(55, -8)),
      createSceneAssetInstance(ASSET_KINDS.GRID, 0, createTransform(54, 34)),
      createSceneAssetInstance(
        ASSET_KINDS.CONTROL_ROOM,
        0,
        createTransform(-62, 34),
      ),
    ],
    environment: {
      groundSize: [180, 130],
      gridSpacing: 2,
      hdrUrl: null,
    },
  }
}

export function createDefaultDocuments() {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    templates: {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      items: {
        [TEMPLATE_IDS.PV]: createDefaultPvTemplate(),
        [TEMPLATE_IDS.ESS]: createDefaultEssTemplate(),
      },
    },
    scene: createDefaultScene(),
  }
}

export function getTemplateInstanceCount(scene, templateId) {
  return scene.instances.filter(
    (instance) =>
      instance.kind === 'template' && instance.templateId === templateId,
  ).length
}

export function getComponentAssetCount(component) {
  if (component.kind === 'pv-array') {
    return component.parameters.rows * component.parameters.columns
  }

  if (component.kind === 'pcs-group') {
    return component.parameters.count
  }

  return 1
}

export function getTemplateAssetCount(template) {
  return template.components.reduce(
    (total, component) => total + getComponentAssetCount(component),
    0,
  )
}

function boundsFromBox(box) {
  const center = box.getCenter(new Vector3()).toArray()
  const size = box.getSize(new Vector3()).toArray()
  return { center, size }
}

function boxFromBounds(bounds) {
  const center = new Vector3(...bounds.center)
  const halfSize = new Vector3(...bounds.size).multiplyScalar(0.5)
  return new Box3(center.clone().sub(halfSize), center.clone().add(halfSize))
}

function unionBounds(boundsList) {
  if (boundsList.length === 0) return null

  const box = new Box3()
  boundsList.forEach((bounds) => box.union(boxFromBounds(bounds)))
  return boundsFromBox(box)
}

function translateBounds(bounds, position) {
  return {
    center: bounds.center.map((value, index) => value + position[index]),
    size: [...bounds.size],
  }
}

function transformBounds(bounds, transform) {
  const [x, y, z] = transform.position
  const rotationY = transform.rotationY
  const cos = Math.cos(rotationY)
  const sin = Math.sin(rotationY)
  const absoluteCos = Math.abs(cos)
  const absoluteSin = Math.abs(sin)
  const [centerX, centerY, centerZ] = bounds.center
  const [width, height, depth] = bounds.size

  return {
    center: [
      x + centerX * cos + centerZ * sin,
      y + centerY,
      z - centerX * sin + centerZ * cos,
    ],
    size: [
      absoluteCos * width + absoluteSin * depth,
      height,
      absoluteSin * width + absoluteCos * depth,
    ],
  }
}

export function getAssetBounds(definition) {
  if (definition?.measuredBounds) {
    return {
      center: [...definition.measuredBounds.center],
      size: [...definition.measuredBounds.size],
    }
  }

  const dimensions = definition?.dimensions ?? [2, 2, 2]
  const sourceBounds = definition?.sourceBounds ?? {
    min: [-dimensions[0] / 2, 0, -dimensions[2] / 2],
    max: [dimensions[0] / 2, dimensions[1], dimensions[2] / 2],
  }
  const sourceBox = new Box3(
    new Vector3(...sourceBounds.min),
    new Vector3(...sourceBounds.max),
  )
  const rotation = new Euler(...(definition?.modelRotation ?? [0, 0, 0]))
  const autoAnchor = definition?.autoAnchor !== false
  const matrix = new Matrix4().compose(
    new Vector3(
      ...(autoAnchor ? [0, 0, 0] : (definition?.modelOffset ?? [0, 0, 0])),
    ),
    new Quaternion().setFromEuler(rotation),
    new Vector3(...(definition?.modelScale ?? [1, 1, 1])),
  )
  sourceBox.applyMatrix4(matrix)
  if (autoAnchor) {
    const center = sourceBox.getCenter(new Vector3())
    sourceBox.translate(new Vector3(-center.x, -sourceBox.min.y, -center.z))
  }

  return boundsFromBox(sourceBox)
}

export function getComponentBounds(component, assetRegistry) {
  if (component.kind === 'pv-array') {
    const { columns, rows, columnSpacing, rowSpacing } = component.parameters
    const panelBounds = getAssetBounds(assetRegistry[ASSET_KINDS.PV_PANEL])
    const xOffset = ((columns - 1) * columnSpacing) / 2
    const zOffset = ((rows - 1) * rowSpacing) / 2
    const panels = []

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        panels.push(
          translateBounds(panelBounds, [
            column * columnSpacing - xOffset,
            0,
            row * rowSpacing - zOffset,
          ]),
        )
      }
    }

    return unionBounds(panels)
  }

  if (component.kind === 'pcs-group') {
    const pcsBounds = getAssetBounds(assetRegistry[ASSET_KINDS.PCS])
    const { count, spacing } = component.parameters
    const xOffset = ((count - 1) * spacing) / 2
    return unionBounds(
      Array.from({ length: count }, (_, index) =>
        translateBounds(pcsBounds, [index * spacing - xOffset, 0, 0]),
      ),
    )
  }

  return getAssetBounds(assetRegistry[component.assetKind])
}

export function getTemplateComponentBounds(template, component, assetRegistry) {
  const foundation = getTemplateFoundation(template)
  return translateBounds(
    getComponentBounds(component, assetRegistry),
    [0, foundation.thickness, 0],
  )
}

export function getTemplateEquipmentBounds(template, assetRegistry) {
  if (!template?.components.length) return null

  return unionBounds(
    template.components.map((component) =>
      transformBounds(
        getTemplateComponentBounds(template, component, assetRegistry),
        component.transform,
      ),
    ),
  )
}

function snapOutward(value, spacing, direction) {
  const tolerance = spacing * 1e-9
  return direction === 'min'
    ? Math.floor((value + tolerance) / spacing) * spacing
    : Math.ceil((value - tolerance) / spacing) * spacing
}

function getFoundationBounds(equipmentBounds, foundation, gridSpacing) {
  const spacing = Math.max(Number(gridSpacing) || 2, 0.001)
  const padding = foundation.paddingGridUnits * spacing
  const equipmentCenter = equipmentBounds?.center ?? [0, 0, 0]
  const equipmentSize = equipmentBounds?.size ?? [0, 0, 0]
  const minX = snapOutward(
    equipmentCenter[0] - equipmentSize[0] / 2 - padding,
    spacing,
    'min',
  )
  const maxX = snapOutward(
    equipmentCenter[0] + equipmentSize[0] / 2 + padding,
    spacing,
    'max',
  )
  const minZ = snapOutward(
    equipmentCenter[2] - equipmentSize[2] / 2 - padding,
    spacing,
    'min',
  )
  const maxZ = snapOutward(
    equipmentCenter[2] + equipmentSize[2] / 2 + padding,
    spacing,
    'max',
  )

  return {
    center: [
      (minX + maxX) / 2,
      foundation.thickness / 2,
      (minZ + maxZ) / 2,
    ],
    size: [maxX - minX, foundation.thickness, maxZ - minZ],
    cornerRadius: Math.min(
      foundation.cornerRadius,
      (maxX - minX) / 2,
      (maxZ - minZ) / 2,
    ),
  }
}

export function getTemplateFoundationBounds(
  template,
  assetRegistry,
  gridSpacing = 2,
) {
  const equipmentBounds = getTemplateEquipmentBounds(template, assetRegistry)
  const foundation = getTemplateFoundation(template)
  return getFoundationBounds(equipmentBounds, foundation, gridSpacing)
}

export function getTemplateBounds(template, assetRegistry, gridSpacing = 2) {
  const equipmentBounds = getTemplateEquipmentBounds(template, assetRegistry)
  const foundationBounds = getTemplateFoundationBounds(
    template,
    assetRegistry,
    gridSpacing,
  )

  return unionBounds(
    equipmentBounds ? [equipmentBounds, foundationBounds] : [foundationBounds],
  )
}

export function getSceneAssetFoundationBounds(
  entity,
  assetRegistry,
  gridSpacing = 2,
) {
  const foundation = getSceneAssetFoundation(entity)
  if (!foundation) return null

  const equipmentBounds = translateBounds(
    getComponentBounds(entity, assetRegistry),
    [0, foundation.thickness, 0],
  )
  return getFoundationBounds(equipmentBounds, foundation, gridSpacing)
}

export function getSceneAssetBounds(entity, assetRegistry, gridSpacing = 2) {
  const foundation = getSceneAssetFoundation(entity)
  const assetBounds = getComponentBounds(entity, assetRegistry)
  if (!foundation) return assetBounds

  const equipmentBounds = translateBounds(
    assetBounds,
    [0, foundation.thickness, 0],
  )
  const foundationBounds = getFoundationBounds(
    equipmentBounds,
    foundation,
    gridSpacing,
  )
  return unionBounds([equipmentBounds, foundationBounds])
}

export function getSceneInstanceBounds(
  instance,
  templates,
  assetRegistry,
  gridSpacing = 2,
) {
  if (instance.kind === 'template') {
    return getTemplateBounds(
      templates[instance.templateId],
      assetRegistry,
      gridSpacing,
    )
  }

  return getSceneAssetBounds(instance, assetRegistry, gridSpacing)
}
