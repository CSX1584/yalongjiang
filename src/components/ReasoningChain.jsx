import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CaretDown, GitBranch } from '@phosphor-icons/react'

// 扎拉山 #7方阵 组串反灌 · 各列推理节点（列与合并流程 8 步一一对应，节点卡只保留标题）
// track：故障诊断列三轨（左证据 / 中结论 / 右缺陷单）；工单核定列左轨为输入条件、右轨为工单
const CHAIN_NODES = {
  diagnose: [
    { id: 'd-e1', title: '反灌告警 12 次', tone: 'evidence', track: 'left' },
    { id: 'd-e2', title: '早晚时段占 71%', tone: 'evidence', track: 'left' },
    { id: 'd-e3', title: '防反压降 0.82V', tone: 'evidence', track: 'left' },
    { id: 'd-e5', title: '回路损耗 1.9 倍', tone: 'evidence', track: 'left' },
    { id: 'd-e6', title: '日发电损耗 1.8%', tone: 'evidence', track: 'left' },
    { id: 'd-c1', title: '防反二极管击穿', tone: 'ok', mark: '✓', track: 'middle' },
    { id: 'd-c2', title: '组串极性接反', tone: 'reject', mark: '✗', track: 'middle' },
    { id: 'd-c3', title: '组件 PID 衰减', tone: 'reject', mark: '✗', track: 'middle' },
    { id: 'd-c4', title: '采集模块故障', tone: 'reject', mark: '✗', track: 'middle' },
    { id: 'd-defect', title: '缺陷单', tone: 'info', track: 'right' },
  ],
  'work-order-approval': [
    { id: 'd-sched', title: '排程窗口', tone: 'info', track: 'left' },
    { id: 'd-skill', title: '人员技能', tone: 'info', track: 'left' },
    { id: 'd-sev', title: '严重等级', tone: 'info', track: 'left' },
    { id: 'd-order', title: '工单', tone: 'info', track: 'right' },
  ],
  'permit-request': [
    { id: 'd-wp', title: '工作票', tone: 'info' },
    { id: 'd-op', title: '操作票', tone: 'info' },
  ],
  'permit-approval': [
    { id: 'd-wp-ok', title: '工作票', tone: 'ok', mark: '✓' },
    { id: 'd-op-ok', title: '操作票', tone: 'ok', mark: '✓' },
  ],
  execute: [
    { id: 'd-x1', title: '停电验电', tone: 'info' },
    { id: 'd-x2', title: '更换防反二极管', tone: 'info' },
    { id: 'd-x3', title: '复测送电', tone: 'info' },
  ],
  validate: [
    { id: 'd-v1', title: '电流回正', tone: 'ok', mark: '✓' },
    { id: 'd-v2', title: '热斑消失', tone: 'ok', mark: '✓' },
  ],
  close: [
    { id: 'd-f1', title: '工时 2h · 备件 1 只', tone: 'info' },
  ],
  learn: [
    { id: 'd-l1', title: '案例库条目', tone: 'info' },
    { id: 'd-l2', title: '策略更新', tone: 'info' },
  ],
}

const CHAIN_EDGES = [
  // 确诊根因汇聚全部 5 项证据；三个排除项与证据多对多对应，置信度低
  ['d-e1', 'd-c1'], ['d-e2', 'd-c1'], ['d-e3', 'd-c1'], ['d-e5', 'd-c1'], ['d-e6', 'd-c1'],
  ['d-e1', 'd-c2'], ['d-e2', 'd-c2'],
  ['d-e2', 'd-c3'], ['d-e3', 'd-c3'],
  ['d-e1', 'd-c4'], ['d-e5', 'd-c4'],
  ['d-c1', 'd-defect'],
  ['d-defect', 'd-order'],
  ['d-sched', 'd-order'], ['d-skill', 'd-order'], ['d-sev', 'd-order'],
  ['d-order', 'd-wp'], ['d-order', 'd-op'],
  ['d-wp', 'd-wp-ok'], ['d-op', 'd-op-ok'],
  ['d-wp-ok', 'd-x1'], ['d-op-ok', 'd-x1'],
  ['d-x1', 'd-x2'], ['d-x2', 'd-x3'],
  ['d-x3', 'd-v1'], ['d-x3', 'd-v2'],
  ['d-v1', 'd-f1'], ['d-v2', 'd-f1'],
  ['d-f1', 'd-l1'], ['d-f1', 'd-l2'],
]

// 轨道顺序：左 / 中 / 右，节点未标轨道时归入右轨
const TRACK_ORDER = ['left', 'middle', 'right']

// 节点 → 所属步骤 id / 节点本体，用于定位列、连线锚点与对话胶囊联动
const NODE_STEP = {}
const NODE_LOOKUP = {}
Object.entries(CHAIN_NODES).forEach(([stepId, nodes]) => {
  nodes.forEach((node) => {
    NODE_STEP[node.id] = stepId
    NODE_LOOKUP[node.id] = node
  })
})

export const REASONING_NODE_STEP = NODE_STEP
export const REASONING_NODE_LOOKUP = NODE_LOOKUP

function edgePath(a, b, vertical) {
  if (vertical) {
    const dir = b.y > a.y ? 1 : -1
    const dy = Math.max(20, Math.abs(b.y - a.y) / 2)
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy * dir}, ${b.x} ${b.y - dy * dir}, ${b.x} ${b.y}`
  }
  const dx = Math.max(28, Math.abs(b.x - a.x) / 2)
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
}

/**
 * AI 推理链：横向思维导图，列随工单流程推进逐列解锁
 */
export default function ReasoningChain({
  steps,
  currentStep,
  selectedStep,
  completed,
  onSelect,
  focusNode,
  initialOpen = false,
}) {
  const canvasRef = useRef(null)
  const colRefs = useRef(new Map())
  const nodeRefs = useRef(new Map())
  const [paths, setPaths] = useState([])
  const [hoverId, setHoverId] = useState('')
  const [flashId, setFlashId] = useState('')
  // 整条推理链默认收起，点击顶栏展开
  const [open, setOpen] = useState(initialOpen)

  // 推进步骤后把当前列滚进可视区（收起态不滚动）
  useLayoutEffect(() => {
    if (!open) return
    colRefs.current.get(currentStep)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [currentStep, open])

  // 对话胶囊联动：收起时先展开，节点滚进可视区并短暂脉冲高亮
  useEffect(() => {
    if (!focusNode?.nodeId) return undefined
    setOpen(true)
    setFlashId(focusNode.nodeId)
    const scrollTimer = window.setTimeout(() => {
      nodeRefs.current.get(focusNode.nodeId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, 60)
    const timer = window.setTimeout(() => setFlashId(''), 2400)
    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(timer)
    }
  }, [focusNode])

  const statusOf = useCallback((index) => {
    if (completed || index < currentStep) return 'done'
    if (index === currentStep) return 'current'
    return 'pending'
  }, [completed, currentStep])

  // hover 时沿有向边向前找上游、向后找下游，高亮整条关联链路
  const related = useMemo(() => {
    if (!hoverId) return null
    const upstream = {}
    const downstream = {}
    CHAIN_EDGES.forEach(([from, to]) => {
      ;(downstream[from] ??= new Set()).add(to)
      ;(upstream[to] ??= new Set()).add(from)
    })
    const seen = new Set([hoverId])
    const walk = (start, map) => {
      const queue = [start]
      while (queue.length) {
        const id = queue.shift()
        map[id]?.forEach((next) => {
          if (!seen.has(next)) {
            seen.add(next)
            queue.push(next)
          }
        })
      }
    }
    walk(hoverId, downstream)
    walk(hoverId, upstream)
    return seen
  }, [hoverId])

  const registerNode = useCallback((id, el) => {
    if (el) nodeRefs.current.set(id, el)
    else nodeRefs.current.delete(id)
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect()
      const rectOf = (id) => nodeRefs.current.get(id)?.getBoundingClientRect()

      const next = []
      CHAIN_EDGES.forEach(([from, to]) => {
        const fromRect = rectOf(from)
        const toRect = rectOf(to)
        if (!fromRect || !toRect) return
        // 同列同轨走上下锚点；跨列或同列跨轨走左右锚点
        const vertical =
          NODE_STEP[from] === NODE_STEP[to] &&
          Math.abs(fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2)) < 24
        const a = vertical
          ? { x: fromRect.left - canvasRect.left + fromRect.width / 2, y: fromRect.bottom - canvasRect.top }
          : { x: fromRect.right - canvasRect.left, y: fromRect.top - canvasRect.top + fromRect.height / 2 }
        const b = vertical
          ? { x: toRect.left - canvasRect.left + toRect.width / 2, y: toRect.top - canvasRect.top }
          : { x: toRect.left - canvasRect.left, y: toRect.top - canvasRect.top + toRect.height / 2 }
        next.push({ id: `${from}->${to}`, from, to, d: edgePath(a, b, vertical) })
      })
      setPaths(next)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [currentStep, completed, steps, open])

  const renderNode = (node) => {
    const lit = related?.has(node.id)
    return (
      <div
        className={`reasoning-node reasoning-node--${node.tone}${related ? (lit ? ' is-lit' : ' is-dim') : ''}${flashId === node.id ? ' is-flash' : ''}`}
        key={node.id}
        onMouseEnter={() => setHoverId(node.id)}
        onMouseLeave={() => setHoverId('')}
        ref={(el) => registerNode(node.id, el)}
      >
        {node.mark && (
          <span className={`reasoning-node__mark is-${node.tone}`} aria-hidden="true">
            {node.mark}
          </span>
        )}
        <strong className="reasoning-node__title">{node.title}</strong>
      </div>
    )
  }

  const currentStepInfo = steps[currentStep - 1]

  return (
    <div className={`reasoning-chain${open ? ' is-open' : ''}`} aria-label="AI 推理链">
      {/* 顶栏：整条链默认收起，点击展开/收起 */}
      <button
        className="reasoning-chain__toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <GitBranch size={14} aria-hidden="true" />
        <span className="reasoning-chain__toggle-name">AI 推理链</span>
        {currentStepInfo && (
          <span className="reasoning-chain__toggle-current">
            {String(currentStep).padStart(2, '0')} · {currentStepInfo.shortLabel ?? currentStepInfo.name}
          </span>
        )}
        <CaretDown className="reasoning-chain__chevron" size={13} aria-hidden="true" />
      </button>

      {open && (
      <div className="reasoning-chain__canvas" ref={canvasRef}>
        <svg className="reasoning-chain__edges" aria-hidden="true">
          <defs>
            <marker id="reasoning-arrow" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
              <path d="M0,0 L6,3 L0,6 Z" />
            </marker>
            <marker id="reasoning-arrow-reject" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
              <path d="M0,0 L6,3 L0,6 Z" />
            </marker>
          </defs>
          {paths.map((edge) => {
            const isReject = NODE_LOOKUP[edge.to]?.tone === 'reject'
            const lit = related?.has(edge.from) && related?.has(edge.to)
            return (
              <path
                className={`reasoning-edge${isReject ? ' reasoning-edge--reject' : ''}${related ? (lit ? ' is-lit' : ' is-dim') : ''}`}
                d={edge.d}
                key={edge.id}
                markerEnd={isReject ? 'url(#reasoning-arrow-reject)' : 'url(#reasoning-arrow)'}
              />
            )
          })}
        </svg>

        {steps.map((step) => {
          const status = statusOf(step.index)
          const nodes = CHAIN_NODES[step.id] ?? []
          const unlocked = status !== 'pending'
          const selected = Number(selectedStep) === step.index
          const hasTracks = nodes.some((node) => node.track)
          const tracks = TRACK_ORDER
            .map((trackId) => nodes.filter((node) => (node.track ?? 'right') === trackId))
            .filter((list) => list.length > 0)
          return (
            <div
              className={`reasoning-col reasoning-col--${status}${selected ? ' is-selected' : ''}`}
              key={step.id}
              ref={(el) => {
                if (el) colRefs.current.set(step.index, el)
                else colRefs.current.delete(step.index)
              }}
            >
              <button
                className="reasoning-col__head"
                type="button"
                onClick={() => onSelect?.(step.index, step)}
                title={`${String(step.index).padStart(2, '0')} · ${step.name}`}
              >
                <span className="reasoning-col__index">{String(step.index).padStart(2, '0')}</span>
                <span className="reasoning-col__name">{step.shortLabel ?? step.name}</span>
              </button>
              <div className="reasoning-col__nodes">
                {unlocked && hasTracks && (
                  <div className="reasoning-col__tracks">
                    {tracks.map((list, trackIndex) => (
                      <div className="reasoning-col__track" key={trackIndex}>{list.map(renderNode)}</div>
                    ))}
                  </div>
                )}
                {unlocked && !hasTracks && nodes.map(renderNode)}
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
