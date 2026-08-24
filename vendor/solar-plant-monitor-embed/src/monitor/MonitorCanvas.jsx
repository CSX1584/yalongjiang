import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Environment, Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ACESFilmicToneMapping,
  MathUtils,
  SRGBColorSpace,
  Vector3,
} from 'three'
import {
  ASSET_KINDS,
  CAMERA_LIMITS,
} from '../domain/constants.js'
import {
  getSceneAssetFoundationBounds,
  getSceneInstanceBounds,
  getTemplateFoundationBounds,
} from '../domain/documents.js'
import {
  AssetBoundsProvider,
  useResolvedAssetRegistry,
} from '../scene/AssetBoundsContext.jsx'
import {
  CAMERA_CLIP_PLANES,
  CAMERA_MOUSE_BUTTONS,
  CAMERA_OBLIQUE_POSITION,
  CAMERA_ORBIT_LIMITS,
} from '../scene/cameraMath.js'
import { DotGrid } from '../scene/DotGrid.jsx'
import { SceneResourceBoundary } from '../scene/SceneResourceBoundary.jsx'
import { TemplateFoundation } from '../scene/TemplateFoundation.jsx'
import { XRayInstancedBoundsOutline } from '../scene/XRaySelectionOutline.jsx'
import {
  getContentBoundingSphere,
  getGroundFadeRange,
  getPerspectiveFogRange,
  SCENE_BACKGROUND_COLOR,
} from '../scene/sceneFog.js'
import { InstancedAssetModel } from '../scene/AssetModel.jsx'
import {
  createMonitorHitArea,
  getSceneAssetEquipmentOutlineMatrices,
  getTemplateDeviceOutlineMatrices,
  getWorldOutlineMatrices,
} from './monitoringGeometry.js'
import {
  createMonitorSubarrayLabels,
  getMonitorSubarrayLabelPosition,
} from './monitoringLabels.js'
import {
  createMonitorAssetInstances,
  groupMonitorAssetInstances,
} from './monitoringBatches.js'
import {
  MONITOR_CAMERA_TRANSITION_SECONDS,
  MONITOR_DIMMED_COVERAGE_OPACITY,
  easeOutQuart,
  getMonitorCameraFrame,
  getMonitorHitAreaEntries,
  getMonitorOutlineMatrices,
  isMonitorSubarrayEntity,
} from './monitoringFocus.js'

const CAMERA_DAMPING_FACTOR = 0.22
const CAMERA_WHEEL_ZOOM_SPEED = 1.5

function configureMonitorRenderer({ gl }, performanceMode) {
  gl.outputColorSpace = SRGBColorSpace
  gl.toneMapping = ACESFilmicToneMapping
  gl.toneMappingExposure = 1.02
  gl.shadowMap.autoUpdate = false
  gl.shadowMap.needsUpdate = !performanceMode
}

function MonitorContextRecovery({ onContextLost, onContextRestored }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl.domElement
    const handleContextLost = (event) => {
      event.preventDefault()
      onContextLost()
    }
    const handleContextRestored = () => onContextRestored()

    canvas.addEventListener('webglcontextlost', handleContextLost, false)
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false)
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost, false)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored, false)
    }
  }, [gl, onContextLost, onContextRestored])

  return null
}

function MonitorFog({ contentBounds }) {
  const fogRef = useRef(null)
  const initializedRef = useRef(false)
  const invalidate = useThree((state) => state.invalidate)

  useFrame(({ camera }, delta) => {
    const fog = fogRef.current
    if (!fog) return

    const [near, far] = getPerspectiveFogRange(camera, contentBounds)
    if (!initializedRef.current) {
      fog.near = near
      fog.far = far
      initializedRef.current = true
      return
    }

    const nextNear = MathUtils.damp(fog.near, near, 8, delta)
    const nextFar = MathUtils.damp(fog.far, far, 8, delta)
    fog.near = nextNear
    fog.far = nextFar
    if (Math.abs(nextNear - near) > 0.01 || Math.abs(nextFar - far) > 0.01) {
      invalidate()
    }
  })

  return (
    <fog
      ref={fogRef}
      attach="fog"
      args={[SCENE_BACKGROUND_COLOR, 220, 650]}
    />
  )
}

function MonitorCachedShadowMap({
  assetRegistry,
  documents,
  selectedEntityId,
}) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)

  useLayoutEffect(() => {
    gl.shadowMap.needsUpdate = true
    invalidate()
  }, [assetRegistry, documents, gl, invalidate, selectedEntityId])

  useEffect(
    () => () => {
      gl.shadowMap.autoUpdate = true
    },
    [gl],
  )

  return null
}

function MonitorOutlineWarmup() {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const scene = useThree((state) => state.scene)
  const compiledRef = useRef(false)

  useEffect(() => {
    if (compiledRef.current) return undefined

    let cancelled = false
    const frameId = window.requestAnimationFrame(() => {
      const hiddenOutlines = []
      const emptyOutlineCounts = []

      scene.traverse((object) => {
        if (
          (object.name === 'monitor-outline-mask' ||
            object.name === 'monitor-outline-strokes') &&
          !object.visible
        ) {
          hiddenOutlines.push(object)
          object.visible = true
        }
        if (
          (object.name === 'monitor-outline-mask' ||
            object.name === 'monitor-outline-strokes') &&
          object.count === 0
        ) {
          emptyOutlineCounts.push(object)
          object.count = 1
        }
      })

      try {
        gl.compile(scene, camera)
        compiledRef.current = true
      } finally {
        hiddenOutlines.forEach((object) => {
          object.visible = false
        })
        emptyOutlineCounts.forEach((object) => {
          object.count = 0
        })
      }

      if (!cancelled) invalidate()
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frameId)
    }
  }, [camera, gl, invalidate, scene])

  return null
}

function getMonitorContentBounds(documents, assetRegistry) {
  const gridSpacing = documents.scene.environment.gridSpacing
  return getContentBoundingSphere(
    documents.scene.instances.map((entity) => ({
      entity,
      bounds: getSceneInstanceBounds(
        entity,
        documents.templates.items,
        assetRegistry,
        gridSpacing,
      ),
    })),
  )
}

function MonitorEntity({ children, entity }) {
  return (
    <group
      position={entity.transform.position}
      rotation-y={entity.transform.rotationY}
    >
      {children}
    </group>
  )
}

function MonitorSubarrayLabel({ bounds, coverageOpacity, label, rotationY }) {
  return (
    <Html
      center
      position={getMonitorSubarrayLabelPosition(bounds, rotationY)}
      zIndexRange={[3, 0]}
      style={{ opacity: coverageOpacity, pointerEvents: 'none' }}
    >
      <span className="monitor-subarray-label">{label}</span>
    </Html>
  )
}

const MonitorHitAreas = memo(function MonitorHitAreas({
  entries,
  hoverEnabled,
  onHoveredEntityChange,
  onSelectedEntityChange,
}) {
  const hitArea = useMemo(() => createMonitorHitArea(entries), [entries])
  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.entity.id, entry])),
    [entries],
  )

  useEffect(() => () => hitArea.geometry.dispose(), [hitArea.geometry])

  if (hitArea.entityIdsByFace.length === 0) return null

  const getEventEntityId = (faceIndex) =>
    faceIndex === undefined || faceIndex === null
      ? null
      : (hitArea.entityIdsByFace[faceIndex] ?? null)
  const handlePointerHover = (event) => {
    const entityId = getEventEntityId(event.faceIndex)
    if (!entityId) return
    event.stopPropagation()
    onHoveredEntityChange(entityId)
  }
  const handleClick = (event) => {
    if (event.nativeEvent.button !== 0) return
    const entityId = getEventEntityId(event.faceIndex)
    const entry = entriesById.get(entityId)
    if (!entry?.selectable) return
    event.stopPropagation()
    onSelectedEntityChange(entityId)
  }

  return (
    <mesh
      geometry={hitArea.geometry}
      frustumCulled={false}
      onClick={handleClick}
      onPointerMove={hoverEnabled ? handlePointerHover : undefined}
      onPointerOver={hoverEnabled ? handlePointerHover : undefined}
      onPointerOut={
        hoverEnabled
          ? (event) => {
              event.stopPropagation()
              if (
                event.intersections.some(
                  (intersection) =>
                    intersection.eventObject === event.eventObject,
                )
              ) {
                return
              }
              onHoveredEntityChange(null)
            }
          : undefined
      }
    >
      <meshBasicMaterial
        colorWrite={false}
        depthTest={false}
        depthWrite={false}
        opacity={0}
        transparent
      />
    </mesh>
  )
})

function MonitorInteractionLayer({
  entries,
  onSelectedEntityChange,
  selectedEntityId,
}) {
  const [hoveredEntityId, setHoveredEntityId] = useState(null)
  const hoveredEntityIdRef = useRef(null)
  const focusActive = Boolean(selectedEntityId)
  const hitAreaEntries = useMemo(
    () => getMonitorHitAreaEntries(entries, selectedEntityId),
    [entries, selectedEntityId],
  )
  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.entity.id, entry])),
    [entries],
  )
  const hoveredEntry = entriesById.get(hoveredEntityId)
  const outlineMatrices = useMemo(
    () =>
      getMonitorOutlineMatrices(
        entries,
        hoveredEntityId,
        selectedEntityId,
      ),
    [entries, hoveredEntityId, selectedEntityId],
  )
  const outlineCapacity = useMemo(
    () =>
      Math.max(
        1,
        ...entries.map((entry) => entry.outlineMatrices.length),
      ),
    [entries],
  )
  const handleHoveredEntityChange = useCallback((entityId) => {
    if (hoveredEntityIdRef.current === entityId) return
    hoveredEntityIdRef.current = entityId
    setHoveredEntityId(entityId)
  }, [])
  const handleSelectedEntityChange = useCallback(
    (entityId) => {
      handleHoveredEntityChange(null)
      onSelectedEntityChange(entityId)
    },
    [handleHoveredEntityChange, onSelectedEntityChange],
  )

  return (
    <>
      <MonitorHitAreas
        entries={hitAreaEntries}
        hoverEnabled={!focusActive}
        onHoveredEntityChange={handleHoveredEntityChange}
        onSelectedEntityChange={handleSelectedEntityChange}
      />
      <XRayInstancedBoundsOutline
        capacity={outlineCapacity}
        matrices={outlineMatrices}
        color="#ffffff"
        objectNamePrefix="monitor-outline"
        opacity={0.94}
        thickness={3.2}
      />
      <MonitorCursor
        hovered={!focusActive && Boolean(hoveredEntry?.selectable)}
      />
      <MonitorOutlineWarmup />
    </>
  )
}

function MonitorScene({
  assetRegistry,
  documents,
  onSelectedEntityChange,
  selectedEntityId,
}) {
  const gridSpacing = documents.scene.environment.gridSpacing
  const subarrayLabels = useMemo(
    () => createMonitorSubarrayLabels(documents.scene.instances),
    [documents.scene.instances],
  )
  const assetInstances = useMemo(
    () => createMonitorAssetInstances(documents),
    [documents],
  )
  const assetBatches = useMemo(
    () => groupMonitorAssetInstances(assetInstances, selectedEntityId),
    [assetInstances, selectedEntityId],
  )
  const entries = useMemo(
    () =>
      documents.scene.instances.map((entity) => {
        const template =
          entity.kind === 'template'
            ? documents.templates.items[entity.templateId]
            : null
        const hoverable = Boolean(
          template ||
          (entity.kind === 'asset' && entity.assetKind === ASSET_KINDS.GRID),
        )
        const selectable = isMonitorSubarrayEntity(entity)
        const localOutlineMatrices = template
          ? getTemplateDeviceOutlineMatrices(template, assetRegistry)
          : hoverable
            ? getSceneAssetEquipmentOutlineMatrices(entity, assetRegistry)
            : []
        const outlineMatrices = getWorldOutlineMatrices(
          entity,
          localOutlineMatrices,
        )
        const bounds = hoverable
          ? getSceneInstanceBounds(
              entity,
              documents.templates.items,
              assetRegistry,
              gridSpacing,
            )
          : null
        const foundationBounds = template
          ? getTemplateFoundationBounds(template, assetRegistry, gridSpacing)
          : getSceneAssetFoundationBounds(entity, assetRegistry, gridSpacing)

        return {
          bounds,
          entity,
          foundationBounds,
          hoverable,
          label: subarrayLabels.get(entity.id) ?? null,
          outlineMatrices,
          selectable,
          template,
        }
      }),
    [assetRegistry, documents, gridSpacing, subarrayLabels],
  )
  const focusActive = Boolean(selectedEntityId)

  return (
    <>
      {entries.map(({ bounds, entity, foundationBounds, label }) => {
        const coverageOpacity =
          focusActive && entity.id !== selectedEntityId
            ? MONITOR_DIMMED_COVERAGE_OPACITY
            : 1

        return (
          <MonitorEntity key={entity.id} entity={entity}>
            {foundationBounds && (
              <TemplateFoundation
                bounds={foundationBounds}
                coverageOpacity={coverageOpacity}
              />
            )}
            {label && bounds && (
              <MonitorSubarrayLabel
                bounds={bounds}
                coverageOpacity={coverageOpacity}
                label={label}
                rotationY={entity.transform.rotationY}
              />
            )}
          </MonitorEntity>
        )
      })}
      {assetBatches.map((batch) => (
        <InstancedAssetModel
          key={batch.key}
          assetKind={batch.assetKind}
          assetRegistry={assetRegistry}
          coverageOpacity={batch.coverageOpacity}
          instanceTransforms={batch.instanceTransforms}
        />
      ))}
      <MonitorInteractionLayer
        entries={entries}
        onSelectedEntityChange={onSelectedEntityChange}
        selectedEntityId={selectedEntityId}
      />
    </>
  )
}

function MonitorCursor({ hovered }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const previous = gl.domElement.style.cursor
    gl.domElement.style.cursor = hovered ? 'pointer' : 'default'
    return () => {
      gl.domElement.style.cursor = previous
    }
  }, [gl, hovered])

  return null
}

function MonitorOrbitControls({ viewBounds, viewKey }) {
  const controlsRef = useRef(null)
  const animationRef = useRef(null)
  const initializedRef = useRef(false)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const size = useThree((state) => state.size)

  useEffect(() => {
    const element = gl.domElement
    const preventContextMenu = (event) => event.preventDefault()
    element.addEventListener('contextmenu', preventContextMenu)
    return () => element.removeEventListener('contextmenu', preventContextMenu)
  }, [gl])

  useLayoutEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    const frame = getMonitorCameraFrame(viewBounds, {
      aspect: Math.max(size.width, 1) / Math.max(size.height, 1),
      fov: camera.fov,
    })
    const nextPosition = new Vector3(...frame.position)
    const nextTarget = new Vector3(...frame.target)
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (!initializedRef.current || reduceMotion) {
      camera.position.copy(nextPosition)
      controls.target.copy(nextTarget)
      camera.lookAt(nextTarget)
      camera.updateMatrixWorld()
      controls.update()
      controls.enabled = true
      animationRef.current = null
      initializedRef.current = true
      invalidate()
      return
    }

    controls.enabled = false
    animationRef.current = {
      duration: MONITOR_CAMERA_TRANSITION_SECONDS,
      elapsed: 0,
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: nextPosition,
      toTarget: nextTarget,
    }
    invalidate()
  }, [camera, invalidate, size.height, size.width, viewBounds, viewKey])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    const animation = animationRef.current
    if (!controls || !animation) return

    animation.elapsed = Math.min(
      animation.duration,
      animation.elapsed + delta,
    )
    const progress = easeOutQuart(animation.elapsed / animation.duration)
    camera.position.lerpVectors(
      animation.fromPosition,
      animation.toPosition,
      progress,
    )
    controls.target.lerpVectors(
      animation.fromTarget,
      animation.toTarget,
      progress,
    )
    camera.lookAt(controls.target)
    camera.updateMatrixWorld()
    controls.update()

    if (animation.elapsed >= animation.duration) {
      animationRef.current = null
      controls.enabled = true
      return
    }
    invalidate()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={CAMERA_DAMPING_FACTOR}
      zoomSpeed={CAMERA_WHEEL_ZOOM_SPEED}
      minDistance={8}
      maxDistance={500}
      minPolarAngle={CAMERA_ORBIT_LIMITS.minPolarAngle}
      maxPolarAngle={CAMERA_ORBIT_LIMITS.maxPolarAngle}
      minAzimuthAngle={CAMERA_ORBIT_LIMITS.minAzimuthAngle}
      maxAzimuthAngle={CAMERA_ORBIT_LIMITS.maxAzimuthAngle}
      mouseButtons={CAMERA_MOUSE_BUTTONS}
    />
  )
}

function MonitorWorld({
  assetRegistry,
  deviceStatuses,
  documents,
  environment,
  onSelectedEntityChange,
  performanceMode,
  selectedEntityId,
}) {
  const contentBounds = useMemo(
    () => getMonitorContentBounds(documents, assetRegistry),
    [assetRegistry, documents],
  )
  const groundFadeRange = useMemo(
    () => getGroundFadeRange(contentBounds),
    [contentBounds],
  )
  const selectedContentBounds = useMemo(() => {
    if (!selectedEntityId) return null
    const entity = documents.scene.instances.find(
      (entry) => entry.id === selectedEntityId,
    )
    if (!entity || entity.kind !== 'template') return null
    const bounds = getSceneInstanceBounds(
      entity,
      documents.templates.items,
      assetRegistry,
      documents.scene.environment.gridSpacing,
    )
    return getContentBoundingSphere([{ bounds, entity }])
  }, [assetRegistry, documents, selectedEntityId])

  useEffect(() => {
    if (selectedEntityId && !selectedContentBounds) {
      onSelectedEntityChange(null)
    }
  }, [onSelectedEntityChange, selectedContentBounds, selectedEntityId])
  const resolvedEnvironment =
    environment === undefined
      ? documents.scene.environment.hdrUrl
        ? { url: documents.scene.environment.hdrUrl }
        : null
      : environment

  return (
    <>
      <color attach="background" args={[SCENE_BACKGROUND_COLOR]} />
      <MonitorFog contentBounds={contentBounds} />
      <ambientLight intensity={1} color="#e8e8e8" />
      <hemisphereLight args={['#cccccc', '#3a3a3a', 1.15]} />
      <pointLight
        color="#c3c3c3"
        intensity={4.2}
        distance={48}
        position={[22, 9, -18]}
      />
      <directionalLight
        position={[-24, 38, 22]}
        intensity={2.5}
        color="#f2f2f2"
        castShadow={!performanceMode}
        shadow-mapSize={performanceMode ? [512, 512] : [1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-bias={-0.001}
        shadow-normalBias={0.3}
        shadow-radius={2}
      />
      {!performanceMode && (
        <MonitorCachedShadowMap
          assetRegistry={assetRegistry}
          documents={documents}
          selectedEntityId={selectedEntityId}
        />
      )}
      <DotGrid
        spacing={documents.scene.environment.gridSpacing}
        fadeRange={groundFadeRange}
      />
      <Suspense fallback={null}>
        <MonitorScene
          assetRegistry={assetRegistry}
          deviceStatuses={deviceStatuses}
          documents={documents}
          onSelectedEntityChange={onSelectedEntityChange}
          selectedEntityId={selectedEntityId}
        />
        {resolvedEnvironment?.url && (
          <SceneResourceBoundary resetKey={resolvedEnvironment.url}>
            <Suspense fallback={null}>
              <Environment
                files={resolvedEnvironment.url}
                background={resolvedEnvironment.background ?? false}
                environmentIntensity={resolvedEnvironment.intensity ?? 0.65}
                environmentRotation={resolvedEnvironment.rotation ?? [0, 0, 0]}
              />
            </Suspense>
          </SceneResourceBoundary>
        )}
      </Suspense>
      <MonitorOrbitControls
        viewBounds={selectedContentBounds ?? contentBounds}
        viewKey={selectedEntityId ?? 'overview'}
      />
    </>
  )
}

function ResolvedMonitorWorld(props) {
  const resolvedAssetRegistry = useResolvedAssetRegistry(props.assetRegistry)
  return <MonitorWorld {...props} assetRegistry={resolvedAssetRegistry} />
}

export function MonitorCanvas({
  performanceMode = false,
  ...props
}) {
  const [selectedEntityId, setSelectedEntityId] = useState(null)
  const [contextLost, setContextLost] = useState(false)
  const [rendererGeneration, setRendererGeneration] = useState(0)
  const handleContextLost = useCallback(() => setContextLost(true), [])
  const handleContextRestored = useCallback(() => {
    setContextLost(false)
    setRendererGeneration((value) => value + 1)
  }, [])
  const retryRenderer = useCallback(() => {
    setContextLost(false)
    setRendererGeneration((value) => value + 1)
  }, [])

  return (
    <>
      <Canvas
        key={rendererGeneration}
        frameloop="demand"
        shadows={performanceMode ? false : 'percentage'}
        dpr={1.5}
        camera={{
          position: CAMERA_OBLIQUE_POSITION,
          fov: CAMERA_LIMITS.defaultFov,
          near: CAMERA_CLIP_PLANES.perspectiveNear,
          far: CAMERA_CLIP_PLANES.far,
        }}
        gl={{
          antialias: !performanceMode,
          alpha: false,
          depth: true,
          stencil: true,
          powerPreference: 'high-performance',
        }}
        onCreated={(state) => configureMonitorRenderer(state, performanceMode)}
        onPointerMissed={(event) => {
          if (event.button === 0) setSelectedEntityId(null)
        }}
      >
        <MonitorContextRecovery
          onContextLost={handleContextLost}
          onContextRestored={handleContextRestored}
        />
        <AssetBoundsProvider>
          <ResolvedMonitorWorld
            {...props}
            onSelectedEntityChange={setSelectedEntityId}
            performanceMode={performanceMode}
            selectedEntityId={selectedEntityId}
          />
        </AssetBoundsProvider>
      </Canvas>
      {contextLost && (
        <div className="monitor-context-recovery" role="alert">
          <strong>3D 显卡上下文已重置</strong>
          <span>正在重建模型与贴图；如未自动恢复，请手动重试。</span>
          <button type="button" onClick={retryRenderer}>重建 3D 场景</button>
        </div>
      )}
    </>
  )
}
