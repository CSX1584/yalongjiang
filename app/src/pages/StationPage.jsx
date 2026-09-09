import { useNavigate, useParams } from 'react-router-dom'
import {
  ActivityIcon as Activity,
  ArrowLeft,
  Cube as Box,
  CaretRight as ChevronRight,
  CloudSun,
  Crosshair as LocateFixed,
  MapPin,
  Sun,
  ThermometerHot as ThermometerSun,
  Lightning as Zap,
} from '@phosphor-icons/react'
import {
  DEFAULT_ENVIRONMENT,
  SolarPlantMonitor,
} from 'solar-plant-monitor-embed'
import { useApp } from '../context/AppContext'
import { stations } from '../data/demoData'
import solarPlantDocuments from '../data/solar-plant-scene-2026-08-20.json'

function metricEntries(station) {
  if (Array.isArray(station.metrics)) return station.metrics.slice(0, 4)
  const metrics = station.metrics ?? {}
  const power = station.output ?? metrics.power ?? metrics.activePower ?? '418.6'
  const generation = metrics.dailyGeneration ?? metrics.generation ?? metrics.todayGeneration ?? '2,846'
  const availability = station.availability ?? metrics.availability ?? '98.7'
  return [
    { label: '实时功率', value: power, unit: /[a-z]/i.test(String(power)) ? '' : 'MW', tone: 'green' },
    { label: '今日发电', value: generation, unit: /[a-z]/i.test(String(generation)) ? '' : 'MWh' },
    { label: '设备可用率', value: availability, unit: String(availability).includes('%') ? '' : '%' },
    { label: '综合健康度', value: station.health ?? metrics.health ?? '91', unit: '分', tone: 'blue' },
  ]
}

function isNormalStatus(status) {
  return ['normal', 'online', '正常', '在线'].includes(status)
}

function weatherLabel(weather) {
  if (!weather || typeof weather !== 'object') return weather || '多云 18℃'
  return [weather.condition, weather.temperature, weather.irradiance].filter(Boolean).join(' · ')
}

function coordinatesLabel(coordinates) {
  if (!Array.isArray(coordinates)) return coordinates || '坐标未录入'
  return `${coordinates[0]}°N · ${coordinates[1]}°E`
}

export default function StationPage() {
  const { theme } = useApp()
  const navigate = useNavigate()
  const { stationId } = useParams()
  const station = stations.find((item) => item.id === stationId) ?? stations[0]
  const devices = station?.devices ?? []
  const selectedDevice = devices[0]

  if (!station) return null

  const openDevice = (device) => navigate(`/station/${station.id}/device/${device.id}`)

  return (
    <div className="ops-page station-page">
      <header className="page-toolbar station-toolbar">
        <button className="icon-button" type="button" onClick={() => navigate('/')} title="返回驾驶舱">
          <ArrowLeft size={18} />
        </button>
        <div className="page-heading">
          <div className="title-line">
            <h1>{station.name}</h1>
            <span className={`status-badge ${isNormalStatus(station.status) ? 'success' : 'warning'}`}>
              <span className="status-dot" />{station.statusLabel ?? (isNormalStatus(station.status) ? '运行正常' : '存在预警')}
            </span>
          </div>
          <p><MapPin size={12} />{station.location} · {station.capacity} · {station.type}</p>
        </div>
        <label className="station-select">
          <span>切换场站</span>
          <select value={station.id} onChange={(event) => navigate(`/station/${event.target.value}`)}>
            {stations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </header>

      <main className="station-workspace">
        <section className="station-scene">
          <div className="scene-meta">
            <span><LocateFixed size={13} />{coordinatesLabel(station.coordinates)}</span>
            <span><CloudSun size={13} />{weatherLabel(station.weather)}</span>
            <span>数据更新 16:48:32</span>
          </div>

          <div className="station-monitor">
            <SolarPlantMonitor
              documents={solarPlantDocuments}
              deviceStatuses={null}
              environment={DEFAULT_ENVIRONMENT}
              performanceMode
              theme={theme}
            />
          </div>
        </section>
      </main>

      <footer className="station-metrics">
        {metricEntries(station).map((metric, index) => (
          <article key={metric.id ?? metric.label}>
            <span className={`metric-symbol ${metric.tone ?? ''}`}>
              {index === 0 ? <Sun size={18} /> : index === 1 ? <Zap size={18} /> : index === 2 ? <Activity size={18} /> : <ThermometerSun size={18} />}
            </span>
            <div><span>{metric.label}</span><p><strong>{metric.value}</strong><small>{metric.unit}</small></p></div>
          </article>
        ))}
        <button className="station-overview-link" type="button" onClick={() => selectedDevice && openDevice(selectedDevice)}>
          <Box size={18} /><span>当前设备<strong>{selectedDevice?.name ?? '选择设备'}</strong></span><ChevronRight size={16} />
        </button>
      </footer>
    </div>
  )
}
