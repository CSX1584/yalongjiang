import { useEffect, useRef, useState } from 'react'
import { Check, CaretRight as ChevronRight, Warning as TriangleAlert, ArrowsOut, ArrowsIn, ArrowCounterClockwise, SlidersHorizontal } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { stations as fallbackStations } from '../data/demoData'
import projectMapConfig from '../data/mapConfig.json'
import { EVENT_PHASES, getStationEvents, getStationKpis } from './stationCardData.mjs'
import { glassCssVariables } from './stationGlassConfig.mjs'
import { loadMapConfig, saveMapPreset, mapSnapshot } from './mapConfig.mjs'
import { attachStationGlass } from './stationGlass'
import { DEFAULT_ENVIRONMENT } from './geospatialPreset.js'
import SceneParameter from './SceneParameter'
import './geospatialScene.css'

function getAlertCount(station) {
  return Array.isArray(station.alerts) ? station.alerts.length : Number(station.alerts || 0)
}
function getStationTone(station) {
  return station.status === 'urgent' ? 'urgent' : station.status === 'warning' ? 'warning' : 'normal'
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


export default function DigitalTwin({ stations = fallbackStations, active = true }) {
  const { theme, setTheme } = useApp()
  const navigate = useNavigate()
  const panelRef = useRef(null), containerRef = useRef(null), attributionRef = useRef(null)
  const markerRefs = useRef(new Map()), sceneRef = useRef(null)
  const [status, setStatus] = useState({ ready: false, message: '' })
  const [attempt, setAttempt] = useState(0)
  const [fullscreen, setFullscreen] = useState(projectMapConfig.geospatial.fullscreen)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [presets, setPresets] = useState(projectMapConfig.presets)
  const [selectedPresetId, setSelectedPresetId] = useState(projectMapConfig.presets.defaultId)
  const [presetName, setPresetName] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [modelConfig, setModelConfig] = useState(projectMapConfig.modelConfig)
  const [modelStation, setModelStation] = useState(projectMapConfig.modelConfig.stationId)
  const [saveState, setSaveState] = useState('')
  const [environment, setEnvironment] = useState(projectMapConfig.geospatial.environment)
  const defaultsRef = useRef(projectMapConfig)
  const snapshotRef = useRef(mapSnapshot(projectMapConfig))
  const [baseGlassConfig, setBaseGlassConfig] = useState(projectMapConfig.glassConfig)
  const glassConfig = theme === 'light' ? baseGlassConfig : { ...baseGlassConfig, tintColor: '#1b1e1f', tintOpacity: 58 }
  const glassRef = useRef(glassConfig)
  glassRef.current = glassConfig
  const optionsRef = useRef(null)
  optionsRef.current = { ...environment, modelConfig, active }

  useEffect(() => {
    let cancelled = false, scene, detachGlass
    setStatus({ ready: false, message: '' })
    import('./geospatialScene').then(({ createGeospatialScene }) => {
      if (cancelled) return
      scene = createGeospatialScene({
        container: containerRef.current, stations,
        modelUrl: theme === 'light' ? '/models/station_light.glb' : '/models/station.glb',
        modelConfig: snapshotRef.current.modelConfig, theme,
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim(),
        markerRefs, attribution: attributionRef.current,
        initialState: snapshotRef.current.geospatial, defaultState: defaultsRef.current.geospatial,
        getOptions: () => optionsRef.current,
        onStatus: value => { if (!cancelled) setStatus(value) },
      })
      sceneRef.current = scene
      detachGlass = attachStationGlass(scene.frameSource, panelRef.current, () => glassRef.current)
    }).catch(() => { if (!cancelled) setStatus({ ready: false, message: '三维场景初始化失败，请检查访问凭据后重试' }) })
    return () => { cancelled = true; detachGlass?.(); scene?.dispose(); sceneRef.current = null }
  }, [stations, theme, attempt])

  useEffect(() => {
    let cancelled = false
    loadMapConfig().then(config => {
      if (cancelled) return
      receivePresets(config)
      applyPreset(config.presets.items.find(item => item.id === config.presets.defaultId))
    }).catch(() => { if (!cancelled) setSaveState('项目参数列表读取失败，请重新打开列表重试') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => { sceneRef.current?.invalidate() }, [active, environment, modelConfig])
  useEffect(() => {
    if (!active) setFullscreen(false)
  }, [active])
  useEffect(() => {
    if (!fullscreen) return
    const previous = document.activeElement
    const panel = panelRef.current
    panel.querySelector('button')?.focus()
    const keydown = event => {
      if (event.key === 'Escape') setFullscreen(false)
      if (event.key !== 'Tab') return
      const nodes = [...panel.querySelectorAll('button:not(:disabled), input, select, canvas[tabindex]')].filter(node => node.getClientRects().length)
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus() }
  }, [fullscreen])

  function receivePresets(config) {
    defaultsRef.current = config
    setPresets(config.presets)
    sceneRef.current?.setDefaultCamera(config.geospatial.camera)
  }
  function applyPreset(item) {
    const config = item.config
    snapshotRef.current = config
    setModelConfig(config.modelConfig); setModelStation(config.modelConfig.stationId)
    setEnvironment(config.geospatial.environment); setBaseGlassConfig(config.glassConfig)
    setFullscreen(config.geospatial.fullscreen); setTheme(config.geospatial.theme)
    sceneRef.current?.applyState(config.geospatial)
    setSelectedPresetId(item.id)
  }
  const change = (property, value) => setEnvironment(current => ({ ...current, [property]: Number(value) }))
  const presetAction = async (type, id) => {
    if (savingRef.current) return
    savingRef.current = true; setSaving(true); setSaveState('正在写入项目…')
    try {
      let action = { type, id }
      if (type === 'save') {
        if (!sceneRef.current || !status.ready) throw new Error('请等待场景加载完成后保存')
        action = {
          type, id: crypto.randomUUID(),
          name: presetName.trim() || `参数 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
          config: {
            ...snapshotRef.current, glassConfig: baseGlassConfig,
            modelConfig: { ...modelConfig, stationId: modelStation },
            geospatial: { environment, ...sceneRef.current.snapshot(), fullscreen, theme },
          },
        }
      }
      const config = await saveMapPreset(action)
      receivePresets(config)
      if (type === 'select') applyPreset(config.presets.items.find(item => item.id === id))
      if (type === 'save') {
        snapshotRef.current = action.config
        setSelectedPresetId(action.id); setPresetName(''); setPresetsOpen(true)
        setSettingsOpen(false); setModelSettingsOpen(false)
      }
      if (type === 'delete' && !config.presets.items.some(item => item.id === selectedPresetId)) {
        applyPreset(config.presets.items.find(item => item.id === config.presets.defaultId))
      }
      setSaveState({ save: '已新增参数并写入项目', select: '已切换参数并记录到项目', default: '已设为初始默认，刷新后自动加载', delete: '参数已从项目删除' }[type])
    } catch (error) { setSaveState(error.message || '保存失败，请重试') }
    finally { savingRef.current = false; setSaving(false) }
  }
  const togglePresets = async () => {
    if (savingRef.current) return
    setSettingsOpen(false); setModelSettingsOpen(false); setPresetsOpen(value => !value)
    if (!presetsOpen) {
      savingRef.current = true; setSaving(true)
      try { receivePresets(await loadMapConfig()) }
      catch (error) { setSaveState(error.message) }
      finally { savingRef.current = false; setSaving(false) }
    }
  }
  return (
    <section ref={panelRef} className={`digital-twin geospatial-twin${fullscreen ? ' is-page-fullscreen' : ''}`} style={glassCssVariables(glassConfig)} aria-label="雅砻江流域电站数字孪生">
      <div ref={containerRef} className="geospatial-canvas" />
      <div className="geospatial-toolbar">
        <div className="geospatial-title"><span>雅砻江</span><small>流域数字孪生</small></div>
        <div className="geospatial-tools">
          <select aria-label="定位电站" defaultValue="" onChange={event => { sceneRef.current?.focus(event.target.value); event.target.value = '' }}>
            <option value="" disabled>定位电站</option>
            {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
          </select>
          <button type="button" aria-label="初始视角" title="初始视角" onClick={() => sceneRef.current?.overview()}><ArrowCounterClockwise size={17} /></button>
          <button type="button" aria-label="天空与光照" title="天空与光照" aria-expanded={settingsOpen} onClick={() => { setPresetsOpen(false); setModelSettingsOpen(false); setSettingsOpen(value => !value) }}><SlidersHorizontal size={17} /></button>
          <button type="button" aria-label="模型参数" aria-expanded={modelSettingsOpen} onClick={() => { setPresetsOpen(false); setSettingsOpen(false); setModelSettingsOpen(value => !value) }}>模型</button>
          <button type="button" title="新增一套参数并永久写入项目" disabled={!status.ready || saving} onClick={() => presetAction('save')}>保存参数</button>
          <button type="button" aria-label="参数列表" aria-expanded={presetsOpen} disabled={saving} onClick={togglePresets}>参数列表</button>
          <button type="button" aria-label={fullscreen ? '退出网页全屏' : '地图网页全屏'} title={fullscreen ? '退出网页全屏' : '地图网页全屏'} aria-pressed={fullscreen} onClick={() => setFullscreen(value => !value)}>{fullscreen ? <ArrowsIn size={17} /> : <ArrowsOut size={17} />}</button>
        </div>
      </div>
      {settingsOpen ? <div className="geospatial-settings" role="dialog" aria-label="天空与光照" onKeyDown={event => { if (event.key === 'Escape') { setSettingsOpen(false); panelRef.current?.querySelector('[aria-label="天空与光照"]').focus() } }}>
        <p className="scene-parameter-hint">数值可输入 · Shift + 拖动慢速微调</p>
        <SceneParameter label="年内日期" unit="天" min={1} max={365} step={1} fineStep={1} value={environment.dayOfYear} onChange={value => change('dayOfYear', Math.round(value))} />
        <SceneParameter label="云量" unit="%" min={0} max={100} step={1} value={environment.coverage * 100} onChange={value => change('coverage', value / 100)} />
        <SceneParameter label="当地太阳时" unit="时" title="十进制小时，例如 15.5 表示 15:30" min={0} max={24} step={0.1} value={environment.timeOfDay} onChange={value => change('timeOfDay', value)} />
        <SceneParameter label="云底海拔" unit="m" min={750} max={10000} step={50} value={environment.cloudAltitude} onChange={value => change('cloudAltitude', value)} />
        <SceneParameter label="曝光" min={1} max={100} step={0.5} value={environment.exposure} onChange={value => change('exposure', value)} />
        <SceneParameter label="近地薄雾" unit="%" min={0} max={100} step={1} value={environment.haze * 100} onChange={value => change('haze', value / 100)} />
        <SceneParameter label="远景大气透视" unit="%" title="0% 关闭远景雾感，100% 为 Tokyo 原效果，云影不受影响" min={0} max={100} step={1} value={environment.aerialPerspective * 100} onChange={value => change('aerialPerspective', value / 100)} />
        <button type="button" onClick={() => { setEnvironment({ ...DEFAULT_ENVIRONMENT, year: environment.year }); sceneRef.current?.tokyoView() }}>恢复 Tokyo 参数与视角</button>
      </div> : null}
      {modelSettingsOpen ? <form className="geospatial-settings" aria-label="电站模型参数" onSubmit={event => { event.preventDefault(); presetAction('save') }}>
        <label><span>调整电站</span><select aria-label="调整电站" value={modelStation} onChange={event => setModelStation(event.target.value)}>{stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
        <p className="scene-parameter-hint">数值可输入 · Shift + 拖动慢速微调</p>
        <SceneParameter key={modelStation} label="模型高度" unit="m" min={-100000} max={100000} step={100} value={modelConfig.stationElevations[modelStation] ?? modelConfig.elevation} onChange={height => { setModelConfig(current => ({ ...current, stationElevations: { ...current.stationElevations, [modelStation]: height } })); setSaveState('') }} />
        <SceneParameter label="显示比例" ariaLabel="模型显示比例" min={100} max={10000} step={50} value={modelConfig.scale} onChange={scale => { setModelConfig(current => ({ ...current, scale })); setSaveState('') }} />
        <SceneParameter label="水平朝向" ariaLabel="模型水平朝向" unit="°" min={-180} max={180} step={1} value={modelConfig.rotation} onChange={rotation => { setModelConfig(current => ({ ...current, rotation })); setSaveState('') }} />
        <button type="submit" disabled={!status.ready || saving}>另存为新参数</button>
      </form> : null}
      {presetsOpen ? <div className="geospatial-settings geospatial-presets" role="dialog" aria-label="项目参数列表" onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); setPresetsOpen(false); panelRef.current?.querySelector('[aria-label="参数列表"]').focus() }
      }}>
        <div className="geospatial-presets-heading"><strong>参数列表</strong><span>{presets.items.length} 套</span></div>
        <p>每次保存新增一套。刷新后自动加载初始默认参数。</p>
        <form onSubmit={event => { event.preventDefault(); presetAction('save') }}>
          <label htmlFor="scene-preset-name">新参数名称</label>
          <div className="geospatial-preset-create"><input id="scene-preset-name" maxLength={60} placeholder="留空按保存时间命名" value={presetName} onChange={event => setPresetName(event.target.value)} /><button type="submit" disabled={!status.ready || saving}>保存参数</button></div>
        </form>
        <ul aria-label="已保存参数">
          {presets.items.map(item => <li key={item.id} className={selectedPresetId === item.id ? 'is-selected' : ''}>
            <div className="geospatial-preset-title"><strong>{item.name}</strong>{presets.defaultId === item.id ? <span>初始默认</span> : null}{selectedPresetId === item.id ? <span>已载入</span> : null}</div>
            <small>云量 {Math.round(item.config.geospatial.environment.coverage * 100)}% · 曝光 {item.config.geospatial.environment.exposure} · 比例 {item.config.modelConfig.scale}</small>
            <div className="geospatial-preset-actions">
              <button type="button" aria-label={`切换到${item.name}`} disabled={!status.ready || saving} onClick={() => presetAction('select', item.id)}>载入</button>
              <button type="button" aria-label={`将${item.name}设为初始默认`} disabled={saving || presets.defaultId === item.id} onClick={() => presetAction('default', item.id)}>设为初始默认</button>
              <button type="button" aria-label={`删除${item.name}`} disabled={saving || presets.items.length === 1} title={presets.items.length === 1 ? '至少保留一套参数' : '从项目删除这套参数'} onClick={() => presetAction('delete', item.id)}>删除</button>
            </div>
          </li>)}
        </ul>
      </div> : null}
      {saveState ? <div className="geospatial-save-state" role="status">{saveState}</div> : null}
      <div className="map-station-layer">
        {stations.map(station => <div className="map-station-anchor" key={station.id} ref={node => { if (node) markerRefs.current.set(station.id, node); else markerRefs.current.delete(station.id) }}>
          <StationDetail station={station} onSelect={() => sceneRef.current?.focus(station.id)} onEnter={() => navigate(`/station/${station.id}`)} />
        </div>)}
      </div>
      {!status.ready ? <div className="geospatial-status" role="status">
        {status.message ? <><TriangleAlert size={18} /><span>{status.message}</span><button type="button" onClick={() => setAttempt(value => value + 1)}>重试</button></> : <><i /><span>正在加载三维地形与天空…</span></>}
      </div> : null}
      <div className="geospatial-attribution" ref={attributionRef}>Google Maps</div>
    </section>
  )
}
