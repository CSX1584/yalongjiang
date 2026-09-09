import { useMemo } from 'react'
import { ASSET_KINDS } from '../domain/constants.js'
import {
  getSceneAssetFoundation,
  getSceneAssetFoundationBounds,
  getTemplateFoundation,
  getTemplateFoundationBounds,
} from '../domain/documents.js'
import { AssetModel, InstancedAssetModel } from './AssetModel.jsx'
import { TemplateFoundation } from './TemplateFoundation.jsx'

function PvArray({ component, assetRegistry, coverageOpacity }) {
  const { rows, columns, rowSpacing, columnSpacing } = component.parameters
  const xOffset = ((columns - 1) * columnSpacing) / 2
  const zOffset = ((rows - 1) * rowSpacing) / 2
  const instanceTransforms = useMemo(
    () =>
      Array.from({ length: rows * columns }, (_, index) => {
        const row = Math.floor(index / columns)
        const column = index % columns
        return {
          position: [
            column * columnSpacing - xOffset,
            0,
            row * rowSpacing - zOffset,
          ],
        }
      }),
    [columnSpacing, columns, rowSpacing, rows, xOffset, zOffset],
  )

  return (
    <InstancedAssetModel
      assetKind={ASSET_KINDS.PV_PANEL}
      assetRegistry={assetRegistry}
      coverageOpacity={coverageOpacity}
      instanceTransforms={instanceTransforms}
    />
  )
}

function PcsGroup({ component, assetRegistry, coverageOpacity }) {
  const { count, spacing } = component.parameters
  const xOffset = ((count - 1) * spacing) / 2
  const instanceTransforms = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        position: [index * spacing - xOffset, 0, 0],
      })),
    [count, spacing, xOffset],
  )

  return (
    <InstancedAssetModel
      assetKind={ASSET_KINDS.PCS}
      assetRegistry={assetRegistry}
      coverageOpacity={coverageOpacity}
      instanceTransforms={instanceTransforms}
    />
  )
}

export function ComponentContent({
  component,
  assetRegistry,
  coverageOpacity = 1,
}) {
  if (component.kind === 'pv-array') {
    return (
      <PvArray
        component={component}
        assetRegistry={assetRegistry}
        coverageOpacity={coverageOpacity}
      />
    )
  }

  if (component.kind === 'pcs-group') {
    return (
      <PcsGroup
        component={component}
        assetRegistry={assetRegistry}
        coverageOpacity={coverageOpacity}
      />
    )
  }

  return (
    <AssetModel
      assetKind={component.assetKind}
      assetRegistry={assetRegistry}
      coverageOpacity={coverageOpacity}
    />
  )
}

export function SceneAssetContent({
  entity,
  assetRegistry,
  coverageOpacity = 1,
  gridSpacing = 2,
}) {
  const foundation = getSceneAssetFoundation(entity)
  if (!foundation) {
    return (
      <AssetModel
        assetKind={entity.assetKind}
        assetRegistry={assetRegistry}
        coverageOpacity={coverageOpacity}
      />
    )
  }

  const foundationBounds = getSceneAssetFoundationBounds(
    entity,
    assetRegistry,
    gridSpacing,
  )

  return (
    <>
      <TemplateFoundation
        bounds={foundationBounds}
        coverageOpacity={coverageOpacity}
      />
      <group position-y={foundation.thickness}>
        <AssetModel
          assetKind={entity.assetKind}
          assetRegistry={assetRegistry}
          coverageOpacity={coverageOpacity}
        />
      </group>
    </>
  )
}

export function TemplateContent({
  template,
  assetRegistry,
  coverageOpacity = 1,
  gridSpacing = 2,
}) {
  const foundation = getTemplateFoundation(template)
  const foundationBounds = getTemplateFoundationBounds(
    template,
    assetRegistry,
    gridSpacing,
  )

  return (
    <>
      <TemplateFoundation
        bounds={foundationBounds}
        coverageOpacity={coverageOpacity}
      />
      {template.components.map((component) => (
        <group
          key={component.id}
          position={[
            component.transform.position[0],
            component.transform.position[1] + foundation.thickness,
            component.transform.position[2],
          ]}
          rotation-y={component.transform.rotationY}
        >
          <ComponentContent
            component={component}
            assetRegistry={assetRegistry}
            coverageOpacity={coverageOpacity}
          />
        </group>
      ))}
    </>
  )
}
