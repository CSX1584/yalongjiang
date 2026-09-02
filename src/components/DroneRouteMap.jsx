import { useEffect, useMemo, useRef, useState } from 'react'

const VIEW_W = 640
const VIEW_H = 330
const TAKEOFF = { x: 76, y: 278 }

// 按电站类型划分俯视图区域：光伏区必有，储能/风电按电站类型追加
function zonesFor(station) {
  const type = String(station?.type ?? '')
  const hasEss = type.includes('储能')
  const hasWind = type.includes('风')
  const zones = []
  let cursor = 28
  const reserved = (hasEss ? 120 : 0) + (hasWind ? 120 : 0)
  zones.push({ id: 'pv', label: '光伏区', x: cursor, y: 40, w: VIEW_W - 56 - reserved, h: 200, tint: 'rgba(55,162,255,0.08)' })
  cursor += zones[0].w + 12
  if (hasEss) {
    zones.push({ id: 'ess', label: '储能区', x: cursor, y: 40, w: 108, h: 200, tint: 'rgba(16,224,102,0.08)' })
    cursor += 108 + 12
  }
  if (hasWind) {
    zones.push({ id: 'wind', label: '风电区', x: cursor, y: 40, w: VIEW_W - 28 - cursor, h: 200, tint: 'rgba(141,108,229,0.10)' })
  }
  return zones
}

// 航点名称归类到区域，区域不存在时回落到光伏区
function zoneOf(name, zones) {
  const value = String(name ?? '')
  let id = 'pv'
  if (value.includes('储能') || value.toUpperCase().includes('ESS')) id = 'ess'
  else if (value.includes('风机')) id = 'wind'
  return zones.some((zone) => zone.id === id) ? id : 'pv'
}

// 中间航点（去掉起飞点/返航点）按区域网格布点
function placeWaypoints(zones, names) {
  const groups = new Map()
  names.forEach((name, index) => {
    const zoneId = zoneOf(name, zones)
    if (!groups.has(zoneId)) groups.set(zoneId, [])
    groups.get(zoneId).push({ name, index })
  })
  const points = []
  zones.forEach((zone) => {
    const items = groups.get(zone.id) ?? []
    const cols = Math.min(2, Math.max(1, items.length))
    const rows = Math.ceil(items.length / cols)
    items.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      points[item.index] = {
        x: zone.x + (zone.w * (col + 1)) / (cols + 1),
        y: zone.y + (zone.h * (row + 1)) / (rows + 1),
        name: item.name,
      }
    })
  })
  return points
}

/**
 * 电站俯视图无人机航线：光伏/储能/风电分区俯视示意，
 * mode = 'plan' 静态路线方案；mode = 'collect' 无人机沿航线飞行动画，完成后回调 onDone
 */
export default function DroneRouteMap({ station, route, mode = 'plan', onDone }) {
  const animated = mode === 'collect'
  const waypointNames = useMemo(
    () => (Array.isArray(route?.waypoints) ? route.waypoints.slice(1, -1) : []),
    [route],
  )
  const zones = useMemo(() => zonesFor(station), [station])
  const waypoints = useMemo(() => placeWaypoints(zones, waypointNames), [zones, waypointNames])

  // 航线：站控楼起飞 → 依次经过航点 → 返航降落
  const path = useMemo(() => {
    const pts = [TAKEOFF, ...waypoints.filter(Boolean), TAKEOFF]
    const segs = []
    let total = 0
    for (let i = 0; i < pts.length - 1; i += 1) {
      const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
      segs.push({ from: pts[i], to: pts[i + 1], start: total, len })
      total += len
    }
    return { pts, segs, total }
  }, [waypoints])

  const [distance, setDistance] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!animated || !path.total) return undefined
    doneRef.current = false
    setDistance(0)
    const duration = Math.min(9000, Math.max(3200, 1600 + waypoints.length * 900))
    let raf = 0
    const startedAt = performance.now()
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      setDistance(path.total * progress)
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else if (!doneRef.current) {
        doneRef.current = true
        onDone?.()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animated, path, waypoints.length, onDone])

  // 按飞行里程插值无人机位置与航向
  const drone = useMemo(() => {
    if (!animated) return { ...TAKEOFF, angle: -45 }
    const seg = path.segs.find((item) => distance <= item.start + item.len) ?? path.segs[path.segs.length - 1]
    if (!seg || !seg.len) return { ...TAKEOFF, angle: -45 }
    const ratio = Math.min(1, Math.max(0, (distance - seg.start) / seg.len))
    return {
      x: seg.from.x + (seg.to.x - seg.from.x) * ratio,
      y: seg.from.y + (seg.to.y - seg.from.y) * ratio,
      angle: (Math.atan2(seg.to.y - seg.from.y, seg.to.x - seg.from.x) * 180) / Math.PI,
    }
  }, [animated, distance, path])

  const isPassed = (index) => {
    if (!animated) return false
    const reach = path.segs[index] ? path.segs[index].start + path.segs[index].len : path.total
    return distance >= reach - 0.5
  }

  const pathPoints = path.pts.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="drone-map" aria-label={`${station?.shortName ?? '电站'}无人机巡检航线俯视图`}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img">
        <defs>
          <pattern id="drone-map-pv-grid" width="22" height="14" patternUnits="userSpaceOnUse">
            <rect width="20" height="12" rx="1.5" fill="rgba(55,162,255,0.14)" />
          </pattern>
        </defs>

        {zones.map((zone) => (
          <g key={zone.id}>
            <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx="10" fill={zone.tint} stroke="rgba(120,170,230,0.25)" strokeDasharray="5 4" />
            {zone.id === 'pv' && <rect x={zone.x + 10} y={zone.y + 26} width={zone.w - 20} height={zone.h - 40} rx="6" fill="url(#drone-map-pv-grid)" opacity="0.5" />}
            <text x={zone.x + 12} y={zone.y + 18} className="drone-map__zone-label">{zone.label}</text>
          </g>
        ))}

        <polyline points={pathPoints} fill="none" stroke="rgba(55,162,255,0.55)" strokeWidth="1.6" strokeDasharray="6 5" strokeLinejoin="round" />
        {animated && distance > 0 && (
          <polyline
            points={pathPoints}
            fill="none"
            stroke="#37a2ff"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeDasharray={path.total}
            strokeDashoffset={Math.max(0, path.total - distance)}
          />
        )}

        <g transform={`translate(${TAKEOFF.x}, ${TAKEOFF.y})`}>
          <rect x="-13" y="-10" width="26" height="20" rx="4" fill="rgba(255,205,13,0.16)" stroke="rgba(255,205,13,0.6)" />
          <text x="0" y="30" textAnchor="middle" className="drone-map__takeoff-label">站控楼 · 起降点</text>
        </g>

        {waypoints.map((point, index) => (
          <g key={`${point.name}-${index}`} transform={`translate(${point.x}, ${point.y})`}>
            <circle r="7" fill={isPassed(index) ? 'rgba(16,224,102,0.9)' : 'rgba(12,22,38,0.9)'} stroke={isPassed(index) ? '#10e066' : 'rgba(120,170,230,0.55)'} strokeWidth="1.5" />
            {isPassed(index) ? (
              <path d="M-3.2 0.2 L-1 2.6 L3.4 -2.4" fill="none" stroke="#04140a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <circle r="2.2" fill="rgba(120,170,230,0.8)" />
            )}
            <text y="20" textAnchor="middle" className="drone-map__wp-label">{point.name}</text>
          </g>
        ))}

        {animated && (
          <g transform={`translate(${drone.x}, ${drone.y}) rotate(${drone.angle})`} className="drone-map__drone is-flying">
          <circle r="12" fill="rgba(55,162,255,0.18)" />
          <circle r="5" fill="#37a2ff" stroke="#bfe0ff" strokeWidth="1.2" />
          <line x1="-10" y1="-8" x2="10" y2="8" stroke="#bfe0ff" strokeWidth="1.4" />
          <line x1="-10" y1="8" x2="10" y2="-8" stroke="#bfe0ff" strokeWidth="1.4" />
          <circle cx="-10" cy="-8" r="2.4" fill="none" stroke="#bfe0ff" strokeWidth="1.1" />
          <circle cx="10" cy="8" r="2.4" fill="none" stroke="#bfe0ff" strokeWidth="1.1" />
          <circle cx="-10" cy="8" r="2.4" fill="none" stroke="#bfe0ff" strokeWidth="1.1" />
          <circle cx="10" cy="-8" r="2.4" fill="none" stroke="#bfe0ff" strokeWidth="1.1" />
        </g>
        )}
      </svg>
    </div>
  )
}
