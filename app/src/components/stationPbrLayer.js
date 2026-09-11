import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createStationSky, CLOUD_UV_GLSL, SKY_TONE_GLSL, CLOUD_VELOCITY, cloudWindAt } from './stationSky.js'

export const PBR_LAYER_ID = 'ops-station-pbr'
const NATIVE_LAYER_ID = 'ops-station-model-layer'

// Preserve canvas alpha: changing it exposes the light fallback beneath Mapbox.
export const TERRAIN_SHADOW_BLEND = {
  blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
}

export function concreteTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')
  const pixels = ctx.createImageData(512, 512)
  let seed = 19
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const gray = 175 + (seed / 4294967296 - 0.5) * 22
    pixels.data.set([gray + 5, gray + 3, gray, 255], i)
  }
  ctx.putImageData(pixels, 0, 0)
  for (let i = 0; i < 32; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const x = seed % 512, y = (seed >>> 9) % 512, radius = 24 + (seed % 80)
    const patch = ctx.createRadialGradient(x, y, 0, x, y, radius)
    patch.addColorStop(0, 'rgba(95,89,78,0.035)')
    patch.addColorStop(1, 'rgba(95,89,78,0)')
    ctx.fillStyle = patch
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  ctx.strokeStyle = 'rgba(75,72,65,0.3)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, 510, 510)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 3)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function materialKind(name) {
  if (name.includes('光伏面板')) return 'solar'
  if (name.includes('底座')) return 'concrete'
  return 'metal'
}

export function disposeTree(root) {
  const resources = new Set()
  root.traverse(node => {
    if (node.geometry) resources.add(node.geometry)
    for (const material of [].concat(node.material || [])) {
      resources.add(material)
      Object.values(material).forEach(value => { if (value?.isTexture) resources.add(value) })
    }
  })
  resources.forEach(resource => resource.dispose())
}

const CLOUD_PROJECTION_GLSL = `
  precision highp sampler2DArray;
  uniform sampler2DArray stationCloudMap;
  uniform mat4 stationCloudMatrices[3];
  uniform vec2 stationWind;
  uniform mat4 stationToMercator;
  uniform vec3 stationCloudOrigin;
  uniform vec3 stationCloudEye;
  uniform vec3 stationReflectionCapture;
  uniform vec3 stationReflectionDrift;
  uniform vec3 stationSun;
  uniform float stationUnits;
  varying vec3 stationWorld;
  ${CLOUD_UV_GLSL}
  float stationCloudShadow(vec3 world) {
    vec3 p = (world - stationCloudOrigin) / stationUnits;
    // Takram's sun-space Beer shadow map uses east/up/south coordinates.
    vec3 skyWorld = p.xzy;
    float result=0.;
    // Blend overlapping cascades instead of abruptly switching shadow resolution at their edges.
    for (int cascade=2; cascade>=0; cascade--) {
      vec4 clip=stationCloudMatrices[cascade]*vec4(skyWorld,1.);
      vec2 uv=clip.xy/clip.w*.5+.5;
      if(any(lessThan(uv,vec2(.02))) || any(greaterThan(uv,vec2(.98))))continue;
      vec2 texel=1./vec2(textureSize(stationCloudMap,0).xy);
      float transmission=0.;
      for(int i=0;i<9;i++) {
        vec2 offset=vec2(float(i%3)-1.,float(i/3)-1.)*texel*1.5;
        transmission+=exp(-texture(stationCloudMap,vec3(uv+offset,float(cascade))).b);
      }
      float edge=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));
      result=mix(result,1.-transmission/9.,smoothstep(.02,.1,edge));
    }
    return result*(1.-smoothstep(180000.,250000.,distance(world,stationCloudEye)/stationUnits));
  }

`

export function upgradeStationMaterials(model, concrete, environment, cloudUniforms, lightTheme = false) {
  model.traverse(node => {
    if (!node.isMesh) return
    const old = node.material
    const kind = materialKind(node.name)
    const material = new THREE.MeshPhysicalMaterial()
    THREE.MeshStandardMaterial.prototype.copy.call(material, old)
    material.emissive.set('#000000')
    material.envMapIntensity = 1
    if (kind === 'solar') {
      material.color.set('#c4cbd0')
      // A continuous glass coat sits above the cell texture and baked normals.
      // Keep only slight frosting; old roughness/metal maps describe the cells.
      material.metalnessMap = null
      material.roughnessMap = null
      material.metalness = 0
      material.roughness = 0.16
      material.clearcoat = 1
      material.clearcoatRoughness = 0.08
      material.ior = 1.5
      material.envMapIntensity = 1.35
      if (environment) {
        // The light-theme glass softly filters the sky reflection; the cell texture stays sharp.
        material.userData.cloudIntensity = { value: 1 }
        material.userData.cloudEnvironment = { value: environment }
        material.onBeforeCompile = shader => {
          shader.uniforms.cloudEnvironment = material.userData.cloudEnvironment
          shader.uniforms.cloudIntensity = material.userData.cloudIntensity
          shader.fragmentShader = 'uniform sampler2D cloudEnvironment; uniform float cloudIntensity;\n' + shader.fragmentShader
          shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
            #ifdef USE_ENVMAP
              vec3 glassNormal = normalize(vNormal);
              #ifdef DOUBLE_SIDED
                glassNormal *= faceDirection;
              #endif
              vec3 glassDirection = mat3(stationToMercator) * inverseTransformDirection(reflect(-normalize(vViewPosition), glassNormal), viewMatrix);
              ${lightTheme ? `
              // A nearby cloud layer needs positional parallax across the kilometer-scale panels.
              vec3 panelPosition = ((stationWorld - stationCloudOrigin) / stationUnits).xzy;
              vec3 reflectedRay = normalize(glassDirection.xzy);
              float cloudDistance = max(9500. - panelPosition.y, 0.) / max(reflectedRay.y, .025);
              vec3 cloudPoint = panelPosition + reflectedRay * cloudDistance - stationReflectionDrift;
              // ponytail: one local probe; distant stations use sky IBL until they become the closest station.
              float localProbe = 1. - smoothstep(20000., 60000., distance(panelPosition, stationReflectionCapture));
              glassDirection = mix(reflectedRay, normalize(cloudPoint - stationReflectionCapture),
                localProbe * smoothstep(.025, .1, reflectedRay.y)).xzy;
              ` : ''}
              vec3 cloudReflection = ${lightTheme
                ? 'textureLod(cloudEnvironment, stationCloudUV(glassDirection.xzy, stationWind), 3.5)'
                : 'texture2D(cloudEnvironment, stationCloudUV(glassDirection.xzy, stationWind))'}.rgb;
              float glassFresnel = ${lightTheme ? '.42 + .22' : '.38 + .35'} * pow(1. - abs(dot(normalize(vViewPosition), glassNormal)), 5.);
              outgoingLight = mix(outgoingLight, cloudReflection * cloudIntensity, glassFresnel);
            #endif
            #include <opaque_fragment>`)
        }
        material.customProgramCacheKey = () => 'station-cloud-glass-v1'
      }
    } else if (kind === 'concrete') {
      // Box-projected UVs avoid dependence on the old untextured slab's unwrap.
      const geometry = node.geometry.clone()
      const positions = geometry.attributes.position, normals = geometry.attributes.normal
      geometry.computeBoundingBox()
      const uv = new Float32Array(positions.count * 2)
      for (let i = 0; i < positions.count; i++) {
        const nx = Math.abs(normals.getX(i)), ny = Math.abs(normals.getY(i)), nz = Math.abs(normals.getZ(i))
        uv[i * 2] = ny >= nx && ny >= nz ? positions.getX(i) : nx > nz ? positions.getZ(i) : positions.getX(i)
        uv[i * 2 + 1] = ny >= nx && ny >= nz ? positions.getZ(i) : positions.getY(i)
      }
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      node.geometry.dispose()
      node.geometry = geometry
      material.color.set('#dad9d5')
      material.map = concrete
      material.normalMap = null
      material.metalnessMap = null
      material.roughnessMap = null
      material.metalness = 0
      material.roughness = 0.94
      material.bumpMap = concrete
      material.bumpScale = 0.003
    } else {
      material.metalnessMap = null
      material.roughnessMap = null
      material.color.set(node.name.includes('储能') ? '#ffffff' : '#d9e0e5')
      material.metalness = node.name.includes('储能') ? 0.38 : 0.9
      material.roughness = node.name.includes('储能') ? 0.23 : 0.18
      material.clearcoat = 0.28
      material.clearcoatRoughness = 0.3
    }
    material.userData.hazeColor = { value: new THREE.Color('#e6eff5') }
    material.userData.hazeScale = { value: 5550 / 650000 }
    const customize = material.onBeforeCompile
    material.onBeforeCompile = shader => {
      customize(shader)
      if (lightTheme && material.normalMap) {
        // The light GLB stores signed normals: (0, 0, 1) is flat, not (0.5, 0.5, 1).
        // ponytail: retain surviving baked detail; re-bake from the source mesh to recover clipped negative channels.
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
          THREE.ShaderChunk.normal_fragment_maps.replace(
            'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
            'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz;'))
      }
      if (node.name.includes('储能')) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), 0.28);
        ${lightTheme ? `
        // Lighten the painted housing's albedo without whitening grille and label details.
        float housingPaint = smoothstep(.45, .8, dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)));
        // ponytail: display albedo gain for the map asset; calibrated material values are needed for photometric output.
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.6), .8 * housingPaint);
        ` : ''}`)
      shader.uniforms ||= {}
      if (cloudUniforms) {
        Object.assign(shader.uniforms, cloudUniforms)
        shader.vertexShader = 'uniform mat4 stationToMercator; varying vec3 stationWorld;\n' + shader.vertexShader
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
          'stationWorld = (stationToMercator * modelMatrix * vec4(transformed, 1.)).xyz;\n#include <project_vertex>')
        shader.fragmentShader = CLOUD_PROJECTION_GLSL + shader.fragmentShader
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>',
          '#include <lights_fragment_end>\nfloat cloudLight = 1. - stationCloudShadow(stationWorld) * .48;\nreflectedLight.directDiffuse *= cloudLight; reflectedLight.directSpecular *= cloudLight;')
      }
      // Sky IBL and hemisphere fill otherwise wash out the equipment's sun-facing contrast.
      if (lightTheme && kind === 'metal') shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        reflectedLight.indirectDiffuse *= .32;
        reflectedLight.indirectSpecular *= .45;
        #ifdef USE_CLEARCOAT
          clearcoatSpecularIndirect *= .45;
        #endif`)
      shader.uniforms.stationHazeColor = material.userData.hazeColor
      shader.uniforms.stationHazeScale = material.userData.hazeScale
      shader.fragmentShader = 'uniform vec3 stationHazeColor; uniform float stationHazeScale;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float stationDistance = length(vViewPosition) * stationHazeScale;
        outgoingLight = mix(outgoingLight, stationHazeColor, min(.12, 1. - exp(-stationDistance * stationDistance)));
        #include <opaque_fragment>`)
    }
    material.customProgramCacheKey = () => `station-moving-cloud-${kind}-${node.name.includes('储能')}-${lightTheme}-v11`
    material.shadowSide = THREE.DoubleSide
    node.material = material
    old.dispose()
    // Preserve the source model: the tall foundation hides terrain intersections.
    node.castShadow = true
    node.receiveShadow = true
    node.frustumCulled = false
  })
}

export function fitTerrainReceiver(geometry, transform, verticalUnits, elevationAt) {
  const inverse = transform.clone().invert()
  const positions = geometry.attributes.position
  const point = new THREE.Vector3()
  for (let i = 0; i < positions.count; i++) {
    point.set(positions.getX(i), 0, positions.getZ(i)).applyMatrix4(transform)
    point.z = (elevationAt(point.x, point.y) + 8) * verticalUnits
    point.applyMatrix4(inverse)
    positions.setY(i, point.y)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
}

export function createStationPbrLayer({ mapboxgl, features, url, theme, getOptions, onReady, onError }) {
  let map, renderer, scene, camera, environment, sky, skyScene, pmrem, environmentTarget, skyTarget, model
  let removed = false, ready = false
  let cloudGround, terrainDepth
  const terrainScreen = new THREE.Scene()
  const heightSize=256, heightData=new Float32Array(heightSize*heightSize).fill(-1e6)
  const heightTexture=new THREE.DataTexture(heightData,heightSize,heightSize,THREE.RedFormat,THREE.FloatType)
  heightTexture.minFilter=heightTexture.magFilter=THREE.LinearFilter
  heightTexture.needsUpdate=true
  const heightBounds=new THREE.Vector4()
  let heightKey='', heightUpdated=-Infinity
  const startedAt = performance.now()
  const cloudUniforms = {
    stationCloudMap: { value: null }, stationWind: { value: new THREE.Vector2() },
    stationToMercator: { value: new THREE.Matrix4() },
    stationCloudOrigin: { value: new THREE.Vector3() }, stationCloudEye: { value: new THREE.Vector3() }, stationSun: { value: new THREE.Vector3() },
    stationReflectionCapture: { value: new THREE.Vector3() },
    stationReflectionDrift: { value: new THREE.Vector3() },
    stationUnits: { value: 1 }, stationCloudMatrices: { value: Array.from({length:3},()=>new THREE.Matrix4()) },
  }
  const instances = []
  const originalTextures = new Set()
  const transforms = new THREE.Matrix4()
  const viewProjection = new THREE.Matrix4()
  const inverse = new THREE.Matrix4()
  const skyCamera = new THREE.Camera()
  const reflectionPosition = new THREE.Vector3()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const concrete = concreteTexture()
  let terrainRevision = 0
  const terrainChanged = () => { terrainRevision++ }
  return {
    id: PBR_LAYER_ID,
    type: 'custom',
    renderingMode: '3d',
    slot: 'top',
    onAdd(host, gl) {
      const initialize = async () => {
        map = host
        map.on('sourcedata', terrainChanged)
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })
        renderer.autoClear = false
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFShadowMap
        // Mapbox reserves part of the depth range for its layers. Shadow atlases must use the full range.
        const renderShadows = renderer.shadowMap.render.bind(renderer.shadowMap)
        renderer.shadowMap.render = (...args) => {
          const range = gl.getParameter(gl.DEPTH_RANGE)
          gl.depthRange(0, 1)
          try { return renderShadows(...args) } finally { gl.depthRange(range[0], range[1]) }
        }
        scene = new THREE.Scene()
        camera = new THREE.Camera()
        camera.matrixAutoUpdate = false
        const initialSkyOptions = getOptions()
        skyTarget = await createStationSky(renderer, { ...initialSkyOptions, theme }, () => removed)
        if (!skyTarget) return
        if (removed) { skyTarget.dispose(); return }
        environment = skyTarget.texture
        // Cloud shadows are supplied by Takram after the first live frame.
        pmrem = new THREE.PMREMGenerator(renderer)
        environmentTarget = pmrem.fromEquirectangular(environment)
        scene.environment = environmentTarget.texture
        const fill = new THREE.HemisphereLight('#f0f3f5', '#8b887e', 0.8)
        scene.add(fill)
        const sun = new THREE.DirectionalLight('#fff3df', 2.8)
        sun.castShadow = true
        sun.shadow.mapSize.set(4096, 4096)
        Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 7, bottom: -7, near: 0.1, far: 55 })
        sun.shadow.camera.updateProjectionMatrix()
        sun.shadow.normalBias = 0.001
        sun.shadow.bias = -0.0001
        sun.target.position.set(0, 5.5, 0)
        scene.add(sun, sun.target)
        scene.userData.sun = sun
        scene.userData.fill = fill
        skyScene = new THREE.Scene()
        sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
          depthWrite: false,
          uniforms: { skyMap: { value: environment }, cloudMask: {value:null}, horizonColor: { value: new THREE.Color('#e6eff5') }, inverseVP: { value: new THREE.Matrix4() }, eye: { value: new THREE.Vector3() }, stationWind: cloudUniforms.stationWind, tint: { value: new THREE.Color(1, 1, 1) } },
          vertexShader: 'varying vec2 screen; void main(){screen=position.xy;gl_Position=vec4(position.xy,0.9999999,1.);}',
          fragmentShader: `uniform sampler2D skyMap; uniform sampler2D cloudMask; uniform mat4 inverseVP; uniform vec3 eye; uniform vec3 tint; uniform vec3 horizonColor; uniform vec2 stationWind; varying vec2 screen;
            ${SKY_TONE_GLSL}
            void main(){vec4 p=inverseVP*vec4(screen,1.,1.);vec3 d=normalize(p.xyz/p.w-eye);
            vec3 skyColor=stationSkyTone(texture2D(skyMap,screen*.5+.5).rgb,texture2D(cloudMask,screen*.5+.5).a);
            skyColor=mix(horizonColor,skyColor,smoothstep(-.02,.025,d.z));
            gl_FragColor=vec4(skyColor*tint,1.);
            #include <colorspace_fragment>
            }`,
        }))
        sky.frustumCulled = false
        skyScene.add(sky)
        new GLTFLoader().load(url, gltf => {
          if (removed) { disposeTree(gltf.scene); return }
          model = gltf.scene
          model.traverse(node => {
            for (const material of [].concat(node.material || [])) Object.values(material).forEach(value => { if (value?.isTexture) originalTextures.add(value) })
          })
          upgradeStationMaterials(model, concrete, environment, cloudUniforms, theme === 'light')
          features.forEach(feature => {
            const object = model.clone(true)
            object.visible = false
            scene.add(object)
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 18, 48, 48).rotateX(-Math.PI / 2),
              new THREE.ShadowMaterial({ color: '#19202a', opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
            ground.receiveShadow = true
            ground.visible = false
            ground.frustumCulled = false
            ground.renderOrder = -1
            scene.add(ground)
            instances.push({ object, feature, ground, terrainKey: '', sampledAt: -Infinity })
          })
          // Read the depth of the terrain Mapbox actually rendered; no second terrain mesh.
          terrainDepth = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: true })
          terrainDepth.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedInt248Type)
          terrainDepth.depthTexture.format = THREE.DepthStencilFormat
          cloudGround = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
            transparent: true, depthTest: false, depthWrite: false,
            ...TERRAIN_SHADOW_BLEND,
            uniforms: { ...cloudUniforms, terrainDepth: { value: terrainDepth.depthTexture },
              terrainInverseVP: { value: new THREE.Matrix4() }, terrainDepthRange: { value: new THREE.Vector2(0,1) }, terrainHeights: {value:heightTexture}, terrainBounds: {value:heightBounds} },
            vertexShader: 'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
            fragmentShader: CLOUD_PROJECTION_GLSL + `
              uniform sampler2D terrainDepth; uniform mat4 terrainInverseVP; uniform vec2 terrainDepthRange;
              varying vec2 screenUV;
              uniform sampler2D terrainHeights;
              uniform vec4 terrainBounds;
              float mountainShadow(vec3 world){
                vec2 direction=normalize(stationSun.xy);
                float slope=stationSun.z/max(length(stationSun.xy),.01);
                float elevation=world.z/stationUnits;
                float occlusion=0.;
                // ponytail: regional 625 m DEM and 25 km search; use tiled finer DEM for close-up terrain shadows.
                // Skip the local cell to avoid self-acne.
                for(int i=1;i<=40;i++){
                  float travel=625.*float(i);
                  vec2 point=world.xy+direction*travel*stationUnits;
                  vec2 uv=(point-terrainBounds.xy)/terrainBounds.zw;
                  if(any(lessThan(uv,vec2(.01))) || any(greaterThan(uv,vec2(.99))))break;
                  float h=texture2D(terrainHeights,uv).r;
                  float blocked=smoothstep(80.,220.,h-elevation-travel*slope);
                  occlusion=max(occlusion,blocked);
                }
                return occlusion;
              }
              void main(){
                float depth=texture2D(terrainDepth,screenUV).r;
                if(depth>=.999999 || depth<=0.)discard;
                float z=(depth-terrainDepthRange.x)/(terrainDepthRange.y-terrainDepthRange.x)*2.-1.;
                vec4 world=terrainInverseVP*vec4(screenUV*2.-1.,z,1.);
                vec3 point=world.xyz/world.w;
                float shade=1.-(1.-stationCloudShadow(point)*.36)*(1.-mountainShadow(point)*.32);
                gl_FragColor=vec4(0.,0.,0.,shade);
              }`,
          }))
          cloudGround.frustumCulled = false
          terrainScreen.add(cloudGround)
          ready = true
          onReady?.()
          map.triggerRepaint()
        }, undefined, error => { if (!removed) onError(error) })
      }
      initialize().catch(error => { if (!removed) { console.error('Station sky initialization failed', error); onError(error) } })
    },
    render(gl, matrix) {
      if (!ready || removed) return
      const options = getOptions()
      const { config, visible, preset, azimuth, elevation } = options
      if (map.getLayer(NATIVE_LAYER_ID) && map.getLayoutProperty(NATIVE_LAYER_ID, 'visibility') !== 'none') map.setLayoutProperty(NATIVE_LAYER_ID, 'visibility', 'none')
      const night = preset === 'night', dusk = preset === 'dusk', dawn = preset === 'dawn'
      const tint = night ? new THREE.Color('#26394f') : dusk ? new THREE.Color('#d09f89') : dawn ? new THREE.Color('#ead4bc') : new THREE.Color(1, 1, 1)
      scene.environmentIntensity = night ? 0.25 : 1.3
      scene.userData.fill.intensity = night ? 0.25 : 0.8
      const sun = scene.userData.sun
      sun.intensity = night ? 0.35 : dusk ? 1.6 : 3.2
      sun.color.copy(tint)
      const az = THREE.MathUtils.degToRad(azimuth), el = THREE.MathUtils.degToRad(elevation)
      sun.position.set(Math.sin(az) * Math.cos(el) * 12, Math.sin(el) * 12, -Math.cos(az) * Math.cos(el) * 12)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(config.rotation))
      sun.position.y += 5.5
      const wind = cloudWindAt(reducedMotion.matches ? 0 : (performance.now() - startedAt) / 1000)
      cloudUniforms.stationWind.value.set(...wind)
      cloudUniforms.stationSun.value.set(Math.sin(az)*Math.cos(el),-Math.cos(az)*Math.cos(el),Math.sin(el))
      const cloudOrigin = mapboxgl.MercatorCoordinate.fromLngLat([101.5, 28], 0)
      cloudUniforms.stationCloudOrigin.value.set(cloudOrigin.x, cloudOrigin.y, 0)
      cloudUniforms.stationUnits.value = cloudOrigin.meterInMercatorCoordinateUnits()
      scene.environmentRotation.y = THREE.MathUtils.degToRad(config.rotation)
      viewProjection.fromArray(matrix)
      const free = map.getFreeCameraOptions().position
      cloudUniforms.stationCloudEye.value.set(free.x,free.y,free.z)
      renderer.resetState()
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      sky.material.uniforms.inverseVP.value.copy(viewProjection).invert()
      sky.material.uniforms.eye.value.set(free.x, free.y, free.z)
      sky.material.uniforms.tint.value.copy(tint)
      // Resolve the map's multisampled depth into a matching depth-stencil texture.
      const framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING)
      const depthRange = gl.getParameter(gl.DEPTH_RANGE)
      terrainDepth.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight)
      renderer.setRenderTarget(terrainDepth)
      const depthFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, depthFramebuffer)
      gl.blitFramebuffer(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT,gl.NEAREST)
      renderer.setRenderTarget(null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      renderer.resetState()
      renderer.setViewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight)
      const center=mapboxgl.MercatorCoordinate.fromLngLat(map.getCenter())
      const units=cloudUniforms.stationUnits.value
      const cx=Math.round(center.x/units/10000)*10000*units, cy=Math.round(center.y/units/10000)*10000*units
      const nextHeightKey=`${cx}:${cy}:${terrainRevision}`
      if(nextHeightKey!==heightKey && performance.now()-heightUpdated>3000){
        const extent=160000*units
        heightBounds.set(cx-extent/2,cy-extent/2,extent,extent)
        for(let y=0;y<heightSize;y++)for(let x=0;x<heightSize;x++){
          const lngLat=new mapboxgl.MercatorCoordinate(heightBounds.x+(x+.5)/heightSize*extent,heightBounds.y+(y+.5)/heightSize*extent,0).toLngLat()
          heightData[y*heightSize+x]=map.queryTerrainElevation(lngLat) ?? -1e6
        }
        heightTexture.needsUpdate=true; heightKey=nextHeightKey; heightUpdated=performance.now()
      }
      cloudGround.material.uniforms.terrainInverseVP.value.copy(viewProjection).invert()
      cloudGround.material.uniforms.terrainDepthRange.value.set(depthRange[0],depthRange[1])
      if (theme === 'light') {
        let closest = Infinity
        for (const feature of features) {
          const point = mapboxgl.MercatorCoordinate.fromLngLat(feature.geometry.coordinates)
          const distance = Math.hypot(point.x-free.x, point.y-free.y)
          if (distance >= closest) continue
          closest = distance
          const altitude = config.stationElevations?.[feature.properties.id] ?? config.elevation
          const panelHeight = (altitude + 5.6 * config.scale) * center.meterInMercatorCoordinateUnits() / units
          reflectionPosition.set((point.x-cloudOrigin.x)/units, Math.min(7000,panelHeight), (point.y-cloudOrigin.y)/units)
        }
      }
      const skyTime = reducedMotion.matches ? 0 : (performance.now()-startedAt)/1000
      const liveSky=skyTarget.renderView(viewProjection,cloudUniforms.stationCloudEye.value,cloudOrigin,
        cloudUniforms.stationUnits.value,options,skyTime,gl.drawingBufferWidth,gl.drawingBufferHeight,
        theme === 'light' ? reflectionPosition : undefined)
      cloudUniforms.stationReflectionCapture.value.copy(skyTarget.capturePosition)
      // Advect the captured cloud footprint between cube refreshes using the live volume's wind.
      cloudUniforms.stationReflectionDrift.value.copy(CLOUD_VELOCITY).multiplyScalar(Math.max(0,skyTime-skyTarget.captureTime))
      sky.material.uniforms.skyMap.value=liveSky.texture
      sky.material.uniforms.cloudMask.value=liveSky.cloudMask
      cloudUniforms.stationCloudMap.value=liveSky.shadow.map
      cloudUniforms.stationCloudMatrices.value=liveSky.shadow.matrices
      if(liveSky.environmentChanged) {
        const next=pmrem.fromEquirectangular(skyTarget.texture)
        scene.environment=next.texture
        environmentTarget.dispose();environmentTarget=next
      }
      renderer.resetState()
      renderer.setViewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight)
      renderer.render(terrainScreen, skyCamera)
      renderer.render(skyScene, skyCamera)
      if (visible) for (const instance of instances) {
        const { object, feature, ground } = instance
        const altitude = config.stationElevations?.[feature.properties.id] ?? config.elevation
        const coord = mapboxgl.MercatorCoordinate.fromLngLat(feature.geometry.coordinates, altitude)
        const scale = coord.meterInMercatorCoordinateUnits() * config.scale
        const verticalUnits = mapboxgl.MercatorCoordinate.fromLngLat(map.getCenter()).meterInMercatorCoordinateUnits()
        transforms.makeTranslation(coord.x, coord.y, altitude * verticalUnits)
          .scale(new THREE.Vector3(scale, -scale, config.scale * verticalUnits))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
          .multiply(new THREE.Matrix4().makeRotationY(-THREE.MathUtils.degToRad(config.rotation)))
        cloudUniforms.stationToMercator.value.copy(transforms)
        // Preserve the actual local camera position so PBR specular responds to orbiting.
        inverse.copy(transforms).invert()
        const terrainKey = [terrainRevision, config.scale, config.rotation, altitude, verticalUnits].join(':')
        if (terrainKey !== instance.terrainKey && performance.now() - instance.sampledAt > 500) {
          fitTerrainReceiver(ground.geometry, transforms, verticalUnits, (x, y) => {
            const lngLat = new mapboxgl.MercatorCoordinate(x, y, 0).toLngLat()
            return map.queryTerrainElevation(lngLat) ?? 0
          })
          instance.terrainKey = terrainKey
          instance.sampledAt = performance.now()
        }
        camera.position.set(free.x, free.y, free.z).applyMatrix4(inverse)
        camera.matrixWorld.makeTranslation(camera.position.x, camera.position.y, camera.position.z)
        camera.matrix.copy(camera.matrixWorld)
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
        camera.projectionMatrix.copy(viewProjection).multiply(transforms).multiply(camera.matrixWorld)
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
        object.visible = true
        ground.visible = true
        object.traverse(node => {
          if (node.name === '风能叶片' && !reducedMotion.matches) node.rotation.x = -performance.now() / 6000 * Math.PI * 2
          if (node.isMesh) {
            node.material.userData.hazeColor.value.set(night ? '#17252c' : '#e6eff5')
            node.material.userData.hazeScale.value = config.scale / 650000
            if (node.material.userData.cloudIntensity) node.material.userData.cloudIntensity.value = night ? 0.12 : dusk ? 0.55 : 1
            node.material.emissive.copy(node.material.color).multiplyScalar(0.25)
            node.material.emissiveIntensity = config.emissive
          }
        })
        renderer.render(scene, camera)
        object.visible = false
        ground.visible = false
      }
      renderer.resetState()
      // Mapbox owns the frame loop; do not create a second RAF or animate hidden tabs.
      if (options.active && !document.hidden && !reducedMotion.matches) map.triggerRepaint()
    },
    onRemove() {
      removed = true
      map?.off('sourcedata', terrainChanged)
      scene?.userData.sun?.shadow.dispose()
      if (scene) disposeTree(scene)
      if (skyScene) disposeTree(skyScene)
      disposeTree(terrainScreen)
      terrainDepth?.dispose()
      heightTexture.dispose()
      originalTextures.forEach(texture => texture.dispose())
      concrete.dispose()
      skyTarget?.dispose()
      environmentTarget?.dispose()
      pmrem?.dispose()
      renderer?.dispose()
    },
  }
}
