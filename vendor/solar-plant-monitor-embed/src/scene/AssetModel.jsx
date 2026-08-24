import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Matrix4, MeshBasicMaterial } from 'three'
import { ASSET_KINDS } from '../domain/constants.js'
import {
  getAssetBoundsSignature,
  useAssetBoundsReporter,
} from './AssetBoundsContext.jsx'
import { measureAssetScene } from './assetGeometry.js'
import {
  composeInstanceMatrix,
  createInstancedAssetParts,
} from './assetInstancing.js'
import {
  clampCoverageOpacity,
  createCoverageMaterial,
  isCoverageReduced,
} from './materialCoverage.js'

const PLACEHOLDER_COLORS = Object.freeze({
  [ASSET_KINDS.PV_PANEL]: '#1d7d57',
  [ASSET_KINDS.BATTERY]: '#176686',
  [ASSET_KINDS.TRANSFORMER]: '#7b795d',
  [ASSET_KINDS.PCS]: '#386f82',
  [ASSET_KINDS.GRID]: '#6a716f',
  [ASSET_KINDS.CONTROL_ROOM]: '#555f5f',
})

class AssetErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(previousProps) {
    if (previousProps.url !== this.props.url && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function useInvalidateCachedShadows(dependency) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)

  useLayoutEffect(() => {
    gl.shadowMap.needsUpdate = true
    invalidate()
  }, [dependency, gl, invalidate])
}

function LoadedAsset({
  assetKind,
  coverageOpacity = 1,
  definition,
  overlayColor,
  overlayOpacity = 0.6,
}) {
  const gltf = useGLTF(definition.url)
  const reportBounds = useAssetBoundsReporter()
  const modelRotation = definition.modelRotation ?? [0, 0, 0]
  const modelScale = definition.modelScale ?? [1, 1, 1]
  const measurement = useMemo(
    () => measureAssetScene(gltf.scene, definition),
    [
      definition.autoAnchor,
      definition.modelOffset,
      gltf.scene,
      modelRotation[0],
      modelRotation[1],
      modelRotation[2],
      modelScale[0],
      modelScale[1],
      modelScale[2],
    ],
  )
  const modelOffset =
    measurement?.modelOffset ?? definition.modelOffset ?? [0, 0, 0]
  const resolvedCoverageOpacity = clampCoverageOpacity(coverageOpacity)
  const coverageReduced = isCoverageReduced(resolvedCoverageOpacity)
  const overlayMaterial = useMemo(
    () =>
      overlayColor
        ? new MeshBasicMaterial({
            color: overlayColor,
            transparent: true,
            opacity: overlayOpacity * resolvedCoverageOpacity,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
            toneMapped: false,
          })
        : null,
    [overlayColor, overlayOpacity, resolvedCoverageOpacity],
  )
  const sceneResult = useMemo(() => {
    const clone = gltf.scene.clone(true)
    const coverageMaterials = []
    const coverageMaterialCache = new Map()
    clone.position.set(...modelOffset)
    clone.rotation.set(...modelRotation)
    clone.scale.set(...modelScale)
    clone.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = overlayMaterial || coverageReduced
          ? false
          : (definition.castShadow ?? true)
        object.receiveShadow = overlayMaterial || coverageReduced
          ? false
          : (definition.receiveShadow ?? true)
        if (overlayMaterial) {
          object.material = overlayMaterial
        } else if (coverageReduced) {
          const resolveMaterial = (sourceMaterial) => {
            if (coverageMaterialCache.has(sourceMaterial)) {
              return coverageMaterialCache.get(sourceMaterial)
            }
            const material =
              createCoverageMaterial(
                sourceMaterial,
                resolvedCoverageOpacity,
              ) ?? sourceMaterial
            coverageMaterialCache.set(sourceMaterial, material)
            if (material !== sourceMaterial) coverageMaterials.push(material)
            return material
          }
          object.material = Array.isArray(object.material)
            ? object.material.map(resolveMaterial)
            : resolveMaterial(object.material)
        }
      }
    })
    clone.updateMatrixWorld(true)
    return { coverageMaterials, scene: clone }
  }, [
    coverageReduced,
    definition.castShadow,
    definition.receiveShadow,
    gltf.scene,
    modelOffset[0],
    modelOffset[1],
    modelOffset[2],
    modelRotation[0],
    modelRotation[1],
    modelRotation[2],
    modelScale[0],
    modelScale[1],
    modelScale[2],
    overlayMaterial,
    resolvedCoverageOpacity,
  ])
  const scene = sceneResult.scene
  const measuredBounds = measurement?.bounds ?? null
  const signature = getAssetBoundsSignature(definition)

  useInvalidateCachedShadows(scene)

  useEffect(() => {
    if (measuredBounds) {
      reportBounds?.(assetKind, signature, measuredBounds)
    }
  }, [assetKind, measuredBounds, reportBounds, signature])

  useEffect(
    () => () => {
      overlayMaterial?.dispose()
    },
    [overlayMaterial],
  )

  useEffect(
    () => () => {
      sceneResult.coverageMaterials.forEach((material) => material.dispose())
    },
    [sceneResult],
  )

  return <primitive object={scene} />
}

function InstancedAssetPart({
  part,
  coverageOpacity,
  definition,
  materialOverride,
}) {
  const meshRef = useRef(null)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const coverageReduced = isCoverageReduced(coverageOpacity)
  const coverageMaterial = useMemo(
    () =>
      materialOverride
        ? null
        : createCoverageMaterial(part.material, coverageOpacity),
    [coverageOpacity, materialOverride, part.material],
  )
  const resolvedMaterial =
    materialOverride ?? coverageMaterial ?? part.material

  useEffect(
    () => () => {
      coverageMaterial?.dispose()
    },
    [coverageMaterial],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    part.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
    gl.shadowMap.needsUpdate = true
    invalidate()
  }, [gl, invalidate, part.matrices])

  return (
    <instancedMesh
      ref={meshRef}
      args={[part.geometry, part.material, part.matrices.length]}
      material={resolvedMaterial}
      castShadow={
        materialOverride || coverageReduced
          ? false
          : (definition.castShadow ?? true)
      }
      receiveShadow={
        materialOverride || coverageReduced
          ? false
          : (definition.receiveShadow ?? true)
      }
      renderOrder={part.renderOrder + (materialOverride ? 4 : 0)}
      dispose={null}
    />
  )
}

function getTransformRotation(transform) {
  return transform.rotation ?? [0, transform.rotationY ?? 0, 0]
}

function InstancedPlaceholders({
  assetKind,
  coverageOpacity,
  definition,
  instanceTransforms,
  overlayColor,
  overlayOpacity,
}) {
  const meshRef = useRef(null)
  const [width, height, depth] = definition.dimensions
  const resolvedCoverageOpacity = clampCoverageOpacity(coverageOpacity)
  const matrices = useMemo(() => {
    const centerOffset = new Matrix4().makeTranslation(0, height / 2, 0)
    return instanceTransforms.map((transform) =>
      composeInstanceMatrix(transform).multiply(centerOffset),
    )
  }, [height, instanceTransforms])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
  }, [matrices])

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, matrices.length]}
      castShadow={false}
      receiveShadow={false}
    >
      <boxGeometry args={[width, Math.max(height, 0.12), depth]} />
      <meshBasicMaterial
        color={overlayColor ?? PLACEHOLDER_COLORS[assetKind] ?? '#687173'}
        opacity={
          overlayColor
            ? overlayOpacity * resolvedCoverageOpacity
            : resolvedCoverageOpacity
        }
        transparent={Boolean(overlayColor) || resolvedCoverageOpacity < 1}
        depthWrite={!overlayColor}
      />
    </instancedMesh>
  )
}

function RepeatedLoadedAssets({
  assetKind,
  coverageOpacity,
  definition,
  instanceTransforms,
  overlayColor,
  overlayOpacity,
}) {
  return instanceTransforms.map((transform, index) => (
    <group
      key={index}
      position={transform.position ?? [0, 0, 0]}
      rotation={getTransformRotation(transform)}
      scale={transform.scale ?? [1, 1, 1]}
    >
      <LoadedAsset
        assetKind={assetKind}
        coverageOpacity={coverageOpacity}
        definition={definition}
        overlayColor={overlayColor}
        overlayOpacity={overlayOpacity}
      />
    </group>
  ))
}

function LoadedInstancedAsset({
  assetKind,
  coverageOpacity = 1,
  definition,
  instanceTransforms,
  overlayColor,
  overlayOpacity,
}) {
  const gltf = useGLTF(definition.url)
  const reportBounds = useAssetBoundsReporter()
  const modelRotation = definition.modelRotation ?? [0, 0, 0]
  const modelScale = definition.modelScale ?? [1, 1, 1]
  const measurement = useMemo(
    () => measureAssetScene(gltf.scene, definition),
    [
      definition.autoAnchor,
      definition.modelOffset,
      gltf.scene,
      modelRotation[0],
      modelRotation[1],
      modelRotation[2],
      modelScale[0],
      modelScale[1],
      modelScale[2],
    ],
  )
  const modelOffset =
    measurement?.modelOffset ?? definition.modelOffset ?? [0, 0, 0]
  const resolvedCoverageOpacity = clampCoverageOpacity(coverageOpacity)
  const parts = useMemo(
    () =>
      createInstancedAssetParts(
        gltf.scene,
        { modelOffset, modelRotation, modelScale },
        instanceTransforms,
      ),
    [
      gltf.scene,
      instanceTransforms,
      modelOffset[0],
      modelOffset[1],
      modelOffset[2],
      modelRotation[0],
      modelRotation[1],
      modelRotation[2],
      modelScale[0],
      modelScale[1],
      modelScale[2],
    ],
  )
  const measuredBounds = measurement?.bounds ?? null
  const signature = getAssetBoundsSignature(definition)
  const overlayMaterial = useMemo(
    () =>
      overlayColor
        ? new MeshBasicMaterial({
            color: overlayColor,
            transparent: true,
            opacity: overlayOpacity * resolvedCoverageOpacity,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
            toneMapped: false,
          })
        : null,
    [overlayColor, overlayOpacity, resolvedCoverageOpacity],
  )

  useEffect(
    () => () => {
      overlayMaterial?.dispose()
    },
    [overlayMaterial],
  )

  useEffect(() => {
    if (measuredBounds) {
      reportBounds?.(assetKind, signature, measuredBounds)
    }
  }, [assetKind, measuredBounds, reportBounds, signature])

  if (!parts) {
    if (instanceTransforms.length > 256) {
      return (
        <InstancedPlaceholders
          assetKind={assetKind}
          coverageOpacity={resolvedCoverageOpacity}
          definition={definition}
          instanceTransforms={instanceTransforms}
          overlayColor={overlayColor}
          overlayOpacity={overlayOpacity}
        />
      )
    }
    return (
      <RepeatedLoadedAssets
        assetKind={assetKind}
        coverageOpacity={resolvedCoverageOpacity}
        definition={definition}
        instanceTransforms={instanceTransforms}
        overlayColor={overlayColor}
        overlayOpacity={overlayOpacity}
      />
    )
  }

  return parts.map((part) => (
    <InstancedAssetPart
      key={part.key}
      part={part}
      coverageOpacity={resolvedCoverageOpacity}
      definition={definition}
      materialOverride={overlayMaterial}
    />
  ))
}

function Placeholder({
  assetKind,
  coverageOpacity = 1,
  dimensions,
  overlayColor,
  overlayOpacity = 0.6,
}) {
  const [width, height, depth] = dimensions
  const color = PLACEHOLDER_COLORS[assetKind] ?? '#687173'
  const resolvedCoverageOpacity = clampCoverageOpacity(coverageOpacity)
  const coverageReduced = isCoverageReduced(resolvedCoverageOpacity)
  const coverageMaterialProps = coverageReduced
    ? {
        alphaToCoverage: true,
        depthWrite: true,
        opacity: resolvedCoverageOpacity,
        transparent: false,
      }
    : {}
  const shadowProps = coverageReduced
    ? { castShadow: false, receiveShadow: false }
    : {}

  if (assetKind === ASSET_KINDS.PV_PANEL) {
    return (
      <group rotation-x={-0.22} position-y={0.45}>
        <mesh castShadow receiveShadow {...shadowProps}>
          <boxGeometry args={[width, Math.max(height, 0.12), depth]} />
          {overlayColor ? (
            <meshBasicMaterial
              color={overlayColor}
              depthWrite={false}
              opacity={overlayOpacity * resolvedCoverageOpacity}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
              toneMapped={false}
              transparent
            />
          ) : (
            <meshStandardMaterial
              color={color}
              roughness={0.42}
              metalness={0.18}
              {...coverageMaterialProps}
            />
          )}
        </mesh>
        {!overlayColor && (
          <mesh position-y={-0.35} castShadow {...shadowProps}>
            <boxGeometry args={[0.12, 0.7, 0.12]} />
            <meshStandardMaterial
              color="#566167"
              roughness={0.7}
              {...coverageMaterialProps}
            />
          </mesh>
        )}
      </group>
    )
  }

  if (assetKind === ASSET_KINDS.GRID) {
    return (
      <group>
        <mesh position-y={0.18} receiveShadow {...shadowProps}>
          <boxGeometry args={[width, 0.36, depth]} />
          <meshStandardMaterial
            color="#343f42"
            roughness={0.92}
            {...coverageMaterialProps}
          />
        </mesh>
        {[-0.32, 0, 0.32].map((offset) => (
          <group key={offset} position-x={offset * width}>
            <mesh position-y={height * 0.46} castShadow {...shadowProps}>
              <boxGeometry args={[0.45, height * 0.92, 0.45]} />
              <meshStandardMaterial
                color={color}
                roughness={0.7}
                metalness={0.22}
                {...coverageMaterialProps}
              />
            </mesh>
            <mesh position-y={height * 0.72} castShadow {...shadowProps}>
              <boxGeometry args={[width * 0.24, 0.28, 0.28]} />
              <meshStandardMaterial
                color="#758489"
                roughness={0.58}
                {...coverageMaterialProps}
              />
            </mesh>
          </group>
        ))}
      </group>
    )
  }

  if (assetKind === ASSET_KINDS.CONTROL_ROOM) {
    return (
      <group>
        <mesh position-y={height / 2} castShadow receiveShadow {...shadowProps}>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial
            color={color}
            roughness={0.83}
            {...coverageMaterialProps}
          />
        </mesh>
        <mesh position={[0, height + 0.2, 0]} castShadow {...shadowProps}>
          <boxGeometry args={[width + 0.7, 0.4, depth + 0.7]} />
          <meshStandardMaterial
            color="#738082"
            roughness={0.72}
            {...coverageMaterialProps}
          />
        </mesh>
        <mesh position={[0, height * 0.52, depth / 2 + 0.015]}>
          <planeGeometry args={[width * 0.56, height * 0.26]} />
          <meshStandardMaterial
            color="#163d47"
            emissive="#0a2026"
            emissiveIntensity={0.45}
            {...coverageMaterialProps}
          />
        </mesh>
      </group>
    )
  }

  return (
    <group>
      <mesh position-y={height / 2} castShadow receiveShadow {...shadowProps}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          metalness={0.2}
          {...coverageMaterialProps}
        />
      </mesh>
      <mesh position={[0, height * 0.7, depth / 2 + 0.015]}>
        <planeGeometry args={[width * 0.62, height * 0.16]} />
        <meshStandardMaterial
          color="#20383e"
          emissive="#0d2429"
          emissiveIntensity={0.35}
          {...coverageMaterialProps}
        />
      </mesh>
    </group>
  )
}

export function AssetModel({
  assetKind,
  assetRegistry,
  coverageOpacity = 1,
}) {
  const definition = assetRegistry[assetKind]
  if (!definition) return null

  const fallback = (
    <Placeholder
      assetKind={assetKind}
      coverageOpacity={coverageOpacity}
      dimensions={definition.dimensions}
    />
  )

  if (!definition.url) return fallback

  return (
    <AssetErrorBoundary url={definition.url} fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedAsset
          assetKind={assetKind}
          coverageOpacity={coverageOpacity}
          definition={definition}
        />
      </Suspense>
    </AssetErrorBoundary>
  )
}

export function InstancedAssetModel({
  assetKind,
  assetRegistry,
  coverageOpacity = 1,
  instanceTransforms,
  overlayColor,
  overlayOpacity = 0.6,
}) {
  const definition = assetRegistry[assetKind]
  if (!definition || instanceTransforms.length === 0) return null

  const fallback = (
    <InstancedPlaceholders
      assetKind={assetKind}
      coverageOpacity={coverageOpacity}
      definition={definition}
      instanceTransforms={instanceTransforms}
      overlayColor={overlayColor}
      overlayOpacity={overlayOpacity}
    />
  )

  if (!definition.url) return fallback

  return (
    <AssetErrorBoundary url={definition.url} fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedInstancedAsset
          assetKind={assetKind}
          coverageOpacity={coverageOpacity}
          definition={definition}
          instanceTransforms={instanceTransforms}
          overlayColor={overlayColor}
          overlayOpacity={overlayOpacity}
        />
      </Suspense>
    </AssetErrorBoundary>
  )
}

export function preloadAssetRegistry(assetRegistry) {
  Object.values(assetRegistry).forEach((definition) => {
    if (definition.url) useGLTF.preload(definition.url)
  })
}

export function clearAssetRegistryCache(assetRegistry) {
  Object.values(assetRegistry).forEach((definition) => {
    if (definition.url) useGLTF.clear(definition.url)
  })
}
