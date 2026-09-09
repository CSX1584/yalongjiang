import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

const AssetBoundsContext = createContext(null)

function boundsAreEqual(first, second) {
  if (!first || !second) return false
  return [...first.center, ...first.size].every(
    (value, index) =>
      Math.abs(value - [...second.center, ...second.size][index]) < 1e-6,
  )
}

export function getAssetBoundsSignature(definition) {
  return JSON.stringify([
    definition?.url ?? null,
    definition?.autoAnchor !== false,
    definition?.modelOffset ?? [0, 0, 0],
    definition?.modelRotation ?? [0, 0, 0],
    definition?.modelScale ?? [1, 1, 1],
    definition?.sourceBounds ?? null,
    definition?.dimensions ?? null,
  ])
}

export function AssetBoundsProvider({ children }) {
  const [measuredByKind, setMeasuredByKind] = useState({})
  const reportBounds = useCallback((assetKind, signature, bounds) => {
    setMeasuredByKind((current) => {
      const previous = current[assetKind]
      if (
        previous?.signature === signature &&
        boundsAreEqual(previous.bounds, bounds)
      ) {
        return current
      }

      return {
        ...current,
        [assetKind]: { signature, bounds },
      }
    })
  }, [])
  const value = useMemo(
    () => ({ measuredByKind, reportBounds }),
    [measuredByKind, reportBounds],
  )

  return (
    <AssetBoundsContext.Provider value={value}>
      {children}
    </AssetBoundsContext.Provider>
  )
}

export function useAssetBoundsReporter() {
  return useContext(AssetBoundsContext)?.reportBounds ?? null
}

export function useResolvedAssetRegistry(assetRegistry) {
  const measuredByKind = useContext(AssetBoundsContext)?.measuredByKind

  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(assetRegistry).map(([assetKind, definition]) => {
          const measured = measuredByKind?.[assetKind]
          const signature = getAssetBoundsSignature(definition)
          return [
            assetKind,
            measured?.signature === signature
              ? { ...definition, measuredBounds: measured.bounds }
              : definition,
          ]
        }),
      ),
    [assetRegistry, measuredByKind],
  )
}
