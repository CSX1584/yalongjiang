import { ASSET_KINDS } from '../domain/constants.js'

export const DEFAULT_ASSET_METADATA = Object.freeze({
  [ASSET_KINDS.PV_PANEL]: {
    id: ASSET_KINDS.PV_PANEL,
    label: '光伏板',
    autoAnchor: true,
    modelScale: [1, 1, 1],
    modelRotation: [0, 0, 0],
    castShadow: false,
    // 薄板的正反面在全场阴影图中容易产生远景自阴影碎片。
    receiveShadow: false,
  },
  [ASSET_KINDS.BATTERY]: {
    id: ASSET_KINDS.BATTERY,
    label: '储能设备',
    autoAnchor: true,
    modelScale: [1, 1, 1],
    modelRotation: [0, 0, 0],
  },
  [ASSET_KINDS.TRANSFORMER]: {
    id: ASSET_KINDS.TRANSFORMER,
    label: '变压器',
    autoAnchor: true,
    modelScale: [1, 1, 1],
    modelRotation: [0, 0, 0],
  },
  [ASSET_KINDS.PCS]: {
    id: ASSET_KINDS.PCS,
    label: 'PCS',
    autoAnchor: true,
    modelScale: [1, 1, 1],
    modelRotation: [0, 0, 0],
  },
  [ASSET_KINDS.GRID]: {
    id: ASSET_KINDS.GRID,
    label: '电网设备',
    autoAnchor: true,
    modelScale: [1, 1, 1],
    modelRotation: [0, 0, 0],
  },
  [ASSET_KINDS.CONTROL_ROOM]: {
    id: ASSET_KINDS.CONTROL_ROOM,
    label: '监控室',
    autoAnchor: true,
    modelScale: [1, 1, 1],
    modelRotation: [0, 0, 0],
  },
})
