import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, Pause } from '@phosphor-icons/react'

/**
 * AI 智能体聚合主图：12列×5行固定语义网格，节点坐标写死不做自动布局
 */

// 网格几何常量
const COLS = 12
const ROWS = 5
const COL_W = 110
const ROW_H = 102
const PAD = 24
const NODE_W = 148
const NODE_H = 96
const CANVAS_W = COLS * COL_W + PAD * 2
const CANVAS_H = ROWS * ROW_H + PAD * 2

// 节点状态机 → 视觉映射
const STATUS_META = {
  running: { label: '运行', color: 'var(--ops-photovoltaic)' },
  degraded: { label: '降级', color: 'var(--ops-warning)' },
  error: { label: '异常', color: 'var(--ops-urgent)' },
  offline: { label: '离线', color: 'var(--ops-text-tertiary)' },
  paused: { label: '停用', color: '#8b9cc0' },
}

// 节点配置：第1-2列触发源，第3-9列行2主干处置链，第10-12列终态归档
const NODES = [
  { id: 'alarm', name: '告警中心', col: 1, row: 2, status: 'running', queue: 8, rate: 99, spark: [98, 99, 97, 99, 100, 99] },
  { id: 'timer', name: '定时触发', col: 1, row: 3, status: 'paused', queue: null, rate: null, spark: null },
  { id: 'patrol', name: '巡检Agent', col: 1, row: 4, status: 'running', queue: 2, rate: 97, spark: [95, 96, 98, 97, 97, 98] },
  { id: 'diag', name: '诊断Agent', col: 3, row: 2, status: 'running', queue: 12, rate: 96, parallel: 3, spark: [93, 95, 94, 96, 97, 96] },
  { id: 'dispatch', name: '派单Agent', col: 5, row: 2, status: 'running', queue: 5, rate: 98, spark: [97, 98, 99, 98, 98, 99] },
  { id: 'exec', name: '执行Agent', col: 7, row: 2, status: 'running', queue: 3, rate: 94, spark: [92, 93, 95, 94, 93, 94] },
  { id: 'verify', name: '验证Agent', col: 9, row: 2, status: 'degraded', queue: 2, rate: 89, spark: [95, 93, 91, 90, 88, 89] },
  { id: 'knowledge', name: '知识沉淀', col: 11, row: 3, rowSpan: 2, status: 'running', queue: 1284, queueLabel: '累计案例', rate: null, today: '+6', spark: null },
]

// 行3旁路走廊 / 行4返工走廊 / 行5订阅走廊的 Y 坐标
const BYPASS_Y = PAD + 2 * ROW_H + ROW_H / 2 + 26
const REWORK_Y = PAD + 3 * ROW_H + ROW_H / 2 + 26
const SUB_Y = PAD + 4 * ROW_H + ROW_H / 2

const boxOf = (node) => ({
  x: PAD + (node.col - 1) * COL_W + (COL_W - NODE_W) / 2,
  y: PAD + (node.row - 1) * ROW_H + (ROW_H - NODE_H) / 2,
  w: NODE_W,
  h: NODE_H + ((node.rowSpan ?? 1) - 1) * ROW_H,
})

const BOX = Object.fromEntries(NODES.map((node) => [node.id, boxOf(node)]))
const cx = (b) => b.x + b.w / 2
const left = (b, dy = 0) => ({ x: b.x, y: b.y + b.h / 2 + dy })
const right = (b, dy = 0) => ({ x: b.x + b.w, y: b.y + b.h / 2 + dy })
const top = (b) => ({ x: cx(b), y: b.y })
const bottom = (b) => ({ x: cx(b), y: b.y + b.h })

// 边配置：实线主干 + 旁路 + 返工回路 + 事件订阅虚线，各占专用走廊不穿越节点
const buildEdges = () => {
  const a = BOX.alarm
  const t = BOX.timer
  const p = BOX.patrol
  const d = BOX.diag
  const dp = BOX.dispatch
  const e = BOX.exec
  const v = BOX.verify
  const k = BOX.knowledge

  const alarmOut = right(a)
  const diagInTop = left(d, -12)
  const timerOut = right(t)
  const diagInLow = left(d, 12)
  const verifyOut = bottom(v)
  const knowIn = left(k)
  const diagDown = bottom(d)
  const execInLow = bottom(e)
  const execInTop = top(e)
  const patrolDown = bottom(p)
  const knowInLow = bottom(k)

  return [
    // 告警中心 → 诊断（行2主干入口）
    { id: 'e-alarm', d: `M ${alarmOut.x} ${alarmOut.y} L ${diagInTop.x} ${diagInTop.y}` },
    // 定时触发 → 诊断（行3肘形上行）
    {
      id: 'e-timer',
      d: `M ${timerOut.x} ${timerOut.y} L ${diagInLow.x - 26} ${timerOut.y} L ${diagInLow.x - 26} ${diagInLow.y} L ${diagInLow.x} ${diagInLow.y}`,
    },
    // 诊断 ⇒ 派单（双实线主干）
    { id: 'e-diag-1', d: `M ${right(d).x} ${right(d).y - 3} L ${left(dp).x} ${left(dp).y - 3}`, noArrow: true },
    { id: 'e-diag-2', d: `M ${right(d).x} ${right(d).y + 3} L ${left(dp).x} ${left(dp).y + 3}` },
    // 派单 → 执行（带两票审批锁）
    { id: 'e-dispatch', d: `M ${right(dp).x} ${right(dp).y} L ${left(e).x} ${left(e).y}` },
    // 执行 → 验证
    { id: 'e-exec', d: `M ${right(e).x} ${right(e).y} L ${left(v).x} ${left(v).y}` },
    // 验证 → 知识沉淀（行3肘形入终态）
    { id: 'e-verify', d: `M ${verifyOut.x} ${verifyOut.y} L ${verifyOut.x} ${knowIn.y} L ${knowIn.x} ${knowIn.y}` },
    // 行3旁路：诊断 → 执行（简单故障 conf>95% 直达）
    {
      id: 'e-bypass',
      d: `M ${diagDown.x} ${diagDown.y} L ${diagDown.x} ${BYPASS_Y} L ${execInLow.x} ${BYPASS_Y} L ${execInLow.x} ${execInLow.y}`,
      label: { text: '简单故障 conf>95%', x: (diagDown.x + execInLow.x) / 2, y: BYPASS_Y - 10 },
    },
    // 行4返工回路：验证 → 执行（反向弧线走廊）
    {
      id: 'e-rework',
      d: `M ${verifyOut.x - 24} ${verifyOut.y} L ${verifyOut.x - 24} ${REWORK_Y} L ${execInTop.x} ${REWORK_Y} L ${execInTop.x} ${execInTop.y}`,
      label: { text: '返工回路 · 今日 1', x: (execInTop.x + verifyOut.x - 24) / 2, y: REWORK_Y + 6 },
    },
    // 行5事件订阅虚线层：巡检Agent → 知识沉淀（默认淡化）
    {
      id: 'e-sub',
      d: `M ${patrolDown.x} ${patrolDown.y} L ${patrolDown.x} ${SUB_Y} L ${knowInLow.x} ${SUB_Y} L ${knowInLow.x} ${knowInLow.y}`,
      dashed: true,
      label: { text: '事件订阅 · 广播层', x: (patrolDown.x + knowInLow.x) / 2, y: SUB_Y + 6 },
    },
  ]
}

const EDGES = buildEdges()

// 两票审批锁：派单→执行边中点
const LOCK_POS = (() => {
  const dp = BOX.dispatch
  const e = BOX.exec
  return { x: (right(dp).x + left(e).x) / 2, y: right(dp).y }
})()

// 行1并行角标悬浮层：诊断节点上方
const PARALLEL_POS = (() => {
  const d = BOX.diag
  return { x: cx(d), y: PAD + 8, targetY: top(d).y }
})()

// ============ 任务令牌流水线 ============
// 路由表：主干全链 / 简单故障旁路 / 验证返工回路
const ROUTES = {
  main: ['e-alarm', 'e-diag-2', 'e-dispatch', 'e-exec', 'e-verify'],
  bypass: ['e-alarm', 'e-bypass', 'e-exec', 'e-verify'],
  rework: ['e-alarm', 'e-diag-2', 'e-dispatch', 'e-exec', 'e-rework', 'e-exec', 'e-verify'],
}

// 边的起止节点：推导令牌停留时哪个节点进入处理态
const EDGE_LINK = {
  'e-alarm': ['alarm', 'diag'],
  'e-timer': ['timer', 'diag'],
  'e-diag-1': ['diag', 'dispatch'],
  'e-diag-2': ['diag', 'dispatch'],
  'e-dispatch': ['dispatch', 'exec'],
  'e-exec': ['exec', 'verify'],
  'e-verify': ['verify', 'knowledge'],
  'e-bypass': ['diag', 'exec'],
  'e-rework': ['verify', 'exec'],
}

// 长廊道适当放慢滑行时长（秒），未列出的边默认 1s
const EDGE_DUR = { 'e-verify': 1.5, 'e-bypass': 1.7, 'e-rework': 1.7 }
const DWELL_MS = 700
const SPAWN_MS = 3800
const MAX_TOKENS = 3
const pickRoute = (n) => (n % 5 === 4 ? ROUTES.rework : n % 3 === 2 ? ROUTES.bypass : ROUTES.main)

/**
 * 近6h成功率微型趋势
 */
function Sparkline({ data, color }) {
  const w = 44
  const h = 14
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`)
    .join(' ')
  return (
    <svg className="agent-flow__spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 任务令牌：dwell 时被节点吸收（不渲染，节点泛光），travel 时沿当前边滑行
 */
function FlowToken({ token, onDepart, onTravelEnd, onAbsorb }) {
  const motionRef = useRef(null)
  const traveling = token.phase === 'travel'
  const edgeId = traveling ? token.route[token.step] : null

  // 节点内停留：首站是发料闪烁，末站被知识沉淀吸收后销毁
  useEffect(() => {
    if (token.phase !== 'dwell') return
    const timer = setTimeout(() => {
      if (token.step >= token.route.length) onAbsorb(token.key)
      else onDepart(token.key)
    }, DWELL_MS)
    return () => clearTimeout(timer)
  }, [token.phase, token.step, token.key, token.route.length, onDepart, onAbsorb])

  // SMIL 动画结束 = 令牌到达下一节点
  useEffect(() => {
    const el = motionRef.current
    if (!el || !traveling) return
    const handleEnd = () => onTravelEnd(token.key)
    el.addEventListener('endEvent', handleEnd)
    return () => el.removeEventListener('endEvent', handleEnd)
  }, [traveling, token.step, token.key, onTravelEnd])

  if (!traveling) return null

  return (
    <g key={`${token.key}:${token.step}`} className="agent-flow__token">
      <animateMotion ref={motionRef} dur={`${EDGE_DUR[edgeId] ?? 1}s`} repeatCount="1" rotate="0">
        <mpath href={`#${edgeId}`} />
      </animateMotion>
      <circle r="4" className="agent-flow__token-dot" />
      <text y="-10" className="agent-flow__token-label">
        {token.label}
      </text>
    </g>
  )
}

function FlowNode({ node, processing }) {
  const meta = STATUS_META[node.status]
  const box = BOX[node.id]
  return (
    <div
      className={`agent-flow__node is-${node.status}${processing ? ' is-processing' : ''}`}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <div className="agent-flow__node-head">
        <span className="agent-flow__lamp" style={{ background: meta.color }} aria-hidden="true" />
        <span className="agent-flow__node-name">{node.name}</span>
        {node.parallel ? <span className="agent-flow__parallel">⇉{node.parallel}</span> : null}
      </div>
      {node.status === 'paused' ? (
        <div className="agent-flow__paused">
          <Pause size={18} aria-hidden="true" />
          <span>人工停用</span>
        </div>
      ) : (
        <>
          <div className="agent-flow__queue">{node.queue}</div>
          {node.queueLabel ? <div className="agent-flow__queue-label">{node.queueLabel} · 今日 {node.today}</div> : null}
          {node.rate != null ? (
            <div className="agent-flow__node-foot">
              <span>成功率 {node.rate}%</span>
              <Sparkline data={node.spark} color={meta.color} />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default function AgentPage() {
  const scrollRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [tokens, setTokens] = useState([])
  const [absorbed, setAbsorbed] = useState(0)
  const spawnRef = useRef(0)

  // 令牌流水线：按节奏从告警中心吐新任务，最多 3 枚并发（呼应"⇉并行3路"角标）
  useEffect(() => {
    const spawn = () => {
      const n = spawnRef.current++
      setTokens((ts) =>
        ts.length >= MAX_TOKENS
          ? ts
          : [...ts, { key: `token-${n}`, label: `#D-${1024 + n}`, route: pickRoute(n), step: 0, phase: 'dwell' }],
      )
    }
    spawn()
    const timer = setInterval(spawn, SPAWN_MS)
    return () => clearInterval(timer)
  }, [])

  const handleDepart = useCallback((key) => {
    setTokens((ts) => ts.map((t) => (t.key === key ? { ...t, phase: 'travel' } : t)))
  }, [])

  const handleTravelEnd = useCallback((key) => {
    setTokens((ts) => ts.map((t) => (t.key === key ? { ...t, step: t.step + 1, phase: 'dwell' } : t)))
  }, [])

  const handleAbsorb = useCallback((key) => {
    setTokens((ts) => ts.filter((t) => t.key !== key))
    setAbsorbed((a) => a + 1)
  }, [])

  // 令牌位置 → 连线高亮与节点处理态的唯一事实源
  const activeEdges = new Set()
  const busyNodes = new Set()
  for (const t of tokens) {
    if (t.phase === 'travel') activeEdges.add(t.route[t.step])
    else busyNodes.add(t.step === 0 ? EDGE_LINK[t.route[0]][0] : EDGE_LINK[t.route[t.step - 1]][1])
  }

  // 画布过宽时整体等比缩小，保证主图一屏看全
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / CANVAS_W))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="agent-flow">
      <header className="agent-flow__header">
        <div>
          <p className="agent-flow__eyebrow">AI AGENT · ORCHESTRATION</p>
          <h1>智能体聚合主图</h1>
        </div>
        <ul className="agent-flow__legend">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <li key={key}>
              <span className="agent-flow__lamp" style={{ background: meta.color }} aria-hidden="true" />
              {meta.label}
            </li>
          ))}
        </ul>
      </header>

      <div className="agent-flow__scroll" ref={scrollRef}>
        <div className="agent-flow__fit" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
          <div
            className="agent-flow__canvas"
            style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
          >
          <svg className="agent-flow__edges" width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} aria-hidden="true">
            <defs>
              <marker id="agent-flow-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(210, 222, 226, 0.55)" />
              </marker>
              <marker id="agent-flow-arrow-dim" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(210, 222, 226, 0.28)" />
              </marker>
            </defs>
            {EDGES.map((edge) => (
              <path
                key={edge.id}
                id={edge.id}
                d={edge.d}
                className={`agent-flow__edge${edge.dashed ? ' is-dashed' : ''}${activeEdges.has(edge.id) ? ' is-active' : ''}`}
                markerEnd={edge.noArrow ? undefined : edge.dashed ? 'url(#agent-flow-arrow-dim)' : 'url(#agent-flow-arrow)'}
              />
            ))}
            {/* 任务令牌流水线：多令牌并发沿各自路由流转，体现任务在智能体间接力 */}
            {tokens.map((token) => (
              <FlowToken
                key={token.key}
                token={token}
                onDepart={handleDepart}
                onTravelEnd={handleTravelEnd}
                onAbsorb={handleAbsorb}
              />
            ))}
            {/* 并行角标悬浮层 → 诊断节点的点线连接 */}
            <line
              x1={PARALLEL_POS.x}
              y1={PARALLEL_POS.y + 22}
              x2={PARALLEL_POS.x}
              y2={PARALLEL_POS.targetY}
              className="agent-flow__edge is-dashed"
            />
          </svg>

          {/* 行1并行角标悬浮层 */}
          <div className="agent-flow__parallel-strip" style={{ left: PARALLEL_POS.x - 66, top: PARALLEL_POS.y }}>
            <span>⇉ 并行 3 路</span>
            <i>#D-1024</i>
            <i>#D-1025</i>
            <i>#D-1026</i>
          </div>

          {/* 两票审批锁 */}
          <span className="agent-flow__lock" style={{ left: LOCK_POS.x - 9, top: LOCK_POS.y - 9 }} title="两票审批">
            <Lock size={12} aria-hidden="true" />
          </span>

          {EDGES.filter((edge) => edge.label).map((edge) => (
            <span
              key={`${edge.id}-label`}
              className={`agent-flow__edge-label${edge.dashed ? ' is-dim' : ''}`}
              style={{ left: edge.label.x, top: edge.label.y }}
            >
              {edge.label.text}
            </span>
          ))}

          {NODES.map((node) => (
            <FlowNode
              key={node.id}
              node={node.id === 'knowledge' ? { ...node, queue: node.queue + absorbed } : node}
              processing={busyNodes.has(node.id)}
            />
          ))}
          </div>
        </div>
      </div>
    </div>
  )
}
