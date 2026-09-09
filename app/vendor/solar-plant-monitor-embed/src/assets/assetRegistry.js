import { ASSET_KINDS } from '../domain/constants.js'
import { createBundledGltfUrl } from './createBundledGltfUrl.js'
import { DEFAULT_ASSET_METADATA } from './assetMetadata.js'
import { deriveGltfGeometryMetadata } from './gltfGeometryMetadata.js'
import { getRuntimeTextureVariantsForAsset } from './runtimeTextureManifest.js'

import pvGltf from './PV.gltf?raw'
import pvBinUrl from './PV.bin?url'
import pvDiffuseUrl from './runtime/PV_Bake1_PBR StoA_Diffuse.png?url'
import pvNormalUrl from './runtime/PV_Bake1_PBR StoA_Normal.png?url'
import pvMetallicRoughnessUrl from './runtime/PV_Bake1_PBR StoA_Metalness-PV_Bake1_PBR StoA_Roughness.png?url'
import essGltf from './ESS.gltf?raw'
import essBinUrl from './ESS.bin?url'
import essNormalUrl from './runtime/ESS_Bake1_PBR StoA_Normal.png?url'
import transformerGltf from './Transformer.gltf?raw'
import transformerBinUrl from './Transformer.bin?url'
import transformerNormalUrl from './runtime/Transformer_Bake1_PBR StoA_Normal.png?url'
import pcsGltf from './PCS.gltf?raw'
import pcsBinUrl from './PCS.bin?url'
import pcsNormalUrl from './runtime/PCS_Bake1_PBR StoA_Normal.png?url'
import gridGltf from './Grid.gltf?raw'
import gridBinUrl from './Grid.bin?url'
import monitoringRoomGltf from './Monitoring Room.gltf?raw'
import monitoringRoomBinUrl from './Monitoring Room.bin?url'

const RUNTIME_TEXTURE_URLS = Object.freeze({
  'runtime/PV_Bake1_PBR StoA_Diffuse.png': pvDiffuseUrl,
  'runtime/PV_Bake1_PBR StoA_Normal.png': pvNormalUrl,
  'runtime/PV_Bake1_PBR StoA_Metalness-PV_Bake1_PBR StoA_Roughness.png':
    pvMetallicRoughnessUrl,
  'runtime/ESS_Bake1_PBR StoA_Normal.png': essNormalUrl,
  'runtime/Transformer_Bake1_PBR StoA_Normal.png': transformerNormalUrl,
  'runtime/PCS_Bake1_PBR StoA_Normal.png': pcsNormalUrl,
})

function getRuntimeTextureResourceUrls(asset) {
  return Object.fromEntries(
    getRuntimeTextureVariantsForAsset(asset).map((variant) => {
      const url = RUNTIME_TEXTURE_URLS[variant.runtime]
      if (!url) {
        throw new Error(`缺少运行时贴图 URL：${variant.runtime}`)
      }
      return [variant.source, url]
    }),
  )
}

const BUNDLED_ASSET_SOURCES = Object.freeze({
  [ASSET_KINDS.PV_PANEL]: {
    gltfSource: pvGltf,
    resourceUrls: {
      'PV.bin': pvBinUrl,
      ...getRuntimeTextureResourceUrls('PV.gltf'),
    },
  },
  [ASSET_KINDS.BATTERY]: {
    gltfSource: essGltf,
    resourceUrls: {
      'ESS.bin': essBinUrl,
      ...getRuntimeTextureResourceUrls('ESS.gltf'),
    },
  },
  [ASSET_KINDS.TRANSFORMER]: {
    gltfSource: transformerGltf,
    resourceUrls: {
      'Transformer.bin': transformerBinUrl,
      ...getRuntimeTextureResourceUrls('Transformer.gltf'),
    },
  },
  [ASSET_KINDS.PCS]: {
    gltfSource: pcsGltf,
    resourceUrls: {
      'PCS.bin': pcsBinUrl,
      ...getRuntimeTextureResourceUrls('PCS.gltf'),
    },
  },
  [ASSET_KINDS.GRID]: {
    gltfSource: gridGltf,
    resourceUrls: { 'Grid.bin': gridBinUrl },
  },
  [ASSET_KINDS.CONTROL_ROOM]: {
    gltfSource: monitoringRoomGltf,
    resourceUrls: { 'Monitoring Room.bin': monitoringRoomBinUrl },
  },
})

export const DEFAULT_ASSET_REGISTRY = Object.freeze(
  Object.fromEntries(
    Object.entries(BUNDLED_ASSET_SOURCES).map(
      ([assetKind, { gltfSource, resourceUrls }]) => [
        assetKind,
        {
          ...DEFAULT_ASSET_METADATA[assetKind],
          ...deriveGltfGeometryMetadata(gltfSource),
          url: createBundledGltfUrl(
            gltfSource,
            resourceUrls,
            import.meta.url,
          ),
        },
      ],
    ),
  ),
)

export function mergeAssetRegistry(overrides = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_ASSET_REGISTRY).map(([assetKind, definition]) => {
      const override = overrides[assetKind] ?? {}
      const merged = { ...definition, ...override }
      const replacesGeometrySource =
        Object.hasOwn(override, 'url') || Object.hasOwn(override, 'dimensions')

      if (
        Object.hasOwn(override, 'modelOffset') &&
        !Object.hasOwn(override, 'autoAnchor')
      ) {
        merged.autoAnchor = false
      }

      if (
        replacesGeometrySource &&
        !Object.hasOwn(override, 'sourceBounds')
      ) {
        delete merged.sourceBounds
      }
      if (
        replacesGeometrySource &&
        !Object.hasOwn(override, 'modelOffset')
      ) {
        delete merged.modelOffset
      }
      if (Object.hasOwn(override, 'url') && !Object.hasOwn(override, 'triangleCount')) {
        delete merged.triangleCount
      }

      return [assetKind, merged]
    }),
  )
}
