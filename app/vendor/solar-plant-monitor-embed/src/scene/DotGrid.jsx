import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { syncInfiniteGroundToCamera } from './infiniteGround.js'

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uSpacing;
  uniform float uDotRadius;
  uniform vec3 uBaseColor;
  uniform vec3 uDotColor;
  uniform vec3 uCameraPosition;
  uniform vec3 uBackgroundColor;
  uniform float uHorizonNear;
  uniform float uHorizonFar;
  varying vec3 vWorldPosition;

  void main() {
    vec2 cell = fract(vWorldPosition.xz / uSpacing + 0.5) - 0.5;
    float distanceToDot = length(cell);
    float antialias = max(fwidth(distanceToDot), 0.004);
    float dot = 1.0 - smoothstep(uDotRadius - antialias, uDotRadius + antialias, distanceToDot);
    float horizontalDistance = length(vWorldPosition.xz - uCameraPosition.xz);
    float distanceFade = 1.0 - smoothstep(
      65.0,
      120.0,
      horizontalDistance
    );
    vec3 color = mix(uBaseColor, uDotColor, dot * (0.45 + distanceFade * 0.55));
    float horizonFade = smoothstep(uHorizonNear, uHorizonFar, horizontalDistance);
    color = mix(color, uBackgroundColor, horizonFade);
    gl_FragColor = vec4(color, 1.0);
  }
`

export function DotGrid({
  backgroundColor = '#111111',
  baseColor = '#555555',
  dotColor = '#999999',
  spacing = 2,
  fadeRange = [220, 650],
}) {
  const meshRef = useRef(null)
  const uniforms = useMemo(
    () => ({
      uSpacing: { value: spacing },
      uDotRadius: { value: 0.055 },
      uBaseColor: { value: new THREE.Color(baseColor) },
      uDotColor: { value: new THREE.Color(dotColor) },
      uCameraPosition: { value: new THREE.Vector3() },
      uBackgroundColor: { value: new THREE.Color(backgroundColor) },
      uHorizonNear: { value: fadeRange[0] },
      uHorizonFar: { value: fadeRange[1] },
    }),
    [backgroundColor, baseColor, dotColor],
  )

  useEffect(() => {
    uniforms.uSpacing.value = spacing
  }, [spacing, uniforms])

  useEffect(() => {
    uniforms.uHorizonNear.value = fadeRange[0]
    uniforms.uHorizonFar.value = fadeRange[1]
  }, [fadeRange, uniforms])

  useFrame(({ camera }) => {
    syncInfiniteGroundToCamera(meshRef.current, camera)
    uniforms.uCameraPosition.value.copy(camera.position)
  })

  return (
    <mesh
      ref={meshRef}
      rotation-x={-Math.PI / 2}
      position-y={-0.035}
      frustumCulled={false}
      receiveShadow
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        toneMapped={false}
      />
    </mesh>
  )
}
