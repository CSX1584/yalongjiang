import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { TilesRenderer, GlobeControls } from '3d-tiles-renderer'
import { GoogleCloudAuthPlugin, GLTFExtensionsPlugin, TileCompressionPlugin, TilesFadePlugin, UpdateOnChangePlugin } from '3d-tiles-renderer/plugins'
import { EffectComposer, EffectPass, RenderPass, NormalPass, ToneMappingEffect, ToneMappingMode, SMAAEffect } from 'postprocessing'
import { AerialPerspectiveEffect, LightingMaskPass, PrecomputedTexturesGenerator, SkyMaterial, SkyLightProbe, SunDirectionalLight, getSunDirectionECEF, getMoonDirectionECEF } from '@takram/three-atmosphere'
import { CloudsEffect, CloudLayers } from '@takram/three-clouds'
import { DataTextureLoader, parseUint8Array, STBNLoader, Geodetic, Ellipsoid, PointOfView } from '@takram/three-geospatial'
import { LensFlareEffect, DitheringEffect } from '@takram/three-geospatial-effects'
import { concreteTexture, disposeTree, upgradeStationMaterials, materialKind } from './stationPbrLayer.js'
import { SkyReflectionProbe } from './skyReflectionProbe.js'
import { TOKYO_PRESET, YALONG_ALTITUDE_OFFSET, YALONG_VIEW_TARGET } from './geospatialPreset.js'
import { ModelCloudShadow } from './geospatialCloudShadow.js'

export const STATION_COORDINATES = {
  kela: [101.0156, 30.0299], zhalashan: [101.672, 28.142],
  lianghekou: [100.391, 30.214], labashan: [101.508, 27.518],
}
const radians = THREE.MathUtils.degToRad
const FOUNDATION_TOP = 5.4586968421936035
const MODEL_TOP = 5.893375962972641
const shadowBounds = new THREE.Box3()
const shadowTransform = new THREE.Matrix4()

export function fitStationShadow(sun, object, localBounds) {
  sun.updateMatrixWorld(true)
  sun.target.updateMatrixWorld(true)
  sun.shadow.updateMatrices(sun)
  const camera = sun.shadow.camera
  shadowTransform.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld)
  shadowBounds.copy(localBounds).applyMatrix4(shadowTransform)
  const padding = Math.max(1, (shadowBounds.max.z - shadowBounds.min.z) * 0.02)
  Object.assign(camera, {
    left: shadowBounds.min.x - padding, right: shadowBounds.max.x + padding,
    bottom: shadowBounds.min.y - padding, top: shadowBounds.max.y + padding,
    near: Math.max(0.1, -shadowBounds.max.z - padding), far: -shadowBounds.min.z + padding,
  })
  camera.updateProjectionMatrix()
  const texel = Math.max((camera.right - camera.left) / sun.shadow.mapSize.x,
    (camera.top - camera.bottom) / sun.shadow.mapSize.y)
  // Bias follows shadow texel size, so changing the model scale does not bring
  // back PCF self-shadow stripes or detach its contact shadows by a fixed distance.
  sun.shadow.bias = -2 * texel / (camera.far - camera.near)
  sun.shadow.normalBias = texel
}

// Takram exposes distance scattering as a toggle. Blend only that stage so the
// sky, terrain lighting and cloud shadows keep their original strength.
export class AdjustableAerialPerspectiveEffect extends AerialPerspectiveEffect {
  constructor(...args) {
    super(...args)
    this.strength = new THREE.Uniform(1)
    const shader = this.getFragmentShader()
    const scattering = 'applyTransmittanceInscatter(positionECEF, shadowLength, radiance);'
    if (!shader.includes(scattering)) throw new Error('大气着色器接口已变更，请更新强度适配')
    this.uniforms.set('aerialPerspectiveStrength', this.strength)
    this.setFragmentShader('uniform float aerialPerspectiveStrength;\n' + shader.replace(scattering, `
      vec3 radianceBeforeScattering = radiance;
      ${scattering}
      radiance = mix(radianceBeforeScattering, radiance, aerialPerspectiveStrength);
    `))
  }
}

// Preserve the upstream local-date convention, including its zero-based day offset.
export function localSolarDate(longitude, timeOfDay, year = new Date().getFullYear(), dayOfYear = TOKYO_PRESET.dayOfYear) {
  return new Date(Date.UTC(year, 0, 1) + (Math.floor(dayOfYear) * 24 + timeOfDay - longitude / 15) * 3600000)
}

export function tokyoCameraView(coordinates = YALONG_VIEW_TARGET) {
  const target = new Geodetic(...coordinates.map(radians), YALONG_ALTITUDE_OFFSET).toECEF()
  const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), up = new THREE.Vector3()
  new PointOfView(TOKYO_PRESET.distance, radians(TOKYO_PRESET.heading), radians(TOKYO_PRESET.pitch))
    .decompose(target, position, quaternion, up)
  return { position, quaternion, up }
}

export function captureCamera(camera) {
  return {
    position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), up: camera.up.toArray(),
    fov: camera.fov, zoom: camera.zoom, near: camera.near, far: camera.far,
  }
}

export function restoreCamera(camera, saved) {
  camera.position.fromArray(saved.position)
  camera.quaternion.fromArray(saved.quaternion)
  camera.up.fromArray(saved.up)
  for (const key of ['fov', 'zoom', 'near', 'far']) camera[key] = saved[key]
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
}

export function setCloudAltitude(layers, firstAltitude) {
  layers.forEach((layer, index) => {
    layer.altitude = CloudLayers.DEFAULT[index].altitude + firstAltitude - CloudLayers.DEFAULT[0].altitude
  })
}

export function stationTransform(coordinates, deckHeight, scale, rotation) {
  const location = new Geodetic(...coordinates.map(radians))
  const surface = location.toECEF()
  location.height = deckHeight - FOUNDATION_TOP * scale
  const origin = location.toECEF()
  const east = new THREE.Vector3(), north = new THREE.Vector3(), up = new THREE.Vector3()
  Ellipsoid.WGS84.getEastNorthUpVectors(surface, east, north, up)
  return new THREE.Matrix4().makeBasis(east, up, north.negate()).setPosition(origin)
    .multiply(new THREE.Matrix4().makeRotationY(-radians(rotation)))
    .scale(new THREE.Vector3(scale, scale, scale))
}

export function createGeospatialScene({ container, stations, modelUrl, modelConfig, theme, apiKey, markerRefs, attribution, getOptions, onStatus, initialState, defaultState }) {
  if (!apiKey) throw new Error('尚未配置三维地形访问凭据')
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
  renderer.setPixelRatio(THREE.MathUtils.clamp(devicePixelRatio, 1, 2))
  renderer.setClearColor('#bfd7e7')
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.setAttribute('aria-label', '雅砻江三维地形，拖动平移，右键旋转，滚轮缩放')
  renderer.domElement.tabIndex = 0
  container.append(renderer.domElement)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(TOKYO_PRESET.fov, 1, 0.1, 1000)
  const tiles = new TilesRenderer()
  const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
  tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true }))
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco, autoDispose: false }))
  tiles.registerPlugin(new TileCompressionPlugin())
  tiles.registerPlugin(new UpdateOnChangePlugin())
  tiles.registerPlugin(new TilesFadePlugin())
  tiles.registerPlugin({
    name: 'terrain-normals',
    processTileModel(root) {
      root.traverse(node => {
        if (!node.isMesh || !node.geometry) return
        const original = node.geometry
        node.geometry = toCreasedNormals(original, radians(30))
        if (node.geometry !== original) original.dispose()
      })
    },
  })
  tiles.setCamera(camera)
  scene.add(tiles.group)
  const controls = new GlobeControls(tiles.group, camera, renderer.domElement)
  controls.setEllipsoid(tiles.ellipsoid, tiles.group)
  controls.enableDamping = true
  controls.adjustHeight = false
  controls.maxAltitude = Math.PI * 0.55

  const events = new THREE.EventDispatcher()
  // Reuse the existing card refraction renderer with the new scene's completed frame.
  const frameSource = {
    getCanvas: () => renderer.domElement,
    on: (type, listener) => events.addEventListener(type, listener),
    off: (type, listener) => events.removeEventListener(type, listener),
    triggerRepaint: () => { dirty = true },
  }
  let disposed = false, dirty = true, terrainLoaded = false, modelsLoaded = false
  let composer, aerial, clouds, sun, skyLight, skyMaterial, probeScene, environmentTarget, pmrem, mask, solarReflection
  const modelCloudShadow = new ModelCloudShadow()
  let resources = [], instances = [], bladeNodes = [], modelBounds
  const solarMaterials = []
  let lastOptions = '', lastFrame = 0, elapsed = 0
  let transition = null, attributionAt = 0, fatal = false
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const scratch = new THREE.Vector3()
  const projection = new THREE.Vector3(), worldTop = new THREE.Vector3()

  function report() {
    if (!disposed) onStatus({ ready: Boolean(composer && modelsLoaded && terrainLoaded), message: '' })
  }
  function flyTo(view, immediate = false) {
    controls.resetState()
    if (immediate || reducedMotion.matches) {
      camera.position.copy(view.position); camera.quaternion.copy(view.quaternion); camera.up.copy(view.up)
      transition = null
    } else transition = { ...view, fromPosition: camera.position.clone(), fromQuaternion: camera.quaternion.clone(), started: performance.now() }
    dirty = true
  }
  let restoredState = initialState, defaultCamera = defaultState?.camera ?? initialState?.camera
  const moveCamera = saved => {
    controls.resetState()
    controls.adjustHeight = false
    transition = null
    restoreCamera(camera, saved)
    dirty = true
  }
  const overview = () => defaultCamera ? moveCamera(defaultCamera) : flyTo(tokyoCameraView())
  if (initialState?.camera) moveCamera(initialState.camera)
  else flyTo(tokyoCameraView(), true)
  // Same as the story: avoid low-LOD height jumps on load, enable collision on first drag.
  const interrupt = () => { transition = null; dirty = true; controls.adjustHeight = true }
  controls.addEventListener('start', interrupt)
  controls.addEventListener('change', () => { dirty = true })

  const resize = () => {
    const width = container.clientWidth, height = container.clientHeight
    if (!width || !height) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    composer?.setSize(width, height)
    dirty = true
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()
  const fail = message => {
    if (!disposed) onStatus({ ready: false, message })
  }
  const logError = error => console.error('Geospatial scene:', String(error?.stack || error).replaceAll(apiKey, '[redacted]').replace(/(key|session)=[^&\s]+/g, '$1=[redacted]'))
  const lost = event => { event.preventDefault(); fatal = true; fail('图形上下文已中断，请重试加载') }
  renderer.domElement.addEventListener('webglcontextlost', lost)
  const tileLoaded = () => {
    dirty = true
    if (!terrainLoaded) { terrainLoaded = true; clearTimeout(loadingTimeout); report() }
  }
  const tileError = ({ error }) => {
    // Never send credential-bearing request URLs to the page or console.
    const message = String(error?.message || '')
    if (!terrainLoaded) fail(/401|403|400/.test(message) ? '三维地形访问被拒绝，请检查 Key 的 API 和来源限制' : '三维地形加载失败，请检查网络后重试')
  }
  tiles.addEventListener('load-model', tileLoaded)
  tiles.addEventListener('load-error', tileError)
  const loadingTimeout = setTimeout(() => { if (!terrainLoaded) fail('三维地形仍未加载，请检查网络后重试') }, 45000)

  async function initialize() {
    const atmosphereGenerator = new PrecomputedTexturesGenerator(renderer)
    resources.push(atmosphereGenerator)
    const textures = new THREE.TextureLoader()
    const volume = (name, size) => new DataTextureLoader(THREE.Data3DTexture, parseUint8Array, {
      width: size, height: size, depth: size, format: THREE.RedFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, wrapR: THREE.RepeatWrapping,
    }).loadAsync(`/sky/clouds/${name}.bin`)
    const keep = promise => promise.then(value => {
      const owned = value?.scene ? [value.scene] : value?.isTexture ? [value] : Object.values(value)
      if (disposed) owned.forEach(item => item?.isObject3D ? disposeTree(item) : item?.dispose?.())
      else resources.push(...owned)
      return value
    })
    const [atmosphere, weather, shape, detail, turbulence, stbn, gltf] = await Promise.all([
      atmosphereGenerator.update().then(() => atmosphereGenerator.textures),
      keep(textures.loadAsync('/sky/clouds/local_weather.png')), keep(volume('shape', 128)), keep(volume('shape_detail', 32)),
      keep(textures.loadAsync('/sky/clouds/turbulence.png')), keep(new STBNLoader().loadAsync('/sky/stbn.bin')),
      keep(new GLTFLoader().loadAsync(modelUrl)),
    ])
    if (disposed) return
    for (const texture of [weather, turbulence]) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.needsUpdate = true }
    clouds = new CloudsEffect(camera)
    clouds.qualityPreset = 'high'
    if (restoredState?.cloudMotion) {
      for (const key of ['localWeatherOffset', 'shapeOffset', 'shapeDetailOffset']) clouds[key].fromArray(restoredState.cloudMotion[key])
    }
    clouds.cloudLayers.set(CloudLayers.DEFAULT)
    clouds.shadow.farScale = 0.25
    Object.assign(clouds, atmosphere, { localWeatherTexture: weather, shapeTexture: shape, shapeDetailTexture: detail, turbulenceTexture: turbulence, stbnTexture: stbn })
    aerial = new AdjustableAerialPerspectiveEffect(camera, { ...atmosphere, sky: true, sunLight: true, skyLight: true, correctAltitude: true, correctGeometricError: true, albedoScale: 2 / Math.PI })
    aerial.stbnTexture = stbn
    composer = new EffectComposer(renderer, { multisampling: 0, frameBufferType: THREE.HalfFloatType })
    composer.addPass(new RenderPass(scene, camera))
    const normals = new NormalPass(scene, camera)
    normals.renderTarget.texture.type = THREE.HalfFloatType
    composer.addPass(normals)
    aerial.normalBuffer = normals.texture
    // Default mask: selected PBR models are black (already lit), terrain is white
    // (receives deferred sun/sky lighting and cloud shadows). Do not invert it.
    mask = new LightingMaskPass(scene, camera)
    composer.addPass(mask)
    aerial.lightingMask = { map: mask.texture, channel: 'r' }
    composer.addPass(new EffectPass(camera, clouds, aerial))
    composer.addPass(new EffectPass(camera, new LensFlareEffect(), new ToneMappingEffect({ mode: ToneMappingMode.AGX })))
    composer.addPass(new EffectPass(camera, new SMAAEffect(), new DitheringEffect()))
    const concrete = concreteTexture()
    resources.push(concrete)
    upgradeStationMaterials(gltf.scene, concrete, null, null, theme === 'light')
    modelBounds = new THREE.Box3().setFromObject(gltf.scene)
    gltf.scene.traverse(node => {
      if (!node.isMesh) return
      node.material.userData.hazeScale.value = 0 // AerialPerspective now supplies the scene's distance scattering.
      modelCloudShadow.apply(node.material)
      if (materialKind(node.name) === 'solar') solarMaterials.push(node.material)
    })
    instances = stations.map(station => {
      const object = gltf.scene.clone(true)
      object.matrixAutoUpdate = false
      const coordinates = STATION_COORDINATES[station.id]
      const instance = { station, object, coordinates, deckHeight: (modelConfig.stationElevations?.[station.id] ?? modelConfig.elevation) + FOUNDATION_TOP * modelConfig.scale }
      object.matrix.copy(stationTransform(coordinates, instance.deckHeight, modelConfig.scale, modelConfig.rotation))
      object.traverse(node => {
        if (node.isMesh) mask.selection.add(node)
        if (node.name === '风能叶片') bladeNodes.push({ node, rotation: node.rotation.x })
      })
      scene.add(object)
      return instance
    })
    sun = new SunDirectionalLight({ distance: 80000 })
    sun.transmittanceTexture = atmosphere.transmittanceTexture
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    skyLight = new SkyLightProbe({ irradianceTexture: atmosphere.irradianceTexture })
    scene.add(sun, sun.target, skyLight)
    skyMaterial = new SkyMaterial({ ...atmosphere, sun: false, moon: false })
    probeScene = new THREE.Scene()
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMaterial)
    sky.frustumCulled = false
    probeScene.add(sky)
    pmrem = new THREE.PMREMGenerator(renderer)
    solarReflection = new SkyReflectionProbe(renderer, probeScene, clouds, atmosphere)
    modelsLoaded = true
    resize(); report()
  }

  function draw(timestamp) {
    if (disposed || fatal || document.hidden || !getOptions().active) { lastFrame = timestamp; return }
    const delta = Math.min((timestamp - lastFrame) / 1000 || 1 / 60, 0.1)
    lastFrame = timestamp
    if (transition) {
      const t = Math.min(1, (timestamp - transition.started) / 1000), eased = 1 - (1 - t) ** 3
      camera.position.lerpVectors(transition.fromPosition, transition.position, eased)
      camera.quaternion.slerpQuaternions(transition.fromQuaternion, transition.quaternion, eased)
      camera.up.copy(transition.up)
      if (t === 1) transition = null
      dirty = true
    } else controls.update(delta)
    camera.updateMatrixWorld(true)
    tiles.setResolutionFromRenderer(camera, renderer)
    tiles.update()
    if (!composer || !modelsLoaded) return
    if (reducedMotion.matches && !dirty) return
    if (!reducedMotion.matches) elapsed += delta
    const options = getOptions(), key = JSON.stringify([options.coverage, options.year, options.dayOfYear, options.timeOfDay, options.exposure, options.cloudAltitude])
    if (key !== lastOptions) {
      lastOptions = key
      const date = localSolarDate(YALONG_VIEW_TARGET[0], options.timeOfDay, options.year, options.dayOfYear)
      getSunDirectionECEF(date, aerial.sunDirection)
      getMoonDirectionECEF(date, aerial.moonDirection)
      clouds.sunDirection.copy(aerial.sunDirection)
      sun.sunDirection.copy(aerial.sunDirection)
      skyLight.sunDirection.copy(aerial.sunDirection)
      skyMaterial.sunDirection.copy(aerial.sunDirection)
      clouds.coverage = options.coverage
      setCloudAltitude(clouds.cloudLayers, options.cloudAltitude)
      renderer.toneMappingExposure = options.exposure
      environmentTarget?.dispose()
      environmentTarget = pmrem.fromScene(probeScene, 0, 10, 1e7, { position: camera.position, size: 128 })
      scene.environment = environmentTarget.texture
    }
    clouds.clouds.hazeDensityScale = 3e-5 * options.haze // 100% retains Takram's default thin haze.
    aerial.strength.value = options.aerialPerspective
    clouds.localWeatherVelocity.set(reducedMotion.matches ? 0 : 0.001, 0)
    aerial.overlay = clouds.atmosphereOverlay
    aerial.shadow = clouds.atmosphereShadow
    aerial.shadowLength = clouds.atmosphereShadowLength
    skyLight.position.copy(camera.position); skyLight.update()
    for (const { node, rotation } of bladeNodes) node.rotation.x = rotation - elapsed * Math.PI / 3
    for (const instance of instances) {
      const config = options.modelConfig ?? modelConfig
      const deckHeight = (config.stationElevations?.[instance.station.id] ?? config.elevation) + FOUNDATION_TOP * config.scale
      instance.object.matrix.copy(stationTransform(instance.coordinates, deckHeight, config.scale, config.rotation))
      instance.object.updateMatrixWorld(true)
      const node = markerRefs.current.get(instance.station.id)
      if (!node) continue
      worldTop.set(0, MODEL_TOP, 0).applyMatrix4(instance.object.matrix)
      projection.copy(worldTop).project(camera)
      const width = container.clientWidth, height = container.clientHeight
      const visible = projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 1.2 && Math.abs(projection.y) < 1.2
      const x = THREE.MathUtils.clamp((projection.x * 0.5 + 0.5) * width, 115, width - 115)
      const y = (0.5 - projection.y * 0.5) * height
      node.style.transform = `translate3d(${x}px,${y}px,0)`
      node.style.opacity = visible ? '1' : '0'
      node.style.visibility = visible ? 'visible' : 'hidden'
    }
    const closest = instances.reduce((best, item) => item.object.getWorldPosition(scratch).distanceToSquared(camera.position) < best.object.getWorldPosition(worldTop).distanceToSquared(camera.position) ? item : best)
    sun.target.position.set(0, FOUNDATION_TOP, 0).applyMatrix4(closest.object.matrix)
    sun.update()
    fitStationShadow(sun, closest.object, modelBounds)
    // ponytail: one local sky probe for the nearest station; add per-station
    // probes only if several distant stations must be inspected at once.
    const reflection = solarReflection.update(worldTop.set(0, 5.7, 0).applyMatrix4(closest.object.matrix), key, timestamp)
    if (reflection) for (const material of solarMaterials) material.envMap = reflection
    // GlobeControls changes near/far while navigating; all depth-dependent passes need the new camera settings.
    mask.mainCamera = camera
    for (const pass of composer.passes) pass.fullscreenMaterial?.adoptCameraSettings?.(camera)
    const hadCloudShadow = modelCloudShadow.uniforms.stationShadowReady.value
    composer.render(reducedMotion.matches ? 0 : delta)
    // Forward materials sample the last completed cloud frame with its matching
    // matrices. Post-processing generates the next one after the model render.
    modelCloudShadow.update(clouds.atmosphereShadow, camera, clouds.sunDirection)
    events.dispatchEvent({ type: 'render' })
    if (timestamp - attributionAt > 1000) {
      attributionAt = timestamp
      attribution.textContent = ['Google Maps', ...tiles.getAttributions().filter(item => item.type === 'string').map(item => item.value)].filter(Boolean).join(' · ')
    }
    dirty = !hadCloudShadow || solarReflection.face < 6 // Complete initial shadows and all reflection faces in reduced motion.
  }
  renderer.setAnimationLoop(timestamp => {
    try { draw(timestamp) } catch (error) { logError(error); fatal = true; fail('三维场景渲染中断，请重试加载') }
  })
  initialize().catch(error => { if (!disposed) { logError(error); fatal = true; fail('天空或电站资源加载失败，请重试') } })

  return {
    frameSource,
    overview,
    snapshot() {
      if (!clouds || !modelsLoaded || !terrainLoaded) throw new Error('请等待场景加载完成后保存')
      return {
        camera: captureCamera(camera),
        cloudMotion: Object.fromEntries(['localWeatherOffset', 'shapeOffset', 'shapeDetailOffset'].map(key => [key, clouds[key].toArray()])),
      }
    },
    setDefaultCamera(saved) { defaultCamera = saved },
    applyState(saved) {
      restoredState = saved
      moveCamera(saved.camera)
      if (clouds) for (const key of ['localWeatherOffset', 'shapeOffset', 'shapeDetailOffset']) clouds[key].fromArray(saved.cloudMotion[key])
      lastOptions = ''
      modelCloudShadow.uniforms.stationShadowReady.value = false
    },
    tokyoView() {
      camera.fov = TOKYO_PRESET.fov; camera.zoom = 1; camera.updateProjectionMatrix()
      flyTo(tokyoCameraView())
    },
    focus(id) {
      const coordinates = STATION_COORDINATES[id]
      if (coordinates) flyTo(tokyoCameraView(coordinates))
    },
    invalidate() { dirty = true },
    dispose() {
      disposed = true
      clearTimeout(loadingTimeout)
      renderer.setAnimationLoop(null)
      observer.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      controls.dispose(); tiles.dispose(); draco.dispose()
      mask?.selection.clear()
      solarReflection?.dispose()
      composer?.dispose(); environmentTarget?.dispose(); pmrem?.dispose()
      if (probeScene) disposeTree(probeScene)
      resources.forEach(item => item?.isObject3D ? disposeTree(item) : item?.dispose?.())
      sun?.shadow.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
