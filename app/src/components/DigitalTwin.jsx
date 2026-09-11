import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BatteryCharging,
  Camera,
  Check,
  CaretRight as ChevronRight,
  FloppyDisk,
  Stack as Layers3,
  Crosshair as LocateFixed,
  ArrowsOut as Maximize2,
  ArrowsIn as Minimize2,
  ArrowCounterClockwise as RotateCcw,
  SlidersHorizontal,
  Sun,
  Warning as TriangleAlert,
  Wind,
  X,
} from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useApp } from '../context/AppContext'
import { stations as fallbackStations } from '../data/demoData'
import projectMapConfig from '../data/mapConfig.json'
import { saveMapConfig } from './mapConfig.mjs'
import { EVENT_PHASES, getStationEvents, getStationKpis } from './stationCardData.mjs'
import { upgradeModelShadows } from './modelShadowQuality'
import StationGlassSettings from './StationGlassSettings'
import { glassCssVariables } from './stationGlassConfig.mjs'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()
// 临时录屏精简：录制结束后改为 false，恢复浮层和底图标注。
const RECORDING_MODE = true
const CAMERA_01 = {
  center: [101.0023073258, 27.7601268283],
  zoom: 8.0942241286,
  pitch: 80,
  bearing: 21.6,
}
const CAMERA_PRESETS = [
  { name: '镜头01', camera: CAMERA_01 },
  { name: '镜头02', camera: {
    center: [101.37661223434884, 28.355902485064078],
    zoom: 9.081086751597558,
    pitch: 80,
    bearing: 25.28815816295446,
  } },
]
const TERRAIN_SOURCE_ID = 'ops-terrain-dem'
const TERRAIN_EXAGGERATION = 1.32
const OUTDOORS_TERRAIN = {
  source: 'mapbox-dem',
  exaggeration: ['interpolate', ['linear'], ['zoom'], 6, 0, 7, 1.2],
}
const STATION_COORDINATES = {
  kela: [101.0156, 30.0299],
  zhalashan: [101.672, 28.142],
  lianghekou: [100.391, 30.214],
  labashan: [101.508, 27.518],
}
const CORRIDOR_ORDER = ['labashan', 'zhalashan', 'kela', 'lianghekou']
const STATION_MODEL_SOURCE_ID = 'ops-station-model-source'
const STATION_MODEL_LAYER_ID = 'ops-station-model-layer'
const STATION_MODEL_URL = '/models/station.glb'
const STATION_MODEL_BLADE_NODE = '风能叶片'
const STATION_MODEL_BLADE_STATE = 'bladeRotation'
const STATION_MODEL_BLADE_PERIOD_MS = 6000
// World-space Y maximum of the current GLB, including its node translations.
const STATION_MODEL_NATURAL_HEIGHT = 5.893375962972641
const MODEL_SCALE_MIN = 100
const MODEL_SCALE_MAX = 10000
const MODEL_ELEVATION_MIN = -100000
const MODEL_ELEVATION_MAX = 100000
const DEFAULT_STATION_MODEL_CONFIG = projectMapConfig.modelConfig

const FALLBACK_POSITIONS = {
  lianghekou: { left: '25%', top: '32%' },
  kela: { left: '75%', top: '32%' },
  zhalashan: { left: '25%', top: '70%' },
  labashan: { left: '75%', top: '70%' },
}
const LIGHT_PRESETS = [
  ['dawn', '晨曦'],
  ['day', '白昼'],
  ['dusk', '黄昏'],
  ['night', '夜景'],
]
const SUN_LIGHT_BY_PRESET = {
  dawn: { direction: [110, 28], color: '#ffd8a8', intensity: 0.65 },
  day: { direction: [30, 55], color: '#fff2d6', intensity: 0.9 },
  dusk: { direction: [250, 24], color: '#f2b08a', intensity: 0.5 },
  night: { direction: [180, 18], color: '#9bb7e8', intensity: 0.18 },
}
const OUTDOORS_DAY_AZIMUTH = 289
const OUTDOORS_DAY_POLAR = 31
const OUTDOORS_DAY_ELEVATION = 45

function cloneLights(lights) {
  return (lights || []).map((light) => ({
    ...light,
    properties: light.properties ? { ...light.properties } : light.properties,
  }))
}

const MAP_APPEARANCE = {
  dark: {
    colors: {
      colorPlaceLabels: '#d9e5eb',
      colorRoadLabels: '#758894',
      colorWater: '#07131d',
      colorLand: '#233239',
      colorGreenspace: '#223b34',
      colorAdminBoundaries: '#53636e',
      colorRoads: '#43545f',
      colorMotorways: '#607889',
      colorTrunks: '#526b7a',
      colorBuildings: '#303e46',
    },
    fog: { color: '#17252c', 'high-color': '#273d45', 'horizon-blend': 0.08, 'space-color': '#05090c' },
  },
  light: {
    colors: {
      colorPlaceLabels: '#1c1c1e',
      colorRoadLabels: '#6d6d72',
      colorWater: '#dcecf5',
      colorLand: '#e8e8ed',
      colorGreenspace: '#dce8dc',
      colorAdminBoundaries: '#aeaeb2',
      colorRoads: '#c7c7cc',
      colorMotorways: '#aeaeb2',
      colorTrunks: '#b8b8bd',
      colorBuildings: '#d1d1d6',
    },
    fog: { color: '#dce7eb', 'high-color': '#f2f7f8', 'horizon-blend': 0.12, 'space-color': '#b7c6cb' },
  },
}

function getMapAppearance(preset) {
  return MAP_APPEARANCE[preset === 'night' || preset === 'dusk' ? 'dark' : 'light']
}

function clampModelParameter(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}


function normalizeModelEmission(value) {
  // mix(lit, unlit, emission) reverses shadow contrast above 1; keep some lighting at the UI maximum.
  const emission = Number(value)
  return Number.isFinite(emission) && emission >= 0 && emission <= 0.8 ? emission : 0
}

function getStationElevation(config, stationId) {
  return config.stationElevations?.[stationId] ?? config.elevation
}

function getStationModelTopHeight(config, stationId) {
  return getStationElevation(config, stationId) + STATION_MODEL_NATURAL_HEIGHT * config.scale
}

function getModelTranslationExpression(config, stationIds) {
  const expression = ['match', ['get', 'id']]
  stationIds.forEach((stationId) => {
    expression.push(stationId, ['literal', [0, 0, getStationElevation(config, stationId)]])
  })
  expression.push(['literal', [0, 0, config.elevation]])
  return expression
}

function getModelRotationExpression(rotation) {
  return [
    'case',
    ['==', ['get', 'part'], STATION_MODEL_BLADE_NODE],
    [
      'case',
      ['!=', ['feature-state', STATION_MODEL_BLADE_STATE], null],
      ['array', 'number', 3, ['feature-state', STATION_MODEL_BLADE_STATE]],
      ['literal', [0, 0, 0]],
    ],
    ['literal', [0, 0, rotation]],
  ]
}

function setStationBladeRotation(map, stationIds, angle) {
  stationIds.forEach((stationId) => {
    map.setFeatureState(
      { source: STATION_MODEL_SOURCE_ID, sourceLayer: '', id: stationId },
      { [STATION_MODEL_BLADE_STATE]: [angle, 0, 0] },
    )
  })
}

function getAlertCount(station) {
  return Array.isArray(station.alerts) ? station.alerts.length : Number(station.alerts || 0)
}

function getStationTone(station) {
  if (station.status === 'urgent') return 'urgent'
  if (station.status === 'warning') return 'warning'
  return 'normal'
}

function getStationColor(station) {
  const tone = getStationTone(station)
  if (tone === 'urgent') return '#ff4b4b'
  if (tone === 'warning') return '#F87812'
  return '#009E60'
}

function StationIcon({ type }) {
  if (String(type).includes('风')) return <Wind size={15} />
  if (String(type).includes('储能')) return <BatteryCharging size={15} />
  return <Sun size={15} />
}

function addStationModelLayer(map, modelFeatures, modelUrl) {
  if (!modelFeatures.features.length) return false

  try {
    const stationIds = modelFeatures.features.map((feature) => feature.properties.id)
    const models = Object.fromEntries(modelFeatures.features.map((feature) => [
      feature.properties.id,
      {
        uri: modelUrl,
        // Strong direct light brightens equipment while restrained fill preserves shadow contrast.
        lightOverrides: {
          'light-ambient-color': '#ffffff', 'light-ambient-intensity': 0.8,
          'light-directional-color': '#ffffff', 'light-directional-intensity': 1,
        },
        position: feature.geometry.coordinates,
        nodeOverrideNames: [STATION_MODEL_BLADE_NODE],
        featureProperties: feature.properties,
      },
    ]))
    map.addSource(STATION_MODEL_SOURCE_ID, { type: 'model', models })
    setStationBladeRotation(map, stationIds, 0)
    map.addLayer({
      id: STATION_MODEL_LAYER_ID,
      type: 'model',
      source: STATION_MODEL_SOURCE_ID,
      slot: 'top',
      paint: {
        'model-scale': [DEFAULT_STATION_MODEL_CONFIG.scale, DEFAULT_STATION_MODEL_CONFIG.scale, DEFAULT_STATION_MODEL_CONFIG.scale],
        'model-rotation': getModelRotationExpression(DEFAULT_STATION_MODEL_CONFIG.rotation),
        'model-translation': [0, 0, DEFAULT_STATION_MODEL_CONFIG.elevation],
        'model-elevation-reference': 'sea',
        'model-cast-shadows': true,
        'model-receive-shadows': true,
        'model-emissive-strength': normalizeModelEmission(DEFAULT_STATION_MODEL_CONFIG.emissive),
      },
    })
    return true
  } catch {
    return false
  }
}

function addOperationalLayers(map, stations, corridor, modelFeatures, modelUrl) {
  if (!map.getSource('ops-corridor')) {
    map.addSource('ops-corridor', { type: 'geojson', data: corridor })
    map.addLayer({
      id: 'ops-corridor-glow',
      type: 'line',
      source: 'ops-corridor',
      slot: 'middle',
      paint: {
        'line-color': '#37a2ff',
        'line-width': 9,
        'line-opacity': 0.1,
        'line-blur': 5,
        'line-emissive-strength': 1,
      },
    })
    map.addLayer({
      id: 'ops-corridor-line',
      type: 'line',
      source: 'ops-corridor',
      slot: 'middle',
      paint: {
        'line-color': '#5291ff',
        'line-width': 1.4,
        'line-opacity': 0.68,
        'line-dasharray': [2, 2],
        'line-emissive-strength': 1,
      },
    })
  }

  if (!map.getSource('ops-stations')) {
    map.addSource('ops-stations', { type: 'geojson', data: stations })
    map.addLayer({
      id: 'ops-station-glow',
      type: 'circle',
      source: 'ops-stations',
      slot: 'top',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 20,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.12,
        'circle-blur': 0.75,
        'circle-emissive-strength': 1,
      },
    })
    map.addLayer({
      id: 'ops-station-core',
      type: 'circle',
      source: 'ops-stations',
      slot: 'top',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 4,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#111517',
        'circle-emissive-strength': 1,
      },
    })
  }

  return addStationModelLayer(map, modelFeatures, modelUrl)
}

function applyWeather(map, enabled) {
  if (typeof map.setSnow !== 'function') return
  map.setSnow(enabled ? {
    density: ['interpolate', ['linear'], ['zoom'], 6.5, 0.08, 10.5, 0.34],
    intensity: 0.72,
    'center-thinning': 0.2,
    direction: [15, 42],
    opacity: 0.7,
    color: '#e8f5ff',
    'flake-size': 0.42,
    vignette: 0.12,
    'vignette-color': '#9fb8c9',
  } : null)
}

function StationDetail({ station, onEnter, onSelect }) {
  const { tickets } = useApp()
  const events = getStationEvents(station, tickets)
  const status = station.status === 'stopped' ? '停机' : getAlertCount(station) ? '告警' : '运行中'
  return (
    <article className={`map-station-detail tone-${getStationTone(station)}`} aria-label={`${station.name}运行卡片`}>
      <canvas className="station-glass-canvas" aria-hidden="true" />
      <div className="map-detail-top">
        <div>
          <button className="map-detail-name" type="button" onClick={onSelect}><strong>{station.name}</strong></button>
          <span>{station.output}</span>
        </div>
        <span className={`map-detail-status status-${station.status === 'stopped' ? 'stopped' : status === '告警' ? (station.status === 'urgent' ? 'urgent' : 'warning') : 'normal'}`} role="img" aria-label={status} title={status}>
          {status === '运行中' ? <Check size={16} weight="bold" aria-hidden="true" /> : <TriangleAlert size={16} weight="fill" aria-hidden="true" />}
        </span>
        <button className="map-detail-enter" type="button" onClick={onEnter} aria-label={`进入${station.name}`} title="进入场站">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="map-detail-kpis">
        {getStationKpis(station).map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span><strong>{metric.value}</strong>
            <small className={metric.state === '偏差' ? 'has-alert' : ''}>{metric.state}</small>
          </div>
        ))}
      </div>
      <div className="map-detail-events">
        {events.length ? events.map((event) => (
          <div className="map-detail-event" key={event.id}>
            <TriangleAlert className={`map-event-icon severity-${event.severity}`} size={16} weight="fill" role="img" aria-label={event.severity === 'urgent' ? '紧急' : event.severity === 'warning' ? '重要' : '一般'} />
            <strong title={event.title}>{event.title}</strong>
            <div className="map-event-progress">
              <progress max={EVENT_PHASES.length} value={event.phase + 1} aria-label={`${event.title}：${EVENT_PHASES[event.phase]}`} />
              <span>{event.phase === EVENT_PHASES.length - 1 ? '已闭环' : `待${EVENT_PHASES[event.phase]}`}</span>
              <small>{event.phase + 1}/{EVENT_PHASES.length}</small>
            </div>
          </div>
        )) : <span className="map-detail-empty"><Check size={14} />无活动事件 · 运行正常</span>}
      </div>
    </article>
  )
}

function StaticFallback({ stations, interactive, onEnter, onSelect }) {
  return (
    <div className={`map-static-fallback ${interactive ? 'is-interactive' : ''}`} aria-hidden={interactive ? undefined : true}>
      <svg className="map-fallback-svg" viewBox="0 0 1200 520" role="img" aria-label="雅砻江流域数字孪生降级示意图">
        <defs>
          <pattern id="fallback-grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M34 0H0V34" fill="none" stroke="var(--ops-map-fallback-grid)" />
          </pattern>
          <linearGradient id="fallback-river" x1="0" x2="1">
            <stop offset="0" stopColor="var(--ops-map-river-edge)" />
            <stop offset=".52" stopColor="var(--ops-map-river-center)" />
            <stop offset="1" stopColor="var(--ops-map-river-edge)" />
          </linearGradient>
        </defs>
        <rect width="1200" height="520" fill="var(--ops-map-fallback-bg)" />
        <rect width="1200" height="520" fill="url(#fallback-grid)" />
        <path d="M-20 396c104-52 178-42 260 0 102 52 192 37 282-14 126-72 224-57 322 3 104 63 232 38 386-63" fill="none" stroke="var(--ops-map-river-bank)" strokeWidth="82" />
        <path d="M-20 396c104-52 178-42 260 0 102 52 192 37 282-14 126-72 224-57 322 3 104 63 232 38 386-63" fill="none" stroke="url(#fallback-river)" strokeWidth="7" />
        <path d="M35 118C220 52 350 89 486 45s290-20 411 13 214 27 303-2" fill="none" stroke="var(--ops-map-contour-strong)" />
        <path d="M12 160C190 98 342 126 482 82s276-22 409 15 214 32 309 4" fill="none" stroke="var(--ops-map-contour-soft)" />
      </svg>
      {interactive ? stations.map((station) => (
        <div className="fallback-station-card" key={station.id} style={FALLBACK_POSITIONS[station.id]}>
          <StationDetail station={station} onEnter={() => onEnter(station)} onSelect={() => onSelect(station)} />
        </div>
      )) : null}
    </div>
  )
}

export default function DigitalTwin({ stations = fallbackStations, active = true }) {
  const navigate = useNavigate()
  const { theme } = useApp()
  const mapStyle = theme === 'light' ? 'mapbox://styles/mapbox-map-design/cmh0wgofd00bu01srg2k73chv' : 'mapbox://styles/mapbox/standard'
  const panelRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRefs = useRef(new Map())
  const mapStations = useMemo(() => (stations || fallbackStations)
    .map((station) => ({ ...station, mapCoordinates: STATION_COORDINATES[station.id] }))
    .filter((station) => station.mapCoordinates), [stations])
  const [modelConfig, setModelConfig] = useState(() => projectMapConfig.modelConfig)
  const modelConfigRef = useRef(modelConfig)
  modelConfigRef.current = modelConfig
  const [selectedId, setSelectedId] = useState(() => mapStations.find((station) => station.id === 'kela')?.id || mapStations[0]?.id)
  const [modelStationId, setModelStationId] = useState(() => mapStations.some((station) => station.id === modelConfig.stationId)
    ? modelConfig.stationId
    : mapStations.find((station) => station.id === 'kela')?.id || mapStations[0]?.id)
  const [flat, setFlat] = useState(projectMapConfig.flat)
  const [pageFullscreen, setPageFullscreen] = useState(false)
  const [lightPreset, setLightPreset] = useState(projectMapConfig.lightPreset)
  const lightPresetRef = useRef(lightPreset)
  lightPresetRef.current = lightPreset
  const [sunAzimuth, setSunAzimuth] = useState(projectMapConfig.sunAzimuth)
  const [sunElevation, setSunElevation] = useState(projectMapConfig.sunElevation)
  const [sunPositionCustom, setSunPositionCustom] = useState(projectMapConfig.sunPositionCustom)
  const customSunLightsRef = useRef(false)
  const officialSunLightsRef = useRef(null)
  const [layersOpen, setLayersOpen] = useState(false)
  const [camerasOpen, setCamerasOpen] = useState(false)
  const [cameraRequest, setCameraRequest] = useState(null)
  const [savedCamera, setSavedCamera] = useState(() => projectMapConfig.savedCamera)
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false)
  const [glassSettingsOpen, setGlassSettingsOpen] = useState(false)
  const [glassConfig, setGlassConfig] = useState(() => projectMapConfig.glassConfig)
  const glassConfigRef = useRef(glassConfig)
  glassConfigRef.current = glassConfig
  const [terrainEnabled, setTerrainEnabled] = useState(projectMapConfig.terrainEnabled)
  const [weatherEnabled, setWeatherEnabled] = useState(projectMapConfig.weatherEnabled)
  const [markersVisible, setMarkersVisible] = useState(projectMapConfig.markersVisible)
  const [modelVisible, setModelVisible] = useState(projectMapConfig.modelVisible)
  const [modelSaveState, setModelSaveState] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [modelAvailable, setModelAvailable] = useState(false)
  const [modelError, setModelError] = useState('')
  const selected = mapStations.find((station) => station.id === selectedId) || mapStations[0]
  const pbrReadyRef = useRef(false)
  const pbrOptionsRef = useRef(null)
  pbrOptionsRef.current = { config: modelConfig, visible: modelVisible, preset: lightPreset, azimuth: sunAzimuth, elevation: sunElevation, active }

  const modelStation = mapStations.find((station) => station.id === modelStationId) || mapStations[0]

  useEffect(() => {
    if (!active || !mapReady || mapError || !markersVisible) return
    const map = mapRef.current
    let cancelled = false
    let detach
    import('./stationGlass').then(({ attachStationGlass }) => {
      if (!cancelled && map === mapRef.current) detach = attachStationGlass(map, panelRef.current, () => glassConfigRef.current)
    }).catch(error => console.warn('Station glass initialization failed; using native glass.', error))
    return () => { cancelled = true; detach?.() }
  }, [active, mapReady, mapError, markersVisible, mapStyle, mapStations])

  useEffect(() => { mapRef.current?.triggerRepaint() }, [glassConfig])

  const [materialColors, setMaterialColors] = useState(projectMapConfig.materialColors)
  const persistentConfig = useMemo(() => ({ modelConfig: { ...modelConfig, stationId: modelStationId }, savedCamera, flat, lightPreset, sunAzimuth, sunElevation, sunPositionCustom, glassConfig, terrainEnabled, weatherEnabled, markersVisible, modelVisible, materialColors }), [modelConfig, modelStationId, savedCamera, flat, lightPreset, sunAzimuth, sunElevation, sunPositionCustom, glassConfig, terrainEnabled, weatherEnabled, markersVisible, modelVisible, materialColors])
  const lastConfig = useRef(JSON.stringify(persistentConfig))
  const persist = useCallback(async () => {
    setModelSaveState('saving')
    try { await saveMapConfig(persistentConfig); setModelSaveState('saved') }
    catch { setModelSaveState('error'); throw new Error('项目参数写入失败，请重试') }
  }, [persistentConfig])
  useEffect(() => {
    const serialized = JSON.stringify(persistentConfig)
    if (lastConfig.current === serialized) return
    lastConfig.current = serialized
    persist().catch(() => {})
  }, [persistentConfig, persist])

  useEffect(() => {
    if (!mapStations.some((station) => station.id === modelStationId)) setModelStationId(mapStations[0]?.id)
  }, [mapStations, modelStationId])

  const stationFeatures = useMemo(() => ({
    type: 'FeatureCollection',
    features: mapStations.map((station) => ({
      type: 'Feature',
      properties: { id: station.id, color: getStationColor(station) },
      geometry: { type: 'Point', coordinates: station.mapCoordinates },
    })),
  }), [mapStations])

  const stationModelFeatures = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: mapStations.map((station) => ({
        type: 'Feature',
        properties: { id: station.id },
        geometry: { type: 'Point', coordinates: station.mapCoordinates },
      })),
    }
  }, [mapStations])

  const corridor = useMemo(() => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: CORRIDOR_ORDER
        .map((id) => mapStations.find((station) => station.id === id)?.mapCoordinates)
        .filter(Boolean),
    },
  }), [mapStations])

  const syncMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const canvas = map.getCanvas()
    mapStations.forEach((station) => {
      const node = markerRefs.current.get(station.id)
      if (!node) return
      // Models use sea-level elevation; map.project adds terrain elevation itself.
      const terrainHeight = map.queryTerrainElevation(station.mapCoordinates) ?? 0
      const point = map.project(station.mapCoordinates, getStationModelTopHeight(modelConfigRef.current, station.id) - terrainHeight)
      const visible = point.x > -180 && point.y > -90 && point.x < canvas.clientWidth + 180 && point.y < canvas.clientHeight + 90
      // Reserve the expanded width; the card grows upward from the model top.
      const x = Math.max(188, Math.min(canvas.clientWidth - 188, point.x))
      const y = point.y
      node.style.transform = `translate3d(${x}px, ${y}px, 0)`
      node.style.opacity = visible ? '1' : '0'
      node.style.pointerEvents = visible ? 'auto' : 'none'
    })
  }, [mapStations])

  useLayoutEffect(() => {
    setMapReady(false)
    setModelAvailable(false)
    setModelError('')
    officialSunLightsRef.current = null
    customSunLightsRef.current = false
    let disposed = false
    let map
    let loaded = false
    let loadTimeout
    let contextLostHandler

    const fail = (message) => {
      if (disposed) return
      window.clearTimeout(loadTimeout)
      setMapError(message)
      setMapReady(false)
    }

    async function initializeMap() {
      if (!MAPBOX_TOKEN) {
        fail('缺少 Mapbox Public Token')
        return
      }
      try {
        const [{ default: mapboxgl }, { createStationPbrLayer }] = await Promise.all([
          import('mapbox-gl'), import('./stationPbrLayer'),
        ])
        if (disposed || !mapContainerRef.current) return
        if (!mapboxgl.supported()) {
          fail('当前浏览器不支持 WebGL 地图')
          return
        }

        mapboxgl.accessToken = MAPBOX_TOKEN
        const initialLightPreset = lightPresetRef.current
        const initialAppearance = getMapAppearance(initialLightPreset)
        map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: mapStyle,
          ...savedCamera,
          antialias: true,
          attributionControl: false,
          maxPitch: 80,
          minZoom: 5.5,
          maxZoom: 15,
          config: {
            basemap: {
              ...(theme === 'light' ? { lightPreset: initialLightPreset } : {
              lightPreset: initialLightPreset,
              theme: 'monochrome',
              show3dObjects: true,
              showPointOfInterestLabels: false,
              showTransitLabels: false,
              showPedestrianRoads: false,
              showRoadLabels: false,
              showPlaceLabels: true,
              ...initialAppearance.colors,
              }),
              ...(RECORDING_MODE ? {
                showRoadLabels: false,
                showPlaceLabels: false,
                showPointOfInterestLabels: false,
                showTransitLabels: false,
              } : {}),
            },
          },
        })
        pbrReadyRef.current = false
        mapRef.current = map
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
        map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')

        contextLostHandler = () => fail('WebGL 上下文已丢失')
        map.getCanvas().addEventListener('webglcontextlost', contextLostHandler, { once: true })
        map.on('style.load', () => {
          if (disposed) return
          try {
            if (theme === 'light' && !officialSunLightsRef.current) {
              const lights = map.getLights?.() || []
              if (lights.some((light) => light.type === 'directional')) {
                officialSunLightsRef.current = cloneLights(lights)
              }
            }
            if (RECORDING_MODE) {
              map.getStyle().layers.filter((layer) => layer.type === 'symbol').forEach((layer) => {
                map.setLayoutProperty(layer.id, 'visibility', 'none')
              })
            }
            if (theme === 'dark') {
              if (!map.getSource(TERRAIN_SOURCE_ID)) {
                map.addSource(TERRAIN_SOURCE_ID, {
                  type: 'raster-dem',
                  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                  tileSize: 512,
                  maxzoom: 14,
                })
              }
              map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION })
              map.setFog({
                ...initialAppearance.fog,
                'star-intensity': initialLightPreset === 'night' ? 0.08 : initialLightPreset === 'dusk' ? 0.02 : 0,
              })
            }
            const modelAdded = addOperationalLayers(
              map,
              stationFeatures,
              corridor,
              stationModelFeatures,
              theme === 'light' ? '/models/station_light.glb' : STATION_MODEL_URL,
            )
            if (modelAdded) map.addLayer(createStationPbrLayer({
              mapboxgl,
              theme,
              features: stationModelFeatures.features,
              url: theme === 'light' ? '/models/station_light.glb' : STATION_MODEL_URL,
              getOptions: () => pbrOptionsRef.current,
              onReady: () => { pbrReadyRef.current = true },
              onError: () => setModelError('增强材质加载失败，已保留基础模型'),
            }))
            setModelAvailable(modelAdded)
            if (!modelAdded) setModelError('电站模型图层加载失败')
            applyWeather(map, theme === 'dark')
          } catch {
            fail('地图地形图层加载失败，已切换降级视图')
          }
        })
        map.on('move', syncMarkers)
        map.on('resize', syncMarkers)
        // After the first shadow pass, replace its allocations once with 4K cascades.
        map.once('load', () => {
          if (!disposed) upgradeModelShadows(map, mapboxgl.version)
        })
        map.on('load', () => {
          if (disposed) return
          loaded = true
          window.clearTimeout(loadTimeout)
          setMapReady(true)
          setMapError('')
          syncMarkers()
        })
        map.on('error', (event) => {
          const message = event?.error?.message || ''
          if (!loaded && /401|403|access token|style/i.test(message)) fail('Mapbox 鉴权或地图样式加载失败')
          if (loaded && /ops-station-model|station(?:_light)?\.glb/i.test(message)) {
            setModelAvailable(false)
            setModelError('电站模型加载失败')
          }
        })
        loadTimeout = window.setTimeout(() => {
          if (!loaded) fail('3D 地图加载超时')
        }, 18000)
      } catch {
        fail('3D 地图初始化失败')
      }
    }

    initializeMap()
    return () => {
      disposed = true
      window.clearTimeout(loadTimeout)
      if (map) {
        map.off('move', syncMarkers)
        map.off('resize', syncMarkers)
        if (contextLostHandler) map.getCanvas().removeEventListener('webglcontextlost', contextLostHandler)
        map.remove()
      }
      if (mapRef.current === map) {
        mapRef.current = null
        officialSunLightsRef.current = null
        customSunLightsRef.current = false
      }
    }
  }, [corridor, mapStyle, stationFeatures, stationModelFeatures, syncMarkers])


  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    try {
      const appearance = getMapAppearance(lightPreset)
      if (theme === 'light') map.setFog({ ...appearance.fog, range: [3, 15], color: lightPreset === 'night' ? '#17252c' : '#e6eff5', 'horizon-blend': 0.08, 'star-intensity': 0 })
      const sunByPreset = SUN_LIGHT_BY_PRESET[lightPreset] || SUN_LIGHT_BY_PRESET.day
      try { map.setConfigProperty?.('basemap', 'lightPreset', lightPreset) } catch { /* style may not expose basemap config */ }
      if (theme === 'light' && lightPreset === 'day' && !sunPositionCustom && !customSunLightsRef.current) {
        const lights = map.getLights?.() || []
        if (lights.some((light) => light.type === 'directional')) officialSunLightsRef.current = cloneLights(lights)
      }
      if (theme === 'dark') {
        const direction = sunPositionCustom && lightPreset === 'day'
          ? [sunAzimuth, 90 - sunElevation]
          : sunByPreset.direction
        map.setLights?.([{ id: 'ops-ambient', type: 'ambient', properties: { color: '#ffffff', intensity: lightPreset === 'night' ? 0.18 : 0.35 } }, { id: 'ops-sun', type: 'directional', properties: { ...sunByPreset, direction, 'cast-shadows': true, 'shadow-intensity': 0.85, 'shadow-quality': 1 } }])
        Object.entries(appearance.colors).forEach(([property, value]) => {
          map.setConfigProperty?.('basemap', property, value)
        })
        map.setFog({
          ...appearance.fog,
          'star-intensity': lightPreset === 'night' ? 0.08 : lightPreset === 'dusk' ? 0.02 : 0,
        })
      } else if (lightPreset === 'day') {
        const lights = officialSunLightsRef.current || cloneLights(map.getLights?.())
        if (lights.some((light) => light.type === 'directional')) {
          if (!officialSunLightsRef.current) officialSunLightsRef.current = lights
          map.setLights(cloneLights(lights).map((light) => light.type === 'directional'
            ? {
              ...light,
              properties: { ...light.properties, direction: [sunAzimuth, 90 - sunElevation], intensity: 1, 'cast-shadows': true, 'shadow-intensity': 1 },
            }
            : light))
          customSunLightsRef.current = true
        }
      } else if (customSunLightsRef.current) {
        if (officialSunLightsRef.current) map.setLights?.(cloneLights(officialSunLightsRef.current))
        customSunLightsRef.current = false
      }
    } catch {
      // Keep the loaded map usable when a style preset is unavailable.
    }
  }, [lightPreset, mapReady, sunAzimuth, sunElevation, sunPositionCustom, theme])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    applyWeather(map, weatherEnabled)
  }, [mapReady, weatherEnabled])

  useEffect(() => {
    const map = mapRef.current
    const terrain = theme === 'light' ? OUTDOORS_TERRAIN : { source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION }
    if (!mapReady || !map || !map.getSource(terrain.source)) return
    try {
      map.setTerrain(!flat && terrainEnabled ? terrain : null)
      map.easeTo({ pitch: flat ? 0 : savedCamera.pitch, bearing: flat ? 0 : savedCamera.bearing, duration: 720, essential: true })
    } catch {
      // A terrain toggle failure should not blank an otherwise usable map.
    }
  }, [flat, mapReady, terrainEnabled, theme])

  // Run after the 2D/3D effect so it cannot overwrite the saved camera.
  useEffect(() => {
    if (!cameraRequest || !mapReady || !mapRef.current) return
    mapRef.current.easeTo({
      ...cameraRequest,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900,
    })
    setCameraRequest(null)
  }, [cameraRequest, flat, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    const visibility = terrainEnabled ? 'visible' : 'none'
    if (map.getLayer('ops-corridor-glow')) map.setLayoutProperty('ops-corridor-glow', 'visibility', visibility)
    if (map.getLayer('ops-corridor-line')) map.setLayoutProperty('ops-corridor-line', 'visibility', visibility)
  }, [mapReady, terrainEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !map.getLayer(STATION_MODEL_LAYER_ID)) return
    try {
      map.setLayoutProperty(STATION_MODEL_LAYER_ID, 'visibility', modelVisible ? 'visible' : 'none')
    } catch {
      // Keep the map usable if a style implementation does not expose model visibility.
    }
  }, [mapReady, modelVisible])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !map.getLayer(STATION_MODEL_LAYER_ID)) return
    try {
      const scale = [modelConfig.scale, modelConfig.scale, modelConfig.scale]
      map.setPaintProperty(STATION_MODEL_LAYER_ID, 'model-scale', scale)
      map.setPaintProperty(STATION_MODEL_LAYER_ID, 'model-rotation', getModelRotationExpression(modelConfig.rotation))
      map.setPaintProperty(
        STATION_MODEL_LAYER_ID,
        'model-translation',
        getModelTranslationExpression(modelConfig, mapStations.map((station) => station.id)),
      )
      map.setPaintProperty(STATION_MODEL_LAYER_ID, 'model-emissive-strength', normalizeModelEmission(modelConfig.emissive))
      syncMarkers()
    } catch {
      setModelError('电站模型参数应用失败')
    }
  }, [mapReady, mapStations, modelConfig, syncMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!active || !mapReady || !map || !modelAvailable || !modelVisible) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const stationIds = mapStations.map((station) => station.id)
    let animationFrameId
    const frame = (timestamp) => {
      if (pbrReadyRef.current) return
      if (map.getSource(STATION_MODEL_SOURCE_ID)) {
        const angle = -((timestamp % STATION_MODEL_BLADE_PERIOD_MS) / STATION_MODEL_BLADE_PERIOD_MS) * 360
        setStationBladeRotation(map, stationIds, angle)
      }
      animationFrameId = window.requestAnimationFrame(frame)
    }
    animationFrameId = window.requestAnimationFrame(frame)
    return () => window.cancelAnimationFrame(animationFrameId)
  }, [active, mapReady, mapStations, modelAvailable, modelVisible])

  useEffect(() => {
    if (!pageFullscreen) return undefined
    if (!active) {
      setPageFullscreen(false)
      return undefined
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPageFullscreen(false)
      if (event.key !== 'Tab') return
      const controls = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')]
        .filter((node) => node.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [pageFullscreen, active])

  useEffect(() => {
    if (!active || !mapReady) return undefined
    const frame = window.requestAnimationFrame(() => {
      mapRef.current?.resize()
      syncMarkers()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [active, mapReady, syncMarkers, pageFullscreen])

  const selectStation = useCallback((station) => {
    setSelectedId(station.id)
    setModelStationId(station.id)
    const map = mapRef.current
    if (mapReady && map) {
      map.easeTo({ center: station.mapCoordinates, zoom: Math.max(map.getZoom(), 8.15), duration: 720, essential: true })
    }
  }, [mapReady])

  const resetView = () => {
    const resetStationId = mapStations.find((station) => station.id === 'kela')?.id || mapStations[0]?.id
    setSelectedId(resetStationId)
    setModelStationId(resetStationId)
    mapRef.current?.easeTo({ ...savedCamera, pitch: flat ? 0 : savedCamera.pitch, bearing: flat ? 0 : savedCamera.bearing, duration: 900, essential: true })
  }

  const focusSelected = () => {
    if (!selected) return
    mapRef.current?.flyTo({ center: selected.mapCoordinates, zoom: 10.2, pitch: flat ? 0 : 66, bearing: flat ? 0 : -24, speed: 0.8, curve: 1.3, essential: true })
  }

  const updateModelConfig = (property, value) => {
    setModelConfig((current) => ({ ...current, [property]: property === 'emissive' ? normalizeModelEmission(value) : Number(value) }))
    setModelSaveState('')
  }

  const updateSunAzimuth = (value) => {
    setSunAzimuth(Number(value))
    setSunPositionCustom(true)
  }

  const updateSunElevation = (value) => {
    setSunElevation(clampModelParameter(value, 0, 90, OUTDOORS_DAY_ELEVATION))
    setSunPositionCustom(true)
  }

  const resetSunPosition = () => {
    setSunAzimuth(theme === 'light' ? OUTDOORS_DAY_AZIMUTH : SUN_LIGHT_BY_PRESET[lightPreset].direction[0])
    setSunElevation(theme === 'light' ? OUTDOORS_DAY_ELEVATION : 90 - SUN_LIGHT_BY_PRESET[lightPreset].direction[1])
    setSunPositionCustom(false)
  }

  const updateStationElevation = (value) => {
    if (!modelStation) return
    const elevation = clampModelParameter(value, MODEL_ELEVATION_MIN, MODEL_ELEVATION_MAX, DEFAULT_STATION_MODEL_CONFIG.elevation)
    setModelConfig((current) => ({
      ...current,
      stationElevations: { ...current.stationElevations, [modelStation.id]: elevation },
    }))
    setModelSaveState('')
  }

  const saveModelConfig = () => { persist().catch(() => {}) }

  if (!selected) return null

  return (
    <section ref={panelRef} style={glassCssVariables(glassConfig)} className={`digital-twin${pageFullscreen ? ' is-page-fullscreen' : ''}`} aria-label="雅砻江流域电站数字孪生">
      {RECORDING_MODE ? <style>{`
        .digital-twin .map-legend,
        .digital-twin .mapboxgl-ctrl-scale { display: none !important; }
      `}</style> : null}
      <span role="status" style={{ position: 'absolute', right: 16, bottom: 4, zIndex: 10 }}>{modelSaveState === 'error' ? '项目参数保存失败，请打开材质面板重试' : modelSaveState === 'saving' ? '正在保存地图参数…' : ''}</span>
      <header className="scene-toolbar">
        <div>
          <span className="section-kicker">BASIN DIGITAL TWIN · MAPBOX 3D</span>
          <h2>数字孪生 <b>· 雅砻江</b></h2>
        </div>
        <div className="scene-summary">
          <span><i className="legend-dot normal" />{mapError ? '降级视图' : mapReady ? '真实地形' : '载入地形'}</span>
          <span><i className="legend-dot warning" />在办缺陷 3</span>
        </div>
        <div className="scene-tools">
          <div className="map-mode-switch" aria-label="地图视图">
            <button className={!flat ? 'is-active' : ''} type="button" onClick={() => setFlat(false)}>3D</button>
            <button className={flat ? 'is-active' : ''} type="button" onClick={() => setFlat(true)}>平面</button>
          </div>
          <button className={camerasOpen ? 'is-active' : ''} type="button" title="镜头列表" aria-label="镜头列表" aria-expanded={camerasOpen} aria-haspopup="dialog" onClick={() => { setGlassSettingsOpen(false); setLayersOpen(false); setModelSettingsOpen(false); setCamerasOpen((value) => !value) }}><Camera size={16} /></button>
          <button className={layersOpen ? 'is-active' : ''} type="button" title="图层与光照" aria-label="图层与光照" aria-expanded={layersOpen} aria-haspopup="dialog" onClick={() => { setGlassSettingsOpen(false); setCamerasOpen(false); setModelSettingsOpen(false); setLayersOpen((value) => !value) }}><Layers3 size={16} /></button>
          <button className={`glass-entry${glassSettingsOpen ? ' is-active' : ''}`} type="button" title="卡片玻璃材质" aria-label="卡片玻璃材质" aria-expanded={glassSettingsOpen} aria-haspopup="dialog" aria-controls="station-glass-settings" onClick={() => { setCamerasOpen(false); setLayersOpen(false); setModelSettingsOpen(false); setGlassSettingsOpen(value => !value) }}>玻璃</button>
          <button className={modelSettingsOpen ? 'is-active material-entry' : 'material-entry'} type="button" title="编辑设备材质" aria-label="编辑设备材质" aria-pressed={modelSettingsOpen} onClick={() => { setGlassSettingsOpen(false); setCamerasOpen(false); setLayersOpen(false); setModelSettingsOpen((value) => !value) }}><SlidersHorizontal size={15} /><span>材质</span></button>
          <button type="button" title="定位选中电站" onClick={focusSelected} disabled={!mapReady}><LocateFixed size={16} /></button>
          <button type="button" title="复位视角" onClick={resetView} disabled={!mapReady}><RotateCcw size={16} /></button>
          <button type="button" title={pageFullscreen ? '退出网页全屏（Esc）' : '地图网页全屏'} aria-label={pageFullscreen ? '退出网页全屏' : '地图网页全屏'} aria-pressed={pageFullscreen} onClick={() => setPageFullscreen((value) => !value)}>{pageFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        </div>
      </header>

      <div className={`twin-canvas mapbox-twin-canvas ${flat ? 'is-flat' : ''}`}>
        <StaticFallback stations={mapStations} interactive={Boolean(mapError)} onSelect={selectStation} onEnter={(station) => navigate(`/station/${station.id}`)} />
        <div ref={mapContainerRef} className={`mapbox-canvas ${mapReady && !mapError ? 'is-ready' : ''}`} aria-label="雅砻江流域三维地形地图" />

        <div className={`map-station-layer ${mapError ? 'is-hidden' : ''} ${markersVisible ? '' : 'is-hidden'}`}>
              {mapStations.map((station) => (
                <div
                  className="map-station-anchor"
                  key={station.id}
                  ref={(node) => {
                    if (node) markerRefs.current.set(station.id, node)
                    else markerRefs.current.delete(station.id)
                  }}
                >
                  <StationDetail station={station} onSelect={() => selectStation(station)} onEnter={() => navigate(`/station/${station.id}`)} />
                </div>
              ))}
        </div>

        {camerasOpen ? (
          <div className="map-layer-menu" role="dialog" aria-label="已保存镜头" style={{ left: 'auto', right: 16, top: 80 }} onKeyDown={(event) => { if (event.key === 'Escape') { setCamerasOpen(false); panelRef.current?.querySelector('[aria-label="镜头列表"]')?.focus() } }}>
            <span>镜头列表</span>
            {CAMERA_PRESETS.concat(savedCamera ? [{ name: '镜头03', camera: savedCamera }] : []).map(({ name, camera }) => (
              <button key={name} type="button" disabled={!mapReady} onClick={() => { setFlat(camera.pitch === 0); setCameraRequest(camera); setCamerasOpen(false); panelRef.current?.querySelector('[aria-label="镜头列表"]')?.focus() }}>
                <span>{name}</span><Camera size={16} aria-hidden="true" />
              </button>
            ))}
            <button type="button" disabled={!mapReady} onClick={() => { const map = mapRef.current; if (map) { const c = map.getCenter(); setSavedCamera({ center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() }) } }}><span>保存当前机位到镜头03</span><FloppyDisk size={16} /></button>
          </div>
        ) : null}

        {layersOpen ? (
          <div className="map-layer-menu" role="dialog" aria-label="图层与光照" onKeyDown={(event) => { if (event.key === 'Escape') { setLayersOpen(false); panelRef.current?.querySelector('[aria-label="图层与光照"]')?.focus() } }}>
            <span>光照时段</span>
            {LIGHT_PRESETS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={lightPreset === value} onClick={() => { setLightPreset(value); setSunAzimuth(theme === 'light' ? OUTDOORS_DAY_AZIMUTH : SUN_LIGHT_BY_PRESET[value].direction[0]); setSunElevation(theme === 'light' ? OUTDOORS_DAY_ELEVATION : 90 - SUN_LIGHT_BY_PRESET[value].direction[1]); setSunPositionCustom(false) }} disabled={!mapReady}>
                <span>{label}</span><i>{lightPreset === value ? <Check size={12} /> : null}</i>
              </button>
            ))}
            <span>太阳方向</span>
            <label className="map-model-field">
              <span>方位角 <output>{sunAzimuth}°</output></span>
              <input type="range" min="0" max="360" step="1" value={sunAzimuth} aria-label="太阳方位角" disabled={!mapReady || lightPreset !== 'day'} onChange={(event) => updateSunAzimuth(event.target.value)} />
            </label>
            <label className="map-model-field">
              <span>太阳高度角 <output>{sunElevation}°</output></span>
              <input type="range" min="0" max="90" step="1" value={sunElevation} aria-label="太阳高度角" disabled={!mapReady || lightPreset !== 'day'} onChange={(event) => updateSunElevation(event.target.value)} />
            </label>
            <button type="button" className="map-light-reset" disabled={!mapReady || !sunPositionCustom} onClick={resetSunPosition}>
              <span>恢复官方太阳位置</span><RotateCcw size={14} aria-hidden="true" />
            </button>
            <span>显示图层</span>
            <button type="button" role="switch" aria-checked={terrainEnabled} onClick={() => setTerrainEnabled((value) => !value)}><span>三维地形与流域链路</span><i>{terrainEnabled ? <Check size={12} /> : null}</i></button>
            <button type="button" role="switch" aria-checked={weatherEnabled} onClick={() => setWeatherEnabled((value) => !value)}><span>高海拔气象粒子</span><i>{weatherEnabled ? <Check size={12} /> : null}</i></button>
            <button type="button" role="switch" aria-checked={markersVisible} onClick={() => setMarkersVisible((value) => !value)}><span>电站状态标记</span><i>{markersVisible ? <Check size={12} /> : null}</i></button>
            <button type="button" role="switch" aria-checked={modelVisible} disabled={!modelAvailable} onClick={() => setModelVisible((value) => !value)}><span>电站三维模型{modelError ? ' · 不可用' : ''}</span><i>{modelVisible && modelAvailable ? <Check size={12} /> : null}</i></button>
          </div>
        ) : null}

        {glassSettingsOpen ? <StationGlassSettings config={glassConfig} onSave={persist} onChange={setGlassConfig} onClose={() => { setGlassSettingsOpen(false); panelRef.current?.querySelector('[aria-label="卡片玻璃材质"]')?.focus() }} /> : null}

        {modelSettingsOpen ? (
          <form className="map-model-settings" aria-label="电站模型参数" onSubmit={(event) => { event.preventDefault(); saveModelConfig() }}>
            <header>
              <span><strong>模型参数</strong><small>即时预览 · 四个电站</small></span>
              <button type="button" title="关闭模型参数" aria-label="关闭模型参数" onClick={() => setModelSettingsOpen(false)}><X size={15} /></button>
            </header>
            <div className="material-groups">{['底座','风车','储能','光伏板'].map((name) => <label key={name}><span>{name}</span><input type="color" value={materialColors[name]} onChange={event => setMaterialColors(current => ({ ...current, [name]: event.target.value }))} aria-label={`${name}材质颜色`} /><small>独立材质</small></label>)}</div>
            <label className="map-model-field">
              <span>调整电站</span>
              <select value={modelStation?.id || ''} aria-label="选择要调整高度的电站" onChange={(event) => setModelStationId(event.target.value)}>
                {mapStations.map((station) => <option key={station.id} value={station.id}>{station.shortName || station.name}</option>)}
              </select>
            </label>
            <label className="map-model-field">
              <span>显示比例 <output>{Math.round(modelConfig.scale).toLocaleString()}</output></span>
              <input type="range" min={MODEL_SCALE_MIN} max={MODEL_SCALE_MAX} step="50" value={modelConfig.scale} aria-label="模型显示比例" onChange={(event) => updateModelConfig('scale', event.target.value)} />
            </label>
            <label className="map-model-field">
              <span>水平朝向 <output>{modelConfig.rotation}°</output></span>
              <input type="range" min="-180" max="180" step="1" value={modelConfig.rotation} aria-label="模型水平朝向" onChange={(event) => updateModelConfig('rotation', event.target.value)} />
            </label>
            <label className="map-model-field">
              <span>离地高度 <output>{Math.round(getStationElevation(modelConfig, modelStation?.id)).toLocaleString()} m</output></span>
              <input type="range" min={MODEL_ELEVATION_MIN} max={MODEL_ELEVATION_MAX} step="100" value={getStationElevation(modelConfig, modelStation?.id)} aria-label="模型离地高度" onChange={(event) => updateStationElevation(event.target.value)} />
            </label>
            <label className="map-model-field">
              <span>自发光强度 <output>{normalizeModelEmission(modelConfig.emissive).toFixed(2)}</output></span>
              <input type="range" min="0" max="0.8" step="0.01" value={normalizeModelEmission(modelConfig.emissive)} aria-label="模型自发光强度" onChange={(event) => updateModelConfig('emissive', event.target.value)} />
            </label>
            <footer>
              <span role="status" aria-live="polite">{modelSaveState === 'saved' ? '已写入项目' : modelSaveState === 'error' ? '项目保存失败，请重试' : modelSaveState === 'saving' ? '正在写入项目…' : '调整后自动写入项目'}</span>
              <button type="submit"><FloppyDisk size={14} />保存参数</button>
            </footer>
          </form>
        ) : null}

        {!mapReady && !mapError ? <div className="map-loading-state"><span /><strong>正在建立 3D 地形</strong><small>加载 Mapbox Standard 与高程数据</small></div> : null}
        {mapError ? <div className="map-fallback-notice"><TriangleAlert size={14} /><span><strong>3D 地图暂不可用</strong><small>{mapError}，场站交互仍可使用</small></span></div> : null}
        <div className="map-legend"><span><i className="normal" />正常</span><span><i className="warning" />预警</span><span><i className="urgent" />严重告警</span></div>
      </div>
    </section>
  )
}
