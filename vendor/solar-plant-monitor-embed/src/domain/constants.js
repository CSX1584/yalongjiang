export const DOCUMENT_SCHEMA_VERSION = 1

export const TEMPLATE_IDS = Object.freeze({
  PV: 'pv-subarray',
  ESS: 'ess-subarray',
})

export const ASSET_KINDS = Object.freeze({
  PV_PANEL: 'pv-panel',
  BATTERY: 'battery',
  TRANSFORMER: 'transformer',
  PCS: 'pcs',
  GRID: 'grid',
  CONTROL_ROOM: 'control-room',
})

export const WORKSPACE_MODES = Object.freeze({
  SCENE: 'scene',
  TEMPLATE: 'template',
})

export const TRANSFORM_TOOLS = Object.freeze({
  MOVE: 'translate',
  ROTATE: 'rotate',
})

export const CAMERA_PROJECTIONS = Object.freeze({
  ORTHOGRAPHIC: 'orthographic',
  PERSPECTIVE: 'perspective',
})

export const CAMERA_LIMITS = Object.freeze({
  defaultFov: 50,
  minFov: 25,
  maxFov: 90,
})

export const EDITOR_LIMITS = Object.freeze({
  minLayoutSpacing: 0.1,
  maxTemplateComponents: 500,
  maxSceneInstances: 1000,
  maxPvRows: 40,
  maxPvColumns: 80,
  maxPcsPerGroup: 80,
  maxImportCharacters: 5_000_000,
  maxHistoryCommands: 100,
})
