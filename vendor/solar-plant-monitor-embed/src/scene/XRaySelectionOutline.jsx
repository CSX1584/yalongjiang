import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  AlwaysStencilFunc,
  BoxGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  EqualStencilFunc,
  InvertStencilOp,
  KeepStencilOp,
  ReplaceStencilOp,
  Vector2,
} from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useLayoutEffect, useRef } from 'react'
import {
  XRAY_OUTLINE_FRAGMENT_SHADER,
  XRAY_OUTLINE_VERTEX_SHADER,
} from './xrayOutlineShaders.js'

const XRAY_MASK_RENDER_ORDER = 20
const XRAY_OUTLINE_RENDER_ORDER = 21
const XRAY_OUTLINE_PASS_COUNT = 8
const XRAY_OUTLINE_DIRECTIONS = Array.from(
  { length: XRAY_OUTLINE_PASS_COUNT },
  (_, index) => {
    const angle = (index * Math.PI * 2) / XRAY_OUTLINE_PASS_COUNT
    return [Math.cos(angle), Math.sin(angle)]
  },
)

function prepareOutlineGeometry(geometry) {
  const drawCount =
    geometry.getIndex()?.count ?? geometry.getAttribute('position').count

  geometry.clearGroups()
  XRAY_OUTLINE_DIRECTIONS.forEach((_, materialIndex) => {
    geometry.addGroup(0, drawCount, materialIndex)
  })
  return geometry
}

function createBoxOutlineGeometry(width, height, depth) {
  const source = new BoxGeometry(width, height, depth)
  source.deleteAttribute('normal')
  source.deleteAttribute('uv')
  const geometry = mergeVertices(source)
  source.dispose()
  return prepareOutlineGeometry(geometry)
}

function useOutlineUniforms(opacity, thickness, color) {
  const size = useThree((state) => state.size)

  return useMemo(() => {
    const sharedUniforms = {
      color: { value: new Color(color) },
      opacity: { value: opacity },
      thickness: { value: thickness },
      viewportSize: {
        value: new Vector2(
          Math.max(size.width, 1),
          Math.max(size.height, 1),
        ),
      },
    }

    return XRAY_OUTLINE_DIRECTIONS.map(([x, y]) => ({
      ...sharedUniforms,
      outlineOffset: { value: new Vector2(x, y) },
    }))
  }, [color, opacity, size.height, size.width, thickness])
}

function XRayGeometryOutline({
  maskGeometry,
  outlineGeometry,
  color,
  opacity,
  thickness,
  stencilSlot,
}) {
  const uniformsByPass = useOutlineUniforms(opacity, thickness, color)
  const maskStencilBit = 1 << (stencilSlot * 2)
  const outlineStencilBit = 1 << (stencilSlot * 2 + 1)
  const stencilBits = maskStencilBit | outlineStencilBit

  return (
    <>
      <mesh
        geometry={maskGeometry}
        raycast={() => null}
        renderOrder={XRAY_MASK_RENDER_ORDER}
      >
        <meshBasicMaterial
          colorWrite={false}
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
          stencilFail={KeepStencilOp}
          stencilFunc={AlwaysStencilFunc}
          stencilRef={maskStencilBit}
          stencilWrite
          stencilWriteMask={maskStencilBit}
          stencilZFail={KeepStencilOp}
          stencilZPass={ReplaceStencilOp}
          transparent
        />
      </mesh>

      <mesh
        geometry={outlineGeometry}
        raycast={() => null}
        renderOrder={XRAY_OUTLINE_RENDER_ORDER}
      >
        {uniformsByPass.map((uniforms, passIndex) => (
          <shaderMaterial
            key={passIndex}
            attach={`material-${passIndex}`}
            depthTest={false}
            depthWrite={false}
            fragmentShader={XRAY_OUTLINE_FRAGMENT_SHADER}
            side={DoubleSide}
            stencilFail={KeepStencilOp}
            stencilFunc={EqualStencilFunc}
            stencilFuncMask={stencilBits}
            stencilRef={0}
            stencilWrite
            stencilWriteMask={outlineStencilBit}
            stencilZFail={KeepStencilOp}
            stencilZPass={InvertStencilOp}
            toneMapped={false}
            transparent
            uniforms={uniforms}
            vertexShader={XRAY_OUTLINE_VERTEX_SHADER}
          />
        ))}
      </mesh>
    </>
  )
}

export function XRaySelectionOutline({
  dimensions,
  color = '#eeeeee',
  opacity = 1,
  thickness = 5.5,
  stencilSlot = 0,
}) {
  const [width, height, depth] = dimensions
  const maskGeometry = useMemo(
    () => new BoxGeometry(width, height, depth),
    [depth, height, width],
  )
  const outlineGeometry = useMemo(
    () => createBoxOutlineGeometry(width, height, depth),
    [depth, height, width],
  )

  useEffect(
    () => () => {
      maskGeometry.dispose()
      outlineGeometry.dispose()
    },
    [maskGeometry, outlineGeometry],
  )

  return (
    <XRayGeometryOutline
      maskGeometry={maskGeometry}
      outlineGeometry={outlineGeometry}
      color={color}
      opacity={opacity}
      thickness={thickness}
      stencilSlot={stencilSlot}
    />
  )
}

export function XRayInstancedBoundsOutline({
  matrices,
  capacity = matrices.length,
  color = '#ffffff',
  objectNamePrefix = '',
  opacity = 0.92,
  thickness = 3.2,
  stencilSlot = 0,
}) {
  const maskGeometry = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const outlineGeometry = useMemo(
    () => createBoxOutlineGeometry(1, 1, 1),
    [],
  )
  const maskRef = useRef(null)
  const outlineRef = useRef(null)
  const uniformsByPass = useOutlineUniforms(opacity, thickness, color)
  const maskStencilBit = 1 << (stencilSlot * 2)
  const outlineStencilBit = 1 << (stencilSlot * 2 + 1)
  const stencilBits = maskStencilBit | outlineStencilBit
  const resolvedCapacity = Math.max(1, capacity, matrices.length)
  const visible = matrices.length > 0
  const maskName = objectNamePrefix ? `${objectNamePrefix}-mask` : undefined
  const outlineName = objectNamePrefix
    ? `${objectNamePrefix}-strokes`
    : undefined

  useLayoutEffect(() => {
    const mask = maskRef.current
    const outline = outlineRef.current
    if (!mask || !outline) return

    matrices.forEach((matrix, index) => {
      mask.setMatrixAt(index, matrix)
      outline.setMatrixAt(index, matrix)
    })
    mask.count = matrices.length
    outline.count = matrices.length
    if (matrices.length > 0) {
      const updateCount = matrices.length * 16
      mask.instanceMatrix.setUsage(DynamicDrawUsage)
      outline.instanceMatrix.setUsage(DynamicDrawUsage)
      mask.instanceMatrix.clearUpdateRanges()
      outline.instanceMatrix.clearUpdateRanges()
      mask.instanceMatrix.addUpdateRange(0, updateCount)
      outline.instanceMatrix.addUpdateRange(0, updateCount)
      mask.instanceMatrix.needsUpdate = true
      outline.instanceMatrix.needsUpdate = true
    }
  }, [matrices])

  useEffect(
    () => () => {
      maskGeometry.dispose()
      outlineGeometry.dispose()
    },
    [maskGeometry, outlineGeometry],
  )

  return (
    <>
      <instancedMesh
        ref={maskRef}
        args={[maskGeometry, undefined, resolvedCapacity]}
        frustumCulled={false}
        name={maskName}
        raycast={() => null}
        renderOrder={XRAY_MASK_RENDER_ORDER}
        visible={visible}
      >
        <meshBasicMaterial
          colorWrite={false}
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
          stencilFail={KeepStencilOp}
          stencilFunc={AlwaysStencilFunc}
          stencilRef={maskStencilBit}
          stencilWrite
          stencilWriteMask={maskStencilBit}
          stencilZFail={KeepStencilOp}
          stencilZPass={ReplaceStencilOp}
          transparent
        />
      </instancedMesh>

      <instancedMesh
        ref={outlineRef}
        args={[outlineGeometry, undefined, resolvedCapacity]}
        frustumCulled={false}
        name={outlineName}
        raycast={() => null}
        renderOrder={XRAY_OUTLINE_RENDER_ORDER}
        visible={visible}
      >
        {uniformsByPass.map((uniforms, passIndex) => (
          <shaderMaterial
            key={passIndex}
            attach={`material-${passIndex}`}
            depthTest={false}
            depthWrite={false}
            fragmentShader={XRAY_OUTLINE_FRAGMENT_SHADER}
            side={DoubleSide}
            stencilFail={KeepStencilOp}
            stencilFunc={EqualStencilFunc}
            stencilFuncMask={stencilBits}
            stencilRef={0}
            stencilWrite
            stencilWriteMask={outlineStencilBit}
            stencilZFail={KeepStencilOp}
            stencilZPass={InvertStencilOp}
            toneMapped={false}
            transparent
            uniforms={uniforms}
            vertexShader={XRAY_OUTLINE_VERTEX_SHADER}
          />
        ))}
      </instancedMesh>
    </>
  )
}
