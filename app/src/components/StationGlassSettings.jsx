import { useState } from 'react'
import { FloppyDisk, X } from '@phosphor-icons/react'
import { DEFAULT_GLASS_CONFIG, GLASS_PARAMETER_GROUPS, normalizeGlassConfig } from './stationGlassConfig.mjs'

function ParameterField({ field, value, onChange }) {
  const [draft, setDraft] = useState(null)
  const [key, label, min, max, step] = field
  return (
    <div className="glass-parameter-field">
      <label htmlFor={`glass-${key}`}>{label}</label>
      <input id={`glass-${key}`} type="number" min={min} max={max} step={step} value={draft ?? value} aria-label={`${label}数值`}
        onChange={event => { setDraft(event.target.value); if (Number.isFinite(event.target.valueAsNumber)) onChange(key, event.target.valueAsNumber) }} onBlur={() => setDraft(null)} />
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={event => { setDraft(null); onChange(key, event.target.valueAsNumber) }} />
    </div>
  )
}

export default function StationGlassSettings({ config, onChange, onClose, onSave }) {
  const [status, setStatus] = useState('')
  const update = (key, value) => { onChange(normalizeGlassConfig({ ...config, [key]: value })); setStatus('dirty') }
  const save = async event => {
    event.preventDefault()
    try { await onSave(); setStatus('saved') }
    catch { setStatus('error') }
  }
  return (
    <form id="station-glass-settings" className="map-model-settings station-glass-settings" role="dialog" aria-label="卡片玻璃材质参数" noValidate onSubmit={save}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
      <header>
        <span><strong>卡片玻璃</strong><small>即时预览 · 全部电站卡片</small></span>
        <button type="button" autoFocus aria-label="关闭卡片玻璃参数" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="glass-settings-body">
        {GLASS_PARAMETER_GROUPS.map((group, index) => (
          <details key={group.label} open={index === 0 || undefined}>
            <summary>{group.label}</summary>
            {group.fields.map(field => <ParameterField key={field[0]} field={field} value={config[field[0]]} onChange={update} />)}
            {index === 0 ? <label className="glass-check"><input type="checkbox" checked={config.blurEdge} onChange={event => update('blurEdge', event.target.checked)} />模糊玻璃边缘</label> : null}
            {index === 3 ? <label className="glass-color">玻璃底色<input type="color" value={config.tintColor} onChange={event => update('tintColor', event.target.value)} /><output>{config.tintColor}</output></label> : null}
          </details>
        ))}
      </div>
      <footer>
        <span role={status === 'error' ? 'alert' : 'status'}>{status === 'error' ? '写入项目失败，请重试' : status === 'saved' ? '已写入项目，下次打开自动应用' : status === 'dirty' ? '调整已生效 · 自动保存中' : '调整后自动写入项目'}</span>
        <div>
          <button type="button" className="glass-reset" onClick={() => { onChange({ ...DEFAULT_GLASS_CONFIG }); setStatus('dirty') }}>恢复默认</button>
          <button type="submit"><FloppyDisk size={14} />保存参数</button>
        </div>
      </footer>
    </form>
  )
}
