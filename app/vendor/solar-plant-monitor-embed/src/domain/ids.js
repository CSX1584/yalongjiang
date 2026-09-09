let fallbackOrdinal = 0

export function createEntityId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  fallbackOrdinal += 1
  return `${prefix}-${Date.now().toString(36)}-${fallbackOrdinal.toString(36)}`
}
