import * as THREE from 'three'
import { EffectPass } from 'postprocessing'
import { CloudsEffect } from '@takram/three-clouds'

// Reuse the visible sky's actual weather field, altitude and sun. Capture time
// stays fixed for all six directions; the probe never advances a second weather simulation.
export function copyReflectionWeather(target, source) {
  target.coverage = source.coverage
  target.cloudLayers.set(source.cloudLayers)
  target.sunDirection.copy(source.sunDirection)
  target.worldToECEFMatrix.copy(source.worldToECEFMatrix)
  target.correctAltitude = source.correctAltitude
  target.haze = source.haze
  target.clouds.hazeDensityScale = source.clouds.hazeDensityScale
  for (const key of ['localWeatherOffset', 'shapeOffset', 'shapeDetailOffset', 'localWeatherRepeat', 'shapeRepeat', 'shapeDetailRepeat', 'turbulenceRepeat']) target[key].copy(source[key])
}

export class SkyReflectionProbe {
  constructor(renderer, skyScene, source, atmosphere) {
    this.renderer = renderer; this.skyScene = skyScene; this.source = source
    this.camera = new THREE.PerspectiveCamera(90, 1, 1, 1e7)
    this.clouds = new CloudsEffect(this.camera)
    this.clouds.qualityPreset = 'high'
    this.clouds.skipRendering = false // Composite clouds into the captured sky radiance.
    this.clouds.resolutionScale = 1
    this.clouds.temporalUpscale = false
    this.clouds.cloudsPass.resolveMaterial.uniforms.temporalAlpha.value = 1
    this.clouds.shadow.temporalPass = false
    this.clouds.shadow.mapSize.set(128, 128)
    this.clouds.lightShafts = false
    Object.assign(this.clouds, atmosphere)
    for (const key of ['localWeatherTexture', 'shapeTexture', 'shapeDetailTexture', 'turbulenceTexture', 'stbnTexture']) this.clouds[key] = source[key]
    this.input = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, depthBuffer: true })
    this.input.depthTexture = new THREE.DepthTexture(256, 256)
    this.output = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, depthBuffer: false })
    this.cube = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, depthBuffer: false })
    this.pass = new EffectPass(this.camera, this.clouds)
    this.pass.initialize(renderer, false, THREE.HalfFloatType)
    this.pass.setSize(256, 256); this.pass.setDepthTexture(this.input.depthTexture)
    this.copyScene = new THREE.Scene()
    this.copy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, uniforms: { source: { value: this.output.texture } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: 'uniform sampler2D source;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(source,vUv).rgb,1.);}',
    }))
    this.copy.frustumCulled = false // The full-screen quad is independent of the ECEF capture camera.
    this.copyScene.add(this.copy)
    this.pmrem = new THREE.PMREMGenerator(renderer)
    this.face = 6; this.lastCapture = -Infinity; this.key = null
    this.lookAt = new THREE.Vector3()
  }

  update(position, key, timestamp) {
    if (key !== this.key || this.camera.position.distanceTo(position) > 1000 || (this.face === 6 && timestamp - this.lastCapture > 1500)) {
      this.key = key; this.face = 0; this.lastCapture = timestamp
      this.camera.position.copy(position)
      copyReflectionWeather(this.clouds, this.source)
    }
    if (this.face === 6) return null
    const renderer = this.renderer
    const previous = renderer.getRenderTarget(), previousFace = renderer.getActiveCubeFace(), previousMip = renderer.getActiveMipmapLevel()
    const [x, y, z, ux, uy, uz] = [[1,0,0,0,-1,0],[-1,0,0,0,-1,0],[0,1,0,0,0,1],[0,-1,0,0,0,-1],[0,0,1,0,-1,0],[0,0,-1,0,-1,0]][this.face]
    try {
      this.camera.up.set(ux, uy, uz)
      this.camera.lookAt(this.lookAt.set(x, y, z).add(this.camera.position))
      this.camera.updateMatrixWorld(true)
      renderer.setRenderTarget(this.input); renderer.clear(); renderer.render(this.skyScene, this.camera)
      this.pass.render(renderer, this.input, this.output, 0, false)
      renderer.setRenderTarget(this.cube, this.face); renderer.render(this.copyScene, this.camera)
      if (++this.face === 6) {
        this.environment = this.pmrem.fromCubemap(this.cube.texture, this.environment)
        return this.environment.texture
      }
    } finally { renderer.setRenderTarget(previous, previousFace, previousMip) }
    return null
  }

  dispose() {
    this.pass.dispose(); this.input.dispose(); this.output.dispose(); this.cube.dispose()
    this.environment?.dispose(); this.pmrem.dispose()
    this.copy.geometry.dispose(); this.copy.material.dispose()
  }
}
