import * as THREE from 'three'
import { Ellipsoid, unrollLoops } from '@takram/three-geospatial'
import { cascadedShadowMaps, raySphereIntersection } from '@takram/three-geospatial/shaders'
import { AtmosphereParameters, getAltitudeCorrectionOffset } from '@takram/three-atmosphere'

const shadowGLSL = `
  precision highp sampler2DArray;
  #define SHADOW_CASCADE_COUNT 3
  uniform bool stationShadowReady;
  uniform sampler2DArray stationShadowMap;
  uniform mat4 stationShadowMatrices[3];
  uniform vec2 stationShadowIntervals[3];
  uniform mat4 stationShadowView;
  uniform float stationShadowNear;
  uniform float stationShadowFar;
  uniform float stationShadowTopRadius;
  uniform vec3 stationShadowSun;
  uniform vec3 stationShadowAltitudeCorrection;
  varying vec3 stationShadowWorld;
  ${unrollLoops(cascadedShadowMaps)}
  ${raySphereIntersection}

  float stationSunTransmission() {
    if (!stationShadowReady) return 1.0;
    int cascade = getCascadeIndex(stationShadowView, stationShadowWorld,
      stationShadowIntervals, stationShadowNear, stationShadowFar);
    vec4 clip = stationShadowMatrices[cascade] * vec4(stationShadowWorld, 1.0);
    vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
    float distanceToTop = raySphereSecondIntersection(
      stationShadowWorld + stationShadowAltitudeCorrection, stationShadowSun, stationShadowTopRadius);
    if (distanceToTop <= 0.0) return 1.0;
    vec2 texel = 1.0 / vec2(textureSize(stationShadowMap, 0).xy);
    float opticalDepth = 0.0;
    for (int y = -1; y <= 1; ++y) {
      for (int x = -1; x <= 1; ++x) {
        vec4 shadow = texture(stationShadowMap, vec3(uv + vec2(x, y) * texel, float(cascade)));
        // Same Beer shadow-map channels as Takram's terrain receiver. Respect
        // receiver altitude: objects inside/above a cloud do not get its full shadow.
        opticalDepth += min(shadow.b, shadow.g * max(0.0, distanceToTop - shadow.r));
      }
    }
    return exp(-opticalDepth / 9.0);
  }
`

// The terrain is lit in post-processing; PBR equipment needs the same cloud
// attenuation before its direct-light BRDF, including the glass clearcoat.
export class ModelCloudShadow {
  constructor() {
    this.uniforms = {
      stationShadowReady: new THREE.Uniform(false),
      stationShadowMap: new THREE.Uniform(null),
      stationShadowMatrices: new THREE.Uniform(Array.from({ length: 3 }, () => new THREE.Matrix4())),
      stationShadowIntervals: new THREE.Uniform(Array.from({ length: 3 }, () => new THREE.Vector2())),
      stationShadowView: new THREE.Uniform(new THREE.Matrix4()),
      stationShadowNear: new THREE.Uniform(0.1),
      stationShadowFar: new THREE.Uniform(1),
      stationShadowTopRadius: new THREE.Uniform(0),
      stationShadowSun: new THREE.Uniform(new THREE.Vector3()),
      stationShadowAltitudeCorrection: new THREE.Uniform(new THREE.Vector3()),
    }
  }

  apply(material) {
    const previous = material.onBeforeCompile
    const previousKey = material.customProgramCacheKey.bind(material)
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer)
      Object.assign(shader.uniforms, this.uniforms)
      shader.vertexShader = 'varying vec3 stationShadowWorld;\n' + shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nstationShadowWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n#include <packing>\n' + shadowGLSL)
      const directSun = 'getDirectionalLightInfo( directionalLight, directLight );'
      if (!THREE.ShaderChunk.lights_fragment_begin.includes(directSun)) throw new Error('模型光照着色器接口已变更')
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>',
        THREE.ShaderChunk.lights_fragment_begin.replace(directSun, directSun + '\ndirectLight.color *= stationSunTransmission();'))
    }
    material.customProgramCacheKey = () => previousKey() + '-geospatial-cloud-shadow-v1'
    material.needsUpdate = true
  }

  update(shadow, camera, sunDirection) {
    const u = this.uniforms
    u.stationShadowReady.value = shadow != null
    if (!shadow) return
    if (shadow.cascadeCount !== 3) throw new Error('模型云影需要 Tokyo 的三级阴影配置')
    u.stationShadowMap.value = shadow.map
    u.stationShadowMatrices.value = shadow.matrices
    u.stationShadowIntervals.value = shadow.intervals
    u.stationShadowView.value.copy(camera.matrixWorldInverse)
    u.stationShadowNear.value = camera.near
    u.stationShadowFar.value = shadow.far
    u.stationShadowTopRadius.value = AtmosphereParameters.DEFAULT.bottomRadius + shadow.topHeight
    u.stationShadowSun.value.copy(sunDirection)
    getAltitudeCorrectionOffset(camera.position, AtmosphereParameters.DEFAULT.bottomRadius,
      Ellipsoid.WGS84, u.stationShadowAltitudeCorrection.value)
  }
}
