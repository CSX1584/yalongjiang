// Serialize writes so a slow earlier request cannot replace the newest settings.
let pending = Promise.resolve()
export function saveMapConfig(config) {
  const body = JSON.stringify(config)
  pending = pending.catch(() => {}).then(async () => {
    const response = await fetch('/__map-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: true,
    })
    if (!response.ok) throw new Error('项目配置写入失败')
  })
  return pending
}
