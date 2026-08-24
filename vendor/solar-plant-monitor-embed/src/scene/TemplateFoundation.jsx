import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry, Shape } from 'three'
import {
  clampCoverageOpacity,
  isCoverageReduced,
} from './materialCoverage.js'

const ignoreRaycast = () => null

function createRoundedFoundationGeometry(width, depth, height, radius) {
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const safeRadius = Math.max(
    0.001,
    Math.min(radius, halfWidth, halfDepth),
  )
  const shape = new Shape()

  shape.moveTo(-halfWidth + safeRadius, -halfDepth)
  shape.lineTo(halfWidth - safeRadius, -halfDepth)
  shape.quadraticCurveTo(
    halfWidth,
    -halfDepth,
    halfWidth,
    -halfDepth + safeRadius,
  )
  shape.lineTo(halfWidth, halfDepth - safeRadius)
  shape.quadraticCurveTo(
    halfWidth,
    halfDepth,
    halfWidth - safeRadius,
    halfDepth,
  )
  shape.lineTo(-halfWidth + safeRadius, halfDepth)
  shape.quadraticCurveTo(
    -halfWidth,
    halfDepth,
    -halfWidth,
    halfDepth - safeRadius,
  )
  shape.lineTo(-halfWidth, -halfDepth + safeRadius)
  shape.quadraticCurveTo(
    -halfWidth,
    -halfDepth,
    -halfWidth + safeRadius,
    -halfDepth,
  )

  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 8,
    depth: height,
    steps: 1,
  })
  geometry.rotateX(Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

export function TemplateFoundation({
  bounds,
  coverageOpacity = 1,
  interactive = true,
}) {
  const [width, height, depth] = bounds.size
  const geometry = useMemo(
    () =>
      createRoundedFoundationGeometry(
        width,
        depth,
        height,
        bounds.cornerRadius,
      ),
    [bounds.cornerRadius, depth, height, width],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  const resolvedCoverageOpacity = clampCoverageOpacity(coverageOpacity)
  const coverageReduced = isCoverageReduced(resolvedCoverageOpacity)

  return (
    <mesh
      geometry={geometry}
      position={[bounds.center[0], height, bounds.center[2]]}
      raycast={interactive ? undefined : ignoreRaycast}
      receiveShadow={!coverageReduced}
    >
      <meshStandardMaterial
        color="#222222"
        metalness={0.02}
        roughness={0.9}
        alphaToCoverage={coverageReduced}
        transparent={!coverageReduced}
        opacity={coverageReduced ? resolvedCoverageOpacity : 0.6}
        depthWrite={coverageReduced}
      />
    </mesh>
  )
}
