// Serialize writes so a slow earlier request cannot replace the newest settings.
let pending = Promise.resolve()
function writeConfig(method, value) {
  const body = JSON.stringify(value)
  pending = pending.catch(() => {}).then(async () => {
    const response = await fetch('/__map-config', {
      method, headers: { 'Content-Type': 'application/json' }, body, keepalive: true,
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}))
      throw new Error(detail.error || '项目配置写入失败')
    }
    if (method === 'POST') return response.json()
  })
  return pending
}

export const saveMapConfig = config => writeConfig('PUT', config)
export const saveMapPreset = action => writeConfig('POST', action)
export async function loadMapConfig() {
  const response = await fetch('/__map-config', { cache: 'no-store' })
  if (!response.ok) throw new Error('项目参数列表读取失败')
  return response.json()
}

export function mapSnapshot({ presets, ...config }) { return config }

// Apply each operation to the latest disk state, so two ports cannot overwrite
// each other's preset lists with an older copy held in a browser.
export function updatePresetConfig(config, action) {
  if (!action || typeof action !== 'object') throw new Error('无效的参数操作')
  const presets = { ...config.presets, items: [...config.presets.items] }
  const item = presets.items.find(item => item.id === action.id)
  if (action.type === 'save') {
    if (item) throw new Error('参数已存在，请勿重复保存')
    presets.items.push({ id: action.id, name: action.name, createdAt: new Date().toISOString(), config: action.config })
    presets.lastSelectedId = action.id
  } else {
    if (!item) throw new Error('这套参数已被删除，请刷新列表')
    if (action.type === 'select') presets.lastSelectedId = item.id
    else if (action.type === 'default') presets.defaultId = item.id
    else if (action.type === 'delete') {
      if (presets.items.length === 1) throw new Error('至少保留一套参数，才能设置初始默认')
      presets.items = presets.items.filter(entry => entry.id !== item.id)
      if (presets.defaultId === item.id) presets.defaultId = presets.items[0].id
      if (presets.lastSelectedId === item.id) presets.lastSelectedId = presets.defaultId
    } else throw new Error('未知参数操作')
  }
  return { ...presets.items.find(item => item.id === presets.defaultId).config, presets }
}
