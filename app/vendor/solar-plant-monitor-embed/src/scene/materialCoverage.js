const FULL_COVERAGE_THRESHOLD = 0.999

export function clampCoverageOpacity(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 1
  return Math.min(1, Math.max(0, numericValue))
}

export function isCoverageReduced(value) {
  return clampCoverageOpacity(value) < FULL_COVERAGE_THRESHOLD
}

export function createCoverageMaterial(sourceMaterial, coverageOpacity) {
  const coverage = clampCoverageOpacity(coverageOpacity)
  if (coverage >= FULL_COVERAGE_THRESHOLD) return null

  const material = sourceMaterial.clone()
  const useAlphaToCoverage = !sourceMaterial.transparent

  material.opacity = sourceMaterial.opacity * coverage
  material.alphaHash = sourceMaterial.alphaHash
  material.alphaToCoverage =
    sourceMaterial.alphaToCoverage || useAlphaToCoverage
  material.transparent =
    sourceMaterial.transparent || !useAlphaToCoverage
  material.depthWrite =
    sourceMaterial.depthWrite && useAlphaToCoverage
  material.needsUpdate = true

  return material
}
