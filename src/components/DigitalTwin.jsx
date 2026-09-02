import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BatteryCharging,
  Check,
  CaretRight as ChevronRight,
  Stack as Layers3,
  Crosshair as LocateFixed,
  ArrowsOut as Maximize2,
  ArrowCounterClockwise as RotateCcw,
  Sun,
  Warning as TriangleAlert,
  Wind,
} from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useApp } from '../context/AppContext'
import { stations as fallbackStations } from '../data/demoData'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()
const DEFAULT_CAMERA = {
  center: [101.08, 28.88],
  zoom: 7.05,
  pitch: 52,
  bearing: -12,
}
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

function addOperationalLayers(map, stations, corridor) {
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
      paint: {
        'circle-radius': 4,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#111517',
        'circle-emissive-strength': 1,
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
          {alertCount ? <TriangleAlert size={14} weight="fill" /> : <Check size={14} />}
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
  const { theme } = useApp()
  const mapStyle = theme === 'light' ? 'mapbox://styles/mapbox-map-design/cmh0wgofd00bu01srg2k73chv' : 'mapbox://styles/mapbox/standard'
  const panelRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRefs = useRef(new Map())
  const mapStations = useMemo(() => (stations || fallbackStations)
    .map((station) => ({ ...station, mapCoordinates: STATION_COORDINATES[station.id] }))
    .filter((station) => station.mapCoordinates), [stations])
  const [selectedId, setSelectedId] = useState(() => mapStations.find((station) => station.id === 'kela')?.id || mapStations[0]?.id)
  const [flat, setFlat] = useState(false)
  const [lightPreset, setLightPreset] = useState(() => theme === 'light' ? 'dawn' : 'dusk')
  const lightPresetRef = useRef(lightPreset)
  lightPresetRef.current = lightPreset
  const [layersOpen, setLayersOpen] = useState(false)
  const [terrainEnabled, setTerrainEnabled] = useState(true)
  const [weatherEnabled, setWeatherEnabled] = useState(() => theme === 'dark')
  const [markersVisible, setMarkersVisible] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState('')
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

  useLayoutEffect(() => {
    setMapReady(false)
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
        const { default: mapboxgl } = await import('mapbox-gl')
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
          ...DEFAULT_CAMERA,
          antialias: true,
          attributionControl: false,
          maxPitch: 80,
          minZoom: 5.5,
          maxZoom: 15,
          config: {
            basemap: theme === 'light' ? { lightPreset: initialLightPreset } : {
              lightPreset: initialLightPreset,
              theme: 'monochrome',
              show3dObjects: true,
              showPointOfInterestLabels: false,
              showTransitLabels: false,
              showPedestrianRoads: false,
              showRoadLabels: false,
              showPlaceLabels: true,
              ...initialAppearance.colors,
            },
          },
        })
        mapRef.current = map
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
        map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')

        contextLostHandler = () => fail('WebGL 上下文已丢失')
        map.getCanvas().addEventListener('webglcontextlost', contextLostHandler, { once: true })
        map.on('style.load', () => {
          if (disposed) return
          try {
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
            addOperationalLayers(map, stationFeatures, corridor)
            applyWeather(map, theme === 'dark')
          } catch {
            fail('地图地形图层加载失败，已切换降级视图')
          }
        })
        map.on('move', syncMarkers)
        map.on('resize', syncMarkers)
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
      if (mapRef.current === map) mapRef.current = null
    }
  }, [corridor, mapStyle, stationFeatures, syncMarkers])

  useEffect(() => {
    setLightPreset(theme === 'light' ? 'dawn' : 'dusk')
    setWeatherEnabled(theme === 'dark')
  }, [theme])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    try {
      const appearance = getMapAppearance(lightPreset)
      map.setConfigProperty?.('basemap', 'lightPreset', lightPreset)
      if (theme === 'dark') {
        Object.entries(appearance.colors).forEach(([property, value]) => {
          map.setConfigProperty?.('basemap', property, value)
        })
        map.setFog({
          ...appearance.fog,
          'star-intensity': lightPreset === 'night' ? 0.08 : lightPreset === 'dusk' ? 0.02 : 0,
        })
      }
    } catch {
      // Keep the loaded map usable when a style preset is unavailable.
    }
  }, [lightPreset, mapReady, theme])

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
      map.easeTo({ pitch: flat ? 0 : DEFAULT_CAMERA.pitch, bearing: flat ? 0 : DEFAULT_CAMERA.bearing, duration: 720, essential: true })
    } catch {
      // A terrain toggle failure should not blank an otherwise usable map.
    }
  }, [flat, mapReady, terrainEnabled, theme])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    const visibility = terrainEnabled ? 'visible' : 'none'
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
    mapRef.current?.easeTo({ ...DEFAULT_CAMERA, pitch: flat ? 0 : DEFAULT_CAMERA.pitch, bearing: flat ? 0 : DEFAULT_CAMERA.bearing, duration: 900, essential: true })
  }

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

  return (
    <section ref={panelRef} className="digital-twin" aria-label="雅砻江流域电站数字孪生">
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
          <button className={layersOpen ? 'is-active' : ''} type="button" title="图层" aria-pressed={layersOpen} onClick={() => setLayersOpen((value) => !value)}><Layers3 size={16} /></button>
          <button type="button" title="定位选中电站" onClick={focusSelected} disabled={!mapReady}><LocateFixed size={16} /></button>
          <button type="button" title="复位视角" onClick={resetView} disabled={!mapReady}><RotateCcw size={16} /></button>
          <button type="button" title="切换全屏" onClick={toggleFullscreen}><Maximize2 size={16} /></button>
        </div>
      </header>

      <div className={`twin-canvas mapbox-twin-canvas ${flat ? 'is-flat' : ''}`}>
        <StaticFallback stations={mapStations} interactive={Boolean(mapError)} selected={selected} onSelect={selectStation} onEnter={() => navigate(`/station/${selected.id}`)} />
        <div ref={mapContainerRef} className={`mapbox-canvas ${mapReady && !mapError ? 'is-ready' : ''}`} aria-label="雅砻江流域三维地形地图" />

        {!mapError ? (
          <>
            <div className="map-light-presets" aria-label="地图光照预设">
              {LIGHT_PRESETS.map(([value, label]) => (
                <button key={value} className={lightPreset === value ? 'is-active' : ''} type="button" onClick={() => setLightPreset(value)} disabled={!mapReady}>{label}</button>
              ))}
            </div>
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
            <button type="button" role="switch" aria-checked={weatherEnabled} onClick={() => setWeatherEnabled((value) => !value)}><span>高海拔气象粒子</span><i>{weatherEnabled ? <Check size={12} /> : null}</i></button>
            <button type="button" role="switch" aria-checked={markersVisible} onClick={() => setMarkersVisible((value) => !value)}><span>电站状态标记</span><i>{markersVisible ? <Check size={12} /> : null}</i></button>
          </div>
        ) : null}

        {!mapReady && !mapError ? <div className="map-loading-state"><span /><strong>正在建立 3D 地形</strong><small>加载 Mapbox Standard 与高程数据</small></div> : null}
        {mapError ? <div className="map-fallback-notice"><TriangleAlert size={14} /><span><strong>3D 地图暂不可用</strong><small>{mapError}，场站交互仍可使用</small></span></div> : null}
        <div className="map-legend"><span><i className="normal" />正常</span><span><i className="warning" />预警</span><span><i className="urgent" />严重告警</span></div>
      </div>
    </section>
  )
}
