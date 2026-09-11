import { useRef, useState } from 'react'

export default function SceneParameter({ label, ariaLabel = label, value, min, max, step, fineStep = step / 10, unit, title, onChange }) {
  const [draft, setDraft] = useState(null)
  const drag = useRef(null)
  const clamp = number => Math.min(max, Math.max(min, number))
  const round = number => Number(number.toFixed(8))
  const update = number => { setDraft(null); onChange(round(clamp(number))) }
  const snap = (number, increment) => round(clamp(min + Math.round((number - min) / increment) * increment))
  const finishInput = event => {
    const number = event.currentTarget.valueAsNumber
    if (Number.isFinite(number)) update(number)
    else setDraft(null)
  }
  return <div className="scene-parameter" title={title}>
    <label className="scene-parameter-heading">
      <span>{label}</span>
      <span className="scene-parameter-value">
        <input type="number" aria-label={`${ariaLabel}数值`} min={min} max={max} step="any" value={draft ?? round(value)}
          onChange={event => {
            setDraft(event.target.value)
            const number = event.target.valueAsNumber
            if (Number.isFinite(number) && number >= min && number <= max) onChange(number)
          }}
          onBlur={finishInput}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.value = String(value); event.currentTarget.blur() }
          }} />
        {unit ? <span>{unit}</span> : null}
      </span>
    </label>
    <input className="scene-parameter-range" type="range" aria-label={ariaLabel} title="拖动调整 · 按住 Shift 慢速微调" min={min} max={max} step="any" value={value}
      onChange={event => update(event.target.valueAsNumber)}
      onPointerDown={event => {
        if (event.button !== 0 || drag.current) return
        event.preventDefault()
        const input = event.currentTarget, rect = input.getBoundingClientRect()
        input.focus(); input.setPointerCapture(event.pointerId)
        const width = Math.max(1, rect.width - 14) // Matches the slider thumb's diameter.
        const next = event.shiftKey ? value : snap(min + (event.clientX - rect.left - 7) / width * (max - min), step)
        drag.current = { id: event.pointerId, x: event.clientX, value: next, width }
        update(next)
      }}
      onPointerMove={event => {
        const current = drag.current
        if (!current || current.id !== event.pointerId) return
        current.value = clamp(current.value + (event.clientX - current.x) / current.width * (max - min) * (event.shiftKey ? 0.1 : 1))
        current.x = event.clientX
        update(snap(current.value, event.shiftKey ? fineStep : step))
      }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
      onKeyDown={event => {
        const direction = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[event.key]
        if (direction || event.key === 'Home' || event.key === 'End') {
          event.preventDefault()
          update(event.key === 'Home' ? min : event.key === 'End' ? max : value + direction * (event.shiftKey ? fineStep : step))
        }
      }} />
  </div>
}
