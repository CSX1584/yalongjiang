import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BatteryCharging,
  Camera,
  Check,
  CaretRight as ChevronRight,
  Stack as Layers3,
  Crosshair as LocateFixed,
  ArrowsOut as Maximize2,
  ArrowCounterClockwise as RotateCcw,
  CloudFog,
  Sun,
  Warning as TriangleAlert,
  Wind,
} from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import 'mapbox-gl/dist/mapbox-gl.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { stations as fallbackStations } from '../data/demoData'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()
const MAP_MODE = import.meta.env.VITE_MAP_MODE?.trim().toLowerCase() || 'auto'
const OFFLINE_BASEMAP_URL = './offline-map/yalongjiang.pmtiles'
const OFFLINE_TERRAIN_URL = './offline-map/yalongjiang-terrain.pmtiles'
const DEFAULT_OFFLINE_MANIFEST = {
  style: './offline-map/style.json',
  basemap: OFFLINE_BASEMAP_URL,
  terrain: OFFLINE_TERRAIN_URL,
  bounds: [100, 27, 102.1, 30.6],
  maxZoom: 12,
  terrainMaxZoom: 8,
  terrainTileSize: 512,
  terrainEncoding: 'terrarium',
}
const DEFAULT_CAMERA = {
  center: [101.487116, 27.566619],
  zoom: 12.92,
  pitch: 85,
  bearing: 0,
}
const TERRAIN_SOURCE_ID = 'ops-terrain-dem'
const TERRAIN_HILLSHADE_SOURCE_ID = 'ops-terrain-hillshade-dem'
const TERRAIN_HILLSHADE_LAYER_ID = 'ops-terrain-hillshade'
const TERRAIN_EXAGGERATION = 1.2
const TERRAIN_ATTRIBUTION = '<a href="https://mapterhorn.com/attribution" target="_blank">© Mapterhorn</a>'
const HIGH_PITCH_TRANSITION_THRESHOLD = 70
// MapLibre's native terrain-aware atmosphere fades in between 60° and 70° pitch.
const OFFLINE_ATMOSPHERE = {
  'sky-color': '#0a1a24',
  'horizon-color': '#272e30',
  'fog-color': '#1d2325',
  // Keep the foreground clear and move the native fog blend toward the horizon.
  'fog-ground-blend': 0.8,
  'horizon-fog-blend': 0.9,
  'sky-horizon-blend': 0.8,
  'atmosphere-blend': 0,
}
const DEFAULT_FOG_OVERLAY_OPACITY = 0.92
const STATION_COORDINATES = {
  kela: [101.0156, 30.0299],
  zhalashan: [101.672, 28.142],
  lianghekou: [100.391, 30.214],
  labashan: [101.508, 27.518],
}
const CORRIDOR_ORDER = ['labashan', 'zhalashan', 'kela', 'lianghekou']
const FALLBACK_POSITIONS = {
  lianghekou: { left: '25%', top: '32%' },
  kela: { left: '50%', top: '25%' },
  zhalashan: { left: '67%', top: '54%' },
  labashan: { left: '79%', top: '66%' },
}
const LIGHT_PRESETS = [
  ['dawn', '晨曦'],
  ['day', '白昼'],
  ['dusk', '黄昏'],
  ['night', '夜景'],
]
const CAMERA_PARAMETER_FIELDS = [
  { name: 'longitude', label: '中心经度', unit: '°E', min: 100, max: 102.1, step: '0.000001' },
  { name: 'latitude', label: '中心纬度', unit: '°N', min: 27, max: 30.6, step: '0.000001' },
  { name: 'zoom', label: '缩放级别', unit: '级', min: 5.5, max: 15, step: '0.01' },
  { name: 'pitch', label: '俯仰角', unit: '°', min: 0, max: 85, step: '0.1' },
  { name: 'bearing', label: '方位角', unit: '°', min: -180, max: 180, step: '0.1' },
]
const ATMOSPHERE_PARAMETER_FIELDS = [
  { name: 'fogOpacity', label: '雾气浓度', detail: '越大 = 覆盖越明显', min: 0, max: 1, step: '0.01' },
  { name: 'fogGroundBlend', label: '地表雾起点', detail: '越大 = 雾越靠远处', min: 0.05, max: 1, step: '0.01' },
  { name: 'horizonFogBlend', label: '远景融入天际', detail: '更小 = 远山更快融入天际', min: 0.05, max: 0.95, step: '0.01' },
  { name: 'skyHorizonBlend', label: '天际过渡', detail: '天空与地平线过渡宽度', min: 0, max: 1, step: '0.01' },
]
let offlineProtocolState = null

class WholeFilePmtilesSource {
  constructor(url) {
    this.url = url
    this.filePromise = null
  }

  getKey() {
    return this.url
  }

  async getBytes(offset, length) {
    if (!this.filePromise) {
      this.filePromise = fetch(this.url).then(async (response) => {
        if (response.status >= 400) throw new Error(`offline map ${response.status}`)
        const data = await response.arrayBuffer()
        if (!data.byteLength) throw new Error('offline map file is empty')
        return data
      })
    }

    const data = await this.filePromise
    const end = offset + length
    if (offset < 0 || length < 0 || end > data.byteLength) {
      throw new Error(`offline map byte range ${offset}-${end - 1} is unavailable`)
    }
    return { data: data.slice(offset, end) }
  }
}

function toPmtilesUrl(assetUrl) {
  const url = String(assetUrl || '').trim()
  return url.startsWith('pmtiles://') ? url : `pmtiles://${url}`
}

function createOfflineTerrainSource(manifest) {
  return {
    type: 'raster-dem',
    url: toPmtilesUrl(manifest.terrain || OFFLINE_TERRAIN_URL),
    tileSize: Number(manifest.terrainTileSize) || 512,
    maxzoom: Number(manifest.terrainMaxZoom) || 8,
    bounds: manifest.bounds || DEFAULT_OFFLINE_MANIFEST.bounds,
    encoding: manifest.terrainEncoding || 'terrarium',
    attribution: TERRAIN_ATTRIBUTION,
  }
}

function acquireOfflineProtocol(maplibregl, Protocol, PMTiles, archiveUrls) {
  if (!offlineProtocolState) {
    const protocol = new Protocol()
    const packagedFile = window.location.protocol === 'file:'
    const createArchive = (url) => new PMTiles(packagedFile ? new WholeFilePmtilesSource(url) : url)

    maplibregl.addProtocol('pmtiles', protocol.tile)
    offlineProtocolState = { maplibregl, protocol, createArchive, references: 0 }
  }

  archiveUrls.forEach((url) => {
    if (url && !offlineProtocolState.protocol.get(url)) {
      offlineProtocolState.protocol.add(offlineProtocolState.createArchive(url))
    }
  })

  offlineProtocolState.references += 1
  return offlineProtocolState.protocol
}

function releaseOfflineProtocol(protocol) {
  if (!offlineProtocolState || offlineProtocolState.protocol !== protocol) return
  offlineProtocolState.references -= 1
  if (offlineProtocolState.references > 0) return

  offlineProtocolState.maplibregl.removeProtocol('pmtiles')
  offlineProtocolState = null
}

function getCameraSnapshot(map, terrainElevationScale = 1) {
  const center = map.getCenter()
  const camera = {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
  }
  const elevation = map.queryTerrainElevation?.(center, { exaggerated: false })
  if (Number.isFinite(elevation)) camera.elevation = elevation / terrainElevationScale
  return camera
}

function formatCameraNumber(value, fallback, digits) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : Number(fallback).toFixed(digits)
}

function createCameraDraft(camera = DEFAULT_CAMERA) {
  const center = Array.isArray(camera?.center) ? camera.center : DEFAULT_CAMERA.center
  return {
    longitude: formatCameraNumber(center[0], DEFAULT_CAMERA.center[0], 6),
    latitude: formatCameraNumber(center[1], DEFAULT_CAMERA.center[1], 6),
    zoom: formatCameraNumber(camera?.zoom, DEFAULT_CAMERA.zoom, 2),
    pitch: formatCameraNumber(camera?.pitch, DEFAULT_CAMERA.pitch, 1),
    bearing: formatCameraNumber(camera?.bearing, DEFAULT_CAMERA.bearing, 1),
  }
}

function parseCameraDraft(draft) {
  const values = Object.fromEntries(CAMERA_PARAMETER_FIELDS.map(({ name }) => [name, Number(draft[name])]))
  const invalidField = CAMERA_PARAMETER_FIELDS.find(({ name }) => !Number.isFinite(values[name]))
  if (invalidField) return { error: `请填写有效的${invalidField.label}` }

  const outOfRangeField = CAMERA_PARAMETER_FIELDS.find(({ name, min, max }) => values[name] < min || values[name] > max)
  if (outOfRangeField) return { error: `${outOfRangeField.label}范围为 ${outOfRangeField.min}–${outOfRangeField.max}` }

  return {
    camera: {
      center: [values.longitude, values.latitude],
      zoom: values.zoom,
      pitch: values.pitch,
      bearing: values.bearing,
    },
  }
}

function moveMapCamera(map, camera, { duration = 680 } = {}) {
  if (!map) return
  // Avoid interpolation changing a steep terrain view while it is settling.
  if (Number(camera?.pitch) > HIGH_PITCH_TRANSITION_THRESHOLD) {
    map.jumpTo(camera)
    return
  }
  map.easeTo({ ...camera, duration, essential: true })
}

function createAtmosphereDraft(atmosphere = OFFLINE_ATMOSPHERE, overlayOpacity = DEFAULT_FOG_OVERLAY_OPACITY) {
  return {
    fogColor: atmosphere['fog-color'],
    horizonColor: atmosphere['horizon-color'],
    fogOpacity: formatCameraNumber(overlayOpacity, DEFAULT_FOG_OVERLAY_OPACITY, 2),
    fogGroundBlend: formatCameraNumber(atmosphere['fog-ground-blend'], OFFLINE_ATMOSPHERE['fog-ground-blend'], 2),
    horizonFogBlend: formatCameraNumber(atmosphere['horizon-fog-blend'], OFFLINE_ATMOSPHERE['horizon-fog-blend'], 2),
    skyHorizonBlend: formatCameraNumber(atmosphere['sky-horizon-blend'], OFFLINE_ATMOSPHERE['sky-horizon-blend'], 2),
  }
}

function parseAtmosphereDraft(draft) {
  if (!/^#[0-9a-f]{6}$/i.test(draft.fogColor) || !/^#[0-9a-f]{6}$/i.test(draft.horizonColor)) {
    return { error: '雾气颜色和地平线颜色需使用 6 位十六进制颜色' }
  }
  const values = Object.fromEntries(ATMOSPHERE_PARAMETER_FIELDS.map(({ name }) => [name, Number(draft[name])]))
  const invalidField = ATMOSPHERE_PARAMETER_FIELDS.find(({ name }) => !Number.isFinite(values[name]))
  if (invalidField) return { error: `请填写有效的${invalidField.label}` }
  const outOfRangeField = ATMOSPHERE_PARAMETER_FIELDS.find(({ name, min, max }) => values[name] < min || values[name] > max)
  if (outOfRangeField) return { error: `${outOfRangeField.label}范围为 ${outOfRangeField.min}–${outOfRangeField.max}` }

  return {
    atmosphere: {
      ...OFFLINE_ATMOSPHERE,
      'fog-color': draft.fogColor,
      'horizon-color': draft.horizonColor,
      'fog-ground-blend': values.fogGroundBlend,
      'horizon-fog-blend': values.horizonFogBlend,
      'sky-horizon-blend': values.skyHorizonBlend,
    },
    overlayOpacity: values.fogOpacity,
  }
}

function withAlpha(hex, alpha) {
  const value = String(hex || '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(95, 121, 128, ${alpha})`
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function createFogOverlayStyle(atmosphere, opacity) {
  const fog = atmosphere?.['fog-color']
  const horizon = atmosphere?.['horizon-color']
  return {
    opacity,
    mixBlendMode: 'screen',
    background: `linear-gradient(180deg, transparent 0%, transparent 20%, ${withAlpha(horizon, 0.12)} 25%, ${withAlpha(horizon, 0.86)} 34%, ${withAlpha(fog, 0.74)} 40%, ${withAlpha(fog, 0.28)} 47%, transparent 56%, transparent 100%)`,
  }
}

function CameraParameterPanel({ camera, draft, flat, mapReady, error, onChange, onCapture, onClose, onReset, onSubmit }) {
  const elevation = Number(camera?.elevation)
  const pitch = Number(draft.pitch)
  const highPitch = Number.isFinite(pitch) && pitch > 70
  const elevationLabel = Number.isFinite(elevation)
    ? `${elevation.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} m`
    : '读取中'

  return (
    <form className="camera-parameter-panel" id="camera-parameter-panel" role="dialog" aria-labelledby="camera-parameter-title" onSubmit={onSubmit}>
      <div className="camera-parameter-panel__header">
        <div>
          <span>LIVE CAMERA</span>
          <strong id="camera-parameter-title"><Camera size={15} aria-hidden="true" />摄像机参数</strong>
        </div>
        <button className="camera-parameter-panel__close" type="button" aria-label="关闭摄像机参数面板" onClick={onClose}>×</button>
      </div>

      <div className="camera-parameter-panel__grid">
        {CAMERA_PARAMETER_FIELDS.map((field) => (
          <label key={field.name}>
            <span>{field.label}<small>{field.unit}</small></span>
            <input
              aria-label={field.label}
              disabled={!mapReady || (flat && field.name === 'pitch')}
              inputMode="decimal"
              max={field.max}
              min={field.min}
              name={field.name}
              step={field.step}
              type="number"
              value={draft[field.name]}
              onChange={onChange}
            />
          </label>
        ))}
      </div>

      <div className="camera-parameter-panel__elevation">
        <span>地表高程</span>
        <strong>{elevationLabel}</strong>
      </div>
      <p className={`camera-parameter-panel__hint ${highPitch ? 'is-caution' : ''}`}>{flat ? '平面模式已锁定俯仰角；切换到 3D 后可调整。' : highPitch ? '70°以上为低空观察视角，近处山体可能遮挡画面。' : '拖动地图后，参数会在停止移动时自动刷新。'}</p>
      {error ? <p className="camera-parameter-panel__error" role="alert">{error}</p> : null}

      <div className="camera-parameter-panel__actions">
        <button type="button" disabled={!camera} onClick={onCapture}>读取当前</button>
        <button type="button" disabled={!mapReady} onClick={onReset}>复位默认</button>
        <button className="is-primary" type="submit" disabled={!mapReady}>应用参数</button>
      </div>
    </form>
  )
}

function AtmosphereParameterPanel({ draft, error, mapReady, offlineMap, onChange, onClose, onReset, onSubmit }) {
  const disabled = !mapReady || !offlineMap

  return (
    <form className="atmosphere-parameter-panel" id="atmosphere-parameter-panel" role="dialog" aria-labelledby="atmosphere-parameter-title" onSubmit={onSubmit}>
      <div className="atmosphere-parameter-panel__header">
        <div>
          <span>LOCAL ATMOSPHERE</span>
          <strong id="atmosphere-parameter-title"><CloudFog size={16} aria-hidden="true" />大气与雾气</strong>
        </div>
        <button className="atmosphere-parameter-panel__close" type="button" aria-label="关闭大气与雾气面板" onClick={onClose}>×</button>
      </div>

      <div className="atmosphere-parameter-panel__colors">
        <label>
          <span>雾气颜色<small>FOG</small></span>
          <div><input aria-label="雾气颜色" disabled={disabled} name="fogColor" type="color" value={draft.fogColor} onChange={onChange} /><output>{draft.fogColor}</output></div>
        </label>
        <label>
          <span>地平线颜色<small>HORIZON</small></span>
          <div><input aria-label="地平线颜色" disabled={disabled} name="horizonColor" type="color" value={draft.horizonColor} onChange={onChange} /><output>{draft.horizonColor}</output></div>
        </label>
      </div>

      <div className="atmosphere-parameter-panel__controls">
        {ATMOSPHERE_PARAMETER_FIELDS.map((field) => (
          <label key={field.name}>
            <span><strong>{field.label}</strong><small>{field.detail}</small></span>
            <input
              aria-label={field.label}
              disabled={disabled}
              inputMode="decimal"
              max={field.max}
              min={field.min}
              name={field.name}
              step={field.step}
              type="number"
              value={draft[field.name]}
              onChange={onChange}
            />
          </label>
        ))}
      </div>

      <p className="atmosphere-parameter-panel__hint">修改后会立即生效；仅在 3D 高视角显示。数值越小，雾越早覆盖山体。</p>
      {!offlineMap ? <p className="atmosphere-parameter-panel__error" role="alert">当前为在线地图；此面板仅调整离线 3D 的本地大气。</p> : null}
      {error ? <p className="atmosphere-parameter-panel__error" role="alert">{error}</p> : null}

      <div className="atmosphere-parameter-panel__actions">
        <button type="button" disabled={disabled} onClick={onReset}>复位雾气</button>
        <button className="is-primary" type="submit" disabled={disabled}>应用雾气</button>
      </div>
    </form>
  )
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
  if (tone === 'warning') return '#ffcd0d'
  return '#10e066'
}

function StationIcon({ type }) {
  if (String(type).includes('风')) return <Wind size={15} />
  if (String(type).includes('储能')) return <BatteryCharging size={15} />
  return <Sun size={15} />
}

async function loadOfflineManifest() {
  if (MAP_MODE === 'online') return null
  const packagedFile = typeof window !== 'undefined' && window.location.protocol === 'file:'
  try {
    const response = await fetch('./offline-map/manifest.json', { cache: 'no-store' })
    if (!response.ok && !(packagedFile && response.status === 0)) {
      throw new Error(`offline manifest ${response.status}`)
    }
    return { ...DEFAULT_OFFLINE_MANIFEST, ...(await response.json()) }
  } catch (error) {
    if (MAP_MODE === 'offline') return DEFAULT_OFFLINE_MANIFEST
    if (import.meta.env.DEV) console.info('[DigitalTwin] offline map not found', error)
    return null
  }
}

function addOperationalLayers(map, stations, corridor, { offline = false } = {}) {
  const layerOrder = offline ? {} : { slot: 'middle' }
  const markerOrder = offline ? {} : { slot: 'top' }
  const lineEmissive = offline ? {} : { 'line-emissive-strength': 1 }
  const circleEmissive = offline ? {} : { 'circle-emissive-strength': 1 }

  if (!map.getSource('ops-corridor')) {
    map.addSource('ops-corridor', { type: 'geojson', data: corridor })
    map.addLayer({
      id: 'ops-corridor-glow',
      type: 'line',
      source: 'ops-corridor',
      ...layerOrder,
      paint: {
        'line-color': '#37a2ff',
        'line-width': 9,
        'line-opacity': 0.1,
        'line-blur': 5,
        ...lineEmissive,
      },
    })
    map.addLayer({
      id: 'ops-corridor-line',
      type: 'line',
      source: 'ops-corridor',
      ...layerOrder,
      paint: {
        'line-color': '#5291ff',
        'line-width': 1.4,
        'line-opacity': 0.68,
        'line-dasharray': [2, 2],
        ...lineEmissive,
      },
    })
  }

  if (!map.getSource('ops-stations')) {
    map.addSource('ops-stations', { type: 'geojson', data: stations })
    map.addLayer({
      id: 'ops-station-glow',
      type: 'circle',
      source: 'ops-stations',
      ...markerOrder,
      paint: {
        'circle-radius': 20,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.12,
        'circle-blur': 0.75,
        ...circleEmissive,
      },
    })
    map.addLayer({
      id: 'ops-station-core',
      type: 'circle',
      source: 'ops-stations',
      ...markerOrder,
      paint: {
        'circle-radius': 4,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#111517',
        ...circleEmissive,
      },
    })
  }
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

function StationDetail({ station, onEnter }) {
  const alertCount = getAlertCount(station)
  const tone = getStationTone(station)

  return (
    <article className={`map-station-detail tone-${tone}`}>
      <div className="map-detail-top">
        <div>
          <strong>{station.name}</strong>
          <span>{station.type} · 当前出力 {station.output || station.metrics?.power}</span>
        </div>
        <button className="map-detail-enter" type="button" onClick={onEnter}>
          进入场站 <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="map-detail-health">
        <span>设备健康度</span>
        <strong>{station.health}<small>%</small></strong>
        <div><i style={{ width: `${station.health}%` }} /></div>
      </div>
      <div className="map-detail-actions">
        <span className={alertCount ? 'has-alert' : ''}>
          {alertCount ? <TriangleAlert size={14} /> : <Check size={14} />}
          {alertCount ? '智能诊断' : '无活动告警'}
        </span>
        <em className={alertCount ? 'has-alert' : ''}>
          {alertCount ? `${alertCount} 项异常` : '运行正常'}
        </em>
      </div>
    </article>
  )
}

function StaticFallback({ stations, interactive, selected, onSelect, onEnter }) {
  return (
    <div className={`map-static-fallback ${interactive ? 'is-interactive' : ''}`} aria-hidden={interactive ? undefined : true}>
      <svg className="map-fallback-svg" viewBox="0 0 1200 520" role="img" aria-label="雅砻江流域数字孪生降级示意图">
        <defs>
          <pattern id="fallback-grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M34 0H0V34" fill="none" stroke="rgba(255,255,255,.04)" />
          </pattern>
          <linearGradient id="fallback-river" x1="0" x2="1">
            <stop offset="0" stopColor="#343434" />
            <stop offset=".52" stopColor="#6b6b6b" />
            <stop offset="1" stopColor="#343434" />
          </linearGradient>
        </defs>
        <rect width="1200" height="520" fill="#0a0d0f" />
        <rect width="1200" height="520" fill="url(#fallback-grid)" />
        <path d="M-20 396c104-52 178-42 260 0 102 52 192 37 282-14 126-72 224-57 322 3 104 63 232 38 386-63" fill="none" stroke="#24292c" strokeWidth="82" />
        <path d="M-20 396c104-52 178-42 260 0 102 52 192 37 282-14 126-72 224-57 322 3 104 63 232 38 386-63" fill="none" stroke="url(#fallback-river)" strokeWidth="7" />
        <path d="M35 118C220 52 350 89 486 45s290-20 411 13 214 27 303-2" fill="none" stroke="#343a3d" />
        <path d="M12 160C190 98 342 126 482 82s276-22 409 15 214 32 309 4" fill="none" stroke="#2c3235" />
      </svg>
      {interactive ? stations.map((station) => (
        <button
          className={`fallback-station-marker tone-${getStationTone(station)} ${selected.id === station.id ? 'is-selected' : ''}`}
          key={station.id}
          style={FALLBACK_POSITIONS[station.id]}
          type="button"
          onClick={() => onSelect(station)}
        >
          <span className="marker-pin"><StationIcon type={station.type} /></span>
          <span><strong>{station.shortName || station.name}</strong><small>{station.output}</small></span>
        </button>
      )) : null}
      {interactive ? <StationDetail station={selected} onEnter={onEnter} /> : null}
    </div>
  )
}

export default function DigitalTwin({ stations = fallbackStations, active = true }) {
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRefs = useRef(new Map())
  const operationalDataRef = useRef(null)
  const syncMarkersRef = useRef(() => {})
  const mapStations = useMemo(() => (stations || fallbackStations)
    .map((station) => ({ ...station, mapCoordinates: STATION_COORDINATES[station.id] }))
    .filter((station) => station.mapCoordinates), [stations])
  const [selectedId, setSelectedId] = useState(() => mapStations.find((station) => station.id === 'kela')?.id || mapStations[0]?.id)
  const [flat, setFlat] = useState(false)
  const [lightPreset, setLightPreset] = useState('night')
  const [layersOpen, setLayersOpen] = useState(false)
  const [cameraPanelOpen, setCameraPanelOpen] = useState(false)
  const [atmospherePanelOpen, setAtmospherePanelOpen] = useState(false)
  const [terrainEnabled, setTerrainEnabled] = useState(true)
  const [weatherEnabled, setWeatherEnabled] = useState(true)
  const [markersVisible, setMarkersVisible] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [terrainError, setTerrainError] = useState('')
  const [mapSource, setMapSource] = useState('loading')
  const [cameraSnapshot, setCameraSnapshot] = useState(null)
  const [cameraDraft, setCameraDraft] = useState(() => createCameraDraft(DEFAULT_CAMERA))
  const [cameraInputError, setCameraInputError] = useState('')
  const [atmosphereSettings, setAtmosphereSettings] = useState(() => ({ ...OFFLINE_ATMOSPHERE }))
  const [atmosphereOverlayOpacity, setAtmosphereOverlayOpacity] = useState(DEFAULT_FOG_OVERLAY_OPACITY)
  const [atmosphereDraft, setAtmosphereDraft] = useState(() => createAtmosphereDraft(OFFLINE_ATMOSPHERE, DEFAULT_FOG_OVERLAY_OPACITY))
  const [atmosphereInputError, setAtmosphereInputError] = useState('')
  const selected = mapStations.find((station) => station.id === selectedId) || mapStations[0]

  const stationFeatures = useMemo(() => ({
    type: 'FeatureCollection',
    features: mapStations.map((station) => ({
      type: 'Feature',
      properties: { id: station.id, color: getStationColor(station) },
      geometry: { type: 'Point', coordinates: station.mapCoordinates },
    })),
  }), [mapStations])

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
      const point = map.project(station.mapCoordinates)
      const visible = point.x > -180 && point.y > -90 && point.x < canvas.clientWidth + 180 && point.y < canvas.clientHeight + 90
      node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`
      node.style.opacity = visible ? '1' : '0'
      node.style.pointerEvents = visible ? 'auto' : 'none'
    })
  }, [mapStations])
  operationalDataRef.current = { stationFeatures, corridor }
  syncMarkersRef.current = syncMarkers

  useEffect(() => {
    if (cameraSnapshot) setCameraDraft(createCameraDraft(cameraSnapshot))
  }, [cameraSnapshot])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || mapSource !== 'offline' || !map) return
    map.setSky?.(atmosphereSettings)
  }, [atmosphereSettings, mapReady, mapSource])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || mapSource !== 'offline' || !map) return
    const result = parseAtmosphereDraft(atmosphereDraft)
    if (!result.error) {
      map.setSky?.(result.atmosphere)
      setAtmosphereSettings(result.atmosphere)
      setAtmosphereOverlayOpacity(result.overlayOpacity)
    }
  }, [atmosphereDraft, mapReady, mapSource])

  useLayoutEffect(() => {
    let disposed = false
    let map
    let maplibregl
    let pmtilesProtocol
    let offline = false
    let loaded = false
    let failed = false
    let initialCameraApplied = false
    let terrainContentAvailable = false
    let terrainElevationRefreshFrame = 0
    let loadTimeout
    let contextLostHandler
    const handleMapMove = () => syncMarkersRef.current()

    const publishCameraSnapshot = () => {
      if (disposed || !map) return
      const camera = getCameraSnapshot(map, offline ? TERRAIN_EXAGGERATION : 1)
      setCameraSnapshot(camera)
      window.__OPS_MAP_CAMERA__ = camera
      window.dispatchEvent(new CustomEvent('ops-map-camera-change', { detail: camera }))
      if (import.meta.env.DEV) console.info('[DigitalTwin] camera', JSON.stringify(camera))
    }

    const queueTerrainElevationRefresh = () => {
      if (disposed || !loaded || !map || terrainElevationRefreshFrame) return
      terrainElevationRefreshFrame = window.requestAnimationFrame(() => {
        terrainElevationRefreshFrame = 0
        publishCameraSnapshot()
      })
    }

    const refreshTerrainElevation = (event) => {
      if (!offline || event?.sourceId !== TERRAIN_SOURCE_ID || event?.sourceDataType !== 'content') return
      terrainContentAvailable = true
      queueTerrainElevationRefresh()
    }

    const fail = (message) => {
      if (disposed || failed) return
      failed = true
      window.clearTimeout(loadTimeout)
      setMapError(message)
      setMapReady(false)
      setMapSource('fallback')
    }

    const markMapReady = () => {
      if (disposed || loaded || failed) return
      if (!initialCameraApplied) {
        try {
          // Re-apply after the first visual map tile settles the initial view.
          map?.jumpTo({ ...DEFAULT_CAMERA })
          initialCameraApplied = true
        } catch {
          // The constructor view remains available if a renderer rejects the final snap.
        }
      }
      loaded = true
      window.clearTimeout(loadTimeout)
      setMapReady(true)
      setMapError('')
      setMapSource(offline ? 'offline' : 'online')
      handleMapMove()
      publishCameraSnapshot()
      if (offline && terrainContentAvailable) queueTerrainElevationRefresh()
    }

    const markOfflineSourceReady = (event) => {
      if (!offline || loaded || !map || !map.getSource('protomaps')) return
      if (event?.sourceId !== 'protomaps') return
      try {
        const receivedTileContent = Boolean(event?.coord) && event?.tile?.state === 'loaded'
        if (receivedTileContent) markMapReady()
      } catch {
        // Keep waiting for another successfully decoded basemap tile.
      }
    }

    async function initializeMap() {
      try {
        const offlineManifest = await loadOfflineManifest()
        if (disposed || !mapContainerRef.current) return

        offline = Boolean(offlineManifest)
        setMapSource(offline ? 'offline' : 'online')
        if (offline) {
          const [offlineMapLibreModule, { PMTiles, Protocol }] = await Promise.all([
            import('maplibre-gl'),
            import('pmtiles'),
          ])
          if (disposed || !mapContainerRef.current) return
          maplibregl = offlineMapLibreModule.default || offlineMapLibreModule
          maplibregl.setWorkerUrl(maplibreWorkerUrl)
          const supported = typeof maplibregl.supported === 'function'
            ? maplibregl.supported()
            : typeof maplibregl.Map?.isSupported === 'function'
              ? maplibregl.Map.isSupported()
              : true
          if (!supported) {
            fail('当前浏览器不支持 WebGL 地图')
            return
          }
          pmtilesProtocol = acquireOfflineProtocol(maplibregl, Protocol, PMTiles, [
            offlineManifest.basemap || OFFLINE_BASEMAP_URL,
            offlineManifest.terrain || OFFLINE_TERRAIN_URL,
          ])
          if (import.meta.env.DEV) window.__OPS_PMTILES_PROTOCOL__ = pmtilesProtocol
          map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: offlineManifest.style || DEFAULT_OFFLINE_MANIFEST.style,
            ...DEFAULT_CAMERA,
            antialias: true,
            attributionControl: false,
            maxPitch: 85,
            minZoom: 5.5,
            maxZoom: Math.max(15, Number(offlineManifest.maxZoom) || 12),
            maxBounds: offlineManifest.bounds || DEFAULT_OFFLINE_MANIFEST.bounds,
          })
          map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
          map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')
        } else {
          if (!MAPBOX_TOKEN) {
            fail('缺少 Mapbox Public Token，且未找到离线地图包')
            return
          }
          const { default: onlineMapbox } = await import('mapbox-gl')
          if (disposed || !mapContainerRef.current) return
          if (!onlineMapbox.supported()) {
            fail('当前浏览器不支持 WebGL 地图')
            return
          }
          onlineMapbox.accessToken = MAPBOX_TOKEN
          map = new onlineMapbox.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/standard',
            ...DEFAULT_CAMERA,
            antialias: true,
            attributionControl: false,
            maxPitch: 85,
            minZoom: 5.5,
            maxZoom: 15,
            config: {
              basemap: {
                lightPreset: 'night',
                theme: 'monochrome',
                show3dObjects: true,
                showPointOfInterestLabels: false,
                showTransitLabels: false,
                showPedestrianRoads: false,
                showRoadLabels: false,
                showPlaceLabels: true,
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
            },
          })
          map.addControl(new onlineMapbox.AttributionControl({ compact: true }), 'bottom-right')
          map.addControl(new onlineMapbox.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')
        }

        mapRef.current = map
        if (import.meta.env.DEV) window.__OPS_MAP_DEBUG__ = map

        contextLostHandler = () => fail('WebGL 上下文已丢失')
        map.getCanvas().addEventListener('webglcontextlost', contextLostHandler, { once: true })
        map.on('style.load', () => {
          if (disposed) return
          try {
            if (!map.getSource(TERRAIN_SOURCE_ID)) {
              map.addSource(TERRAIN_SOURCE_ID, offline ? createOfflineTerrainSource(offlineManifest) : {
                type: 'raster-dem',
                url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                tileSize: 512,
                maxzoom: 14,
              })
            }
            if (offline && !map.getSource(TERRAIN_HILLSHADE_SOURCE_ID)) {
              map.addSource(TERRAIN_HILLSHADE_SOURCE_ID, createOfflineTerrainSource(offlineManifest))
            }
            if (offline && !map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
              map.addLayer({
                id: TERRAIN_HILLSHADE_LAYER_ID,
                type: 'hillshade',
                source: TERRAIN_HILLSHADE_SOURCE_ID,
                paint: {
                  'hillshade-exaggeration': 0.3,
                  'hillshade-illumination-direction': 315,
                  'hillshade-illumination-anchor': 'map',
                  'hillshade-shadow-color': '#071017',
                  'hillshade-highlight-color': '#6f8990',
                  'hillshade-accent-color': '#29454d',
                },
              })
            }
            if (map.getSource(TERRAIN_SOURCE_ID)) {
              setTerrainError('')
              map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION })
            }
            if (offline) {
              map.setSky?.(OFFLINE_ATMOSPHERE)
            } else {
              map.setFog?.({
                range: [0.8, 7.5],
                color: '#53676b',
                'high-color': '#172b34',
                'horizon-blend': 0.24,
                'space-color': '#05090c',
                'star-intensity': 0.04,
              })
            }
            const { stationFeatures: latestStations, corridor: latestCorridor } = operationalDataRef.current
            addOperationalLayers(map, latestStations, latestCorridor, { offline })
            applyWeather(map, true)
          } catch (error) {
            if (import.meta.env.DEV) {
              window.__OPS_MAP_ERROR_DETAIL__ = error?.stack || error?.message || String(error)
              console.error('[DigitalTwin] style setup failed', error)
            }
            fail(offline ? '离线地图资源加载失败' : '地图地形图层加载失败，已切换降级视图')
          }
        })
        map.on('move', handleMapMove)
        map.on('moveend', publishCameraSnapshot)
        map.on('resize', handleMapMove)
        map.on('sourcedata', markOfflineSourceReady)
        map.on('sourcedata', refreshTerrainElevation)
        map.on('load', () => {
          if (!offline) markMapReady()
        })
        map.on('error', (event) => {
          const message = event?.error?.message || ''
          if (offline && event?.sourceId === TERRAIN_HILLSHADE_SOURCE_ID) {
            try {
              if (map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
                map.setLayoutProperty(TERRAIN_HILLSHADE_LAYER_ID, 'visibility', 'none')
              }
            } catch {
              // The 3D terrain remains usable without the optional relief shading.
            }
            return
          }
          const terrainFailure = offline && (
            event?.sourceId === TERRAIN_SOURCE_ID
            || /yalongjiang-terrain|ops-terrain-dem|raster.?dem/i.test(message)
          )
          if (terrainFailure) {
            setTerrainError('离线高程地形加载失败')
            try {
              map.setTerrain(null)
              if (map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
                map.setLayoutProperty(TERRAIN_HILLSHADE_LAYER_ID, 'visibility', 'none')
              }
            } catch {
              // Keep the vector basemap available even if its optional DEM cannot render.
            }
            return
          }
          if (import.meta.env.DEV && !loaded) {
            window.__OPS_MAP_ERROR_DETAIL__ = message || String(event?.error || event)
          }
          if (!loaded && (offline
            ? /pmtiles|range|byte serving|404|style|source|tile|fetch/i.test(message)
            : /401|403|access token|style/i.test(message))) {
            fail(offline ? '离线地图包读取失败' : 'Mapbox 鉴权或地图样式加载失败')
          }
        })
        loadTimeout = window.setTimeout(() => {
          if (!loaded) fail(offline ? '离线地图加载超时' : '3D 地图加载超时')
        }, 18000)
      } catch (error) {
        if (import.meta.env.DEV) {
          window.__OPS_MAP_ERROR_DETAIL__ = error?.stack || error?.message || String(error)
          console.error('[DigitalTwin] map initialization failed', error)
        }
        fail(offline ? '离线地图初始化失败' : '3D 地图初始化失败')
      }
    }

    initializeMap()
    return () => {
      disposed = true
      window.clearTimeout(loadTimeout)
      if (terrainElevationRefreshFrame) window.cancelAnimationFrame(terrainElevationRefreshFrame)
      if (map) {
        map.off('move', handleMapMove)
        map.off('moveend', publishCameraSnapshot)
        map.off('resize', handleMapMove)
        map.off('sourcedata', markOfflineSourceReady)
        map.off('sourcedata', refreshTerrainElevation)
        if (contextLostHandler) map.getCanvas().removeEventListener('webglcontextlost', contextLostHandler)
        map.remove()
      }
      if (pmtilesProtocol) releaseOfflineProtocol(pmtilesProtocol)
      if (import.meta.env.DEV) delete window.__OPS_PMTILES_PROTOCOL__
      if (import.meta.env.DEV) delete window.__OPS_MAP_DEBUG__
      if (import.meta.env.DEV) delete window.__OPS_MAP_ERROR_DETAIL__
      if (mapRef.current === map) mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    map.getSource('ops-stations')?.setData?.(stationFeatures)
    map.getSource('ops-corridor')?.setData?.(corridor)
    syncMarkers()
  }, [corridor, mapReady, stationFeatures, syncMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    try {
      map.setConfigProperty?.('basemap', 'lightPreset', lightPreset)
      const isDark = lightPreset === 'night' || lightPreset === 'dusk'
      map.setFog?.(isDark ? {
        range: [0.8, 7.5],
        color: '#53676b',
        'high-color': '#172b34',
        'horizon-blend': 0.24,
        'space-color': '#05090c',
        'star-intensity': lightPreset === 'night' ? 0.04 : 0.02,
      } : {
        range: [0.6, 8.5],
        color: '#b8c8cc',
        'high-color': '#dce7e8',
        'horizon-blend': 0.18,
        'space-color': '#81959b',
        'star-intensity': 0,
      })
    } catch {
      // Keep the loaded map usable when a style preset is unavailable.
    }
  }, [lightPreset, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    applyWeather(map, weatherEnabled)
  }, [mapReady, weatherEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    try {
      if (map.getSource(TERRAIN_SOURCE_ID)) {
        map.setTerrain(!flat && terrainEnabled ? { source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION } : null)
      }
      moveMapCamera(map, { pitch: flat ? 0 : DEFAULT_CAMERA.pitch, bearing: flat ? 0 : DEFAULT_CAMERA.bearing }, { duration: 720 })
    } catch {
      // A terrain toggle failure should not blank an otherwise usable map.
    }
  }, [flat, mapReady, terrainEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    const visibility = terrainEnabled ? 'visible' : 'none'
    if (map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) map.setLayoutProperty(TERRAIN_HILLSHADE_LAYER_ID, 'visibility', visibility)
    if (map.getLayer('ops-corridor-glow')) map.setLayoutProperty('ops-corridor-glow', 'visibility', visibility)
    if (map.getLayer('ops-corridor-line')) map.setLayoutProperty('ops-corridor-line', 'visibility', visibility)
  }, [mapReady, terrainEnabled])

  useEffect(() => {
    const resizeMap = () => window.setTimeout(() => mapRef.current?.resize(), 120)
    document.addEventListener('fullscreenchange', resizeMap)
    return () => document.removeEventListener('fullscreenchange', resizeMap)
  }, [])

  useEffect(() => {
    if (!active || !mapReady) return undefined
    const frame = window.requestAnimationFrame(() => {
      mapRef.current?.resize()
      syncMarkers()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [active, mapReady, syncMarkers])

  const selectStation = useCallback((station) => {
    setSelectedId(station.id)
    const map = mapRef.current
    if (mapReady && map) {
      map.easeTo({ center: station.mapCoordinates, zoom: Math.max(map.getZoom(), 8.15), duration: 720, essential: true })
    }
  }, [mapReady])

  const resetView = () => {
    setSelectedId(mapStations.find((station) => station.id === 'kela')?.id || mapStations[0]?.id)
    setCameraDraft(createCameraDraft({ ...DEFAULT_CAMERA, pitch: flat ? 0 : DEFAULT_CAMERA.pitch }))
    setCameraInputError('')
    moveMapCamera(mapRef.current, { ...DEFAULT_CAMERA, pitch: flat ? 0 : DEFAULT_CAMERA.pitch, bearing: flat ? 0 : DEFAULT_CAMERA.bearing }, { duration: 900 })
  }

  const updateCameraDraft = useCallback((event) => {
    const { name, value } = event.target
    setCameraDraft((current) => ({ ...current, [name]: value }))
    setCameraInputError('')
  }, [])

  const captureCameraParameters = useCallback(() => {
    if (!cameraSnapshot) return
    setCameraDraft(createCameraDraft(cameraSnapshot))
    setCameraInputError('')
  }, [cameraSnapshot])

  const applyCameraParameters = useCallback((event) => {
    event.preventDefault()
    const map = mapRef.current
    if (!mapReady || !map) return
    const result = parseCameraDraft(cameraDraft)
    if (result.error) {
      setCameraInputError(result.error)
      return
    }
    setCameraInputError('')
    const nextCamera = { ...result.camera, pitch: flat ? 0 : result.camera.pitch }
    moveMapCamera(map, nextCamera)
  }, [cameraDraft, flat, mapReady])

  const updateAtmosphereDraft = useCallback((event) => {
    const { name, value } = event.target
    setAtmosphereDraft((current) => ({ ...current, [name]: value }))
    setAtmosphereInputError('')
  }, [])

  const resetAtmosphereParameters = useCallback(() => {
    setAtmosphereSettings({ ...OFFLINE_ATMOSPHERE })
    setAtmosphereOverlayOpacity(DEFAULT_FOG_OVERLAY_OPACITY)
    setAtmosphereDraft(createAtmosphereDraft(OFFLINE_ATMOSPHERE, DEFAULT_FOG_OVERLAY_OPACITY))
    setAtmosphereInputError('')
  }, [])

  const applyAtmosphereParameters = useCallback((event) => {
    event.preventDefault()
    const result = parseAtmosphereDraft(atmosphereDraft)
    if (result.error) {
      setAtmosphereInputError(result.error)
      return
    }
    setAtmosphereSettings(result.atmosphere)
    setAtmosphereOverlayOpacity(result.overlayOpacity)
    setAtmosphereDraft(createAtmosphereDraft(result.atmosphere, result.overlayOpacity))
    setAtmosphereInputError('')
  }, [atmosphereDraft])

  const focusSelected = () => {
    if (!selected) return
    mapRef.current?.flyTo({ center: selected.mapCoordinates, zoom: 10.2, pitch: flat ? 0 : 66, bearing: flat ? 0 : -24, speed: 0.8, curve: 1.3, essential: true })
  }

  const toggleFullscreen = async () => {
    if (!panelRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await panelRef.current.requestFullscreen()
    window.setTimeout(() => mapRef.current?.resize(), 120)
  }

  if (!selected) return null
  const offlineMap = mapSource === 'offline'
  const mapSourceLabel = mapError
    ? '降级视图'
    : offlineMap
      ? mapReady ? terrainError ? '离线地图' : '离线 3D' : '载入离线地图'
      : mapReady ? '在线地形' : '载入地图'

  return (
    <section ref={panelRef} className="digital-twin" aria-label="雅砻江流域电站数字孪生">
      <header className="scene-toolbar">
        <div>
          <span className="section-kicker">BASIN DIGITAL TWIN · OFFLINE READY</span>
          <h2>数字孪生 <b>· 雅砻江</b></h2>
        </div>
        <div className="scene-summary">
          <span className={`map-source-status is-${mapSource}`}><i className="legend-dot normal" />{mapSourceLabel}</span>
          <span><i className="legend-dot warning" />在办缺陷 3</span>
        </div>
        <div className="scene-tools">
          <div className="map-mode-switch" aria-label="地图视图">
            <button className={!flat ? 'is-active' : ''} type="button" onClick={() => setFlat(false)}>3D</button>
            <button className={flat ? 'is-active' : ''} type="button" onClick={() => setFlat(true)}>平面</button>
          </div>
          <button className={cameraPanelOpen ? 'is-active' : ''} type="button" title="摄像机参数" aria-pressed={cameraPanelOpen} aria-controls="camera-parameter-panel" onClick={() => { setCameraPanelOpen((value) => !value); setAtmospherePanelOpen(false); setLayersOpen(false) }} disabled={!mapReady}><Camera size={16} /></button>
          <button className={atmospherePanelOpen ? 'is-active' : ''} type="button" title="大气与雾气参数" aria-pressed={atmospherePanelOpen} aria-controls="atmosphere-parameter-panel" onClick={() => { setAtmospherePanelOpen((value) => !value); setCameraPanelOpen(false); setLayersOpen(false) }} disabled={!mapReady}><CloudFog size={16} /></button>
          <button className={layersOpen ? 'is-active' : ''} type="button" title="图层" aria-pressed={layersOpen} onClick={() => { setLayersOpen((value) => !value); setCameraPanelOpen(false); setAtmospherePanelOpen(false) }}><Layers3 size={16} /></button>
          <button type="button" title="定位选中电站" onClick={focusSelected} disabled={!mapReady}><LocateFixed size={16} /></button>
          <button type="button" title="复位视角" onClick={resetView} disabled={!mapReady}><RotateCcw size={16} /></button>
          <button type="button" title="切换全屏" onClick={toggleFullscreen}><Maximize2 size={16} /></button>
        </div>
      </header>

      <div className={`twin-canvas mapbox-twin-canvas ${flat ? 'is-flat' : ''}`}>
        <StaticFallback stations={mapStations} interactive={Boolean(mapError)} selected={selected} onSelect={selectStation} onEnter={() => navigate(`/station/${selected.id}`)} />
        <div
          ref={mapContainerRef}
          className={`mapbox-canvas ${mapReady && !mapError ? 'is-ready' : ''}`}
          data-camera={cameraSnapshot ? JSON.stringify(cameraSnapshot) : undefined}
          data-terrain={terrainError ? 'error' : !flat && terrainEnabled ? 'enabled' : 'disabled'}
          aria-label="雅砻江流域交互地图"
        />
        <div
          className={`map-fog-overlay ${offlineMap && mapReady && !flat ? '' : 'is-hidden'}`}
          style={createFogOverlayStyle(atmosphereSettings, atmosphereOverlayOpacity)}
          aria-hidden="true"
        />

        {!mapError ? (
          <>
            {!offlineMap ? (
              <div className="map-light-presets" aria-label="地图光照预设">
                {LIGHT_PRESETS.map(([value, label]) => (
                  <button key={value} className={lightPreset === value ? 'is-active' : ''} type="button" onClick={() => setLightPreset(value)} disabled={!mapReady}>{label}</button>
                ))}
              </div>
            ) : null}
            <div className={`map-station-layer ${markersVisible ? '' : 'is-hidden'}`}>
              {mapStations.map((station) => (
                <div
                  className="map-station-anchor"
                  key={station.id}
                  ref={(node) => {
                    if (node) markerRefs.current.set(station.id, node)
                    else markerRefs.current.delete(station.id)
                  }}
                >
                  <button
                    className={`map-station-marker tone-${getStationTone(station)} ${selected.id === station.id ? 'is-selected' : ''}`}
                    type="button"
                    aria-label={`${station.name}，健康度 ${station.health}%`}
                    onClick={() => selectStation(station)}
                  >
                    <span className="marker-pin"><StationIcon type={station.type} /></span>
                    <span><strong>{station.shortName || station.name}</strong><small>{station.output}</small></span>
                    {getAlertCount(station) ? <i>{getAlertCount(station)}</i> : null}
                  </button>
                </div>
              ))}
            </div>
            {mapReady ? <StationDetail station={selected} onEnter={() => navigate(`/station/${selected.id}`)} /> : null}
          </>
        ) : null}

        {layersOpen ? (
          <div className="map-layer-menu" role="dialog" aria-label="地图图层">
            <span>显示图层</span>
            <button type="button" role="switch" aria-checked={terrainEnabled} onClick={() => setTerrainEnabled((value) => !value)}><span>三维地形与流域链路</span><i>{terrainEnabled ? <Check size={12} /> : null}</i></button>
            {!offlineMap ? <button type="button" role="switch" aria-checked={weatherEnabled} onClick={() => setWeatherEnabled((value) => !value)}><span>高海拔气象粒子</span><i>{weatherEnabled ? <Check size={12} /> : null}</i></button> : null}
            <button type="button" role="switch" aria-checked={markersVisible} onClick={() => setMarkersVisible((value) => !value)}><span>电站状态标记</span><i>{markersVisible ? <Check size={12} /> : null}</i></button>
          </div>
        ) : null}
        {cameraPanelOpen ? (
          <CameraParameterPanel
            camera={cameraSnapshot}
            draft={cameraDraft}
            error={cameraInputError}
            flat={flat}
            mapReady={mapReady}
            onCapture={captureCameraParameters}
            onChange={updateCameraDraft}
            onClose={() => setCameraPanelOpen(false)}
            onReset={resetView}
            onSubmit={applyCameraParameters}
          />
        ) : null}
        {atmospherePanelOpen ? (
          <AtmosphereParameterPanel
            draft={atmosphereDraft}
            error={atmosphereInputError}
            mapReady={mapReady}
            offlineMap={offlineMap}
            onChange={updateAtmosphereDraft}
            onClose={() => setAtmospherePanelOpen(false)}
            onReset={resetAtmosphereParameters}
            onSubmit={applyAtmosphereParameters}
          />
        ) : null}

        {!mapReady && !mapError ? (
          <div className="map-loading-state">
            <span />
            <strong>{mapSource === 'online' ? '正在建立 3D 地形' : '正在建立离线 3D 地形'}</strong>
            <small>{mapSource === 'online' ? '加载 Mapbox Standard 与高程数据' : '读取本地底图与高程包'}</small>
          </div>
        ) : null}
        {terrainError && !mapError ? <div className="map-fallback-notice"><TriangleAlert size={14} /><span><strong>三维地形暂不可用</strong><small>{terrainError}，已保留离线平面地图</small></span></div> : null}
        {mapError ? <div className="map-fallback-notice"><TriangleAlert size={14} /><span><strong>地图暂不可用</strong><small>{mapError}，场站交互仍可使用</small></span></div> : null}
        <div className="map-legend"><span><i className="normal" />正常</span><span><i className="warning" />预警</span><span><i className="urgent" />严重告警</span></div>
      </div>
    </section>
  )
}
