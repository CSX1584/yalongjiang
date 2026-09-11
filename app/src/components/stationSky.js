import * as THREE from 'three'
import { EffectPass } from 'postprocessing'
import { CloudsEffect } from '@takram/three-clouds'
import { SkyMaterial, PrecomputedTexturesLoader } from '@takram/three-atmosphere'
import { DataTextureLoader, parseUint8Array, STBNLoader, Geodetic, Ellipsoid } from '@takram/three-geospatial'

// Rigid advection moves weather, shape and detail together on the globe.
// Rotating about Earth preserves cloud altitude instead of translating the atmosphere off the surface.
export const CLOUD_VELOCITY = new THREE.Vector3(60, 0, 15)
export function cloudWeatherTransform(base, seconds, result = new THREE.Matrix4()) {
  const radial = new THREE.Vector3().setFromMatrixPosition(base)
  const velocity = CLOUD_VELOCITY.clone()
  const speed = velocity.length(), radius = radial.length()
  const axis = velocity.transformDirection(base).cross(radial.normalize()).normalize()
  return result.makeRotationAxis(axis, seconds * speed / radius).multiply(base)
}

// Takram renders the visible sky from the current camera every frame.
// Reflection captures reuse the same volume, sun and weather offsets.
export const SKY_TONE_GLSL = `
  vec3 stationSkyTone(vec3 radiance, float cloudCoverage) {
    vec3 value=radiance*18.*vec3(.97,1.025,1.03);
    vec3 base=value/(1.+value);
    float luminance=dot(base,vec3(.2126,.7152,.0722));
    // Grade clear air independently so blue saturation never tints the white clouds.
    vec3 clearSky=clamp(mix(vec3(luminance),base,1.5),0.,1.);
    // Lift sunlit cloud highlights only; retain the cooler, darker cloud bases.
    float highlight=smoothstep(.42,.72,luminance);
    vec3 cloud=mix(base,vec3(1.),highlight*.5);
    return mix(clearSky,cloud,smoothstep(.05,.9,cloudCoverage));
  }
`

export async function createStationSky(renderer, initialOptions = {}, isCancelled = () => false) {
  const textureLoader = new THREE.TextureLoader()
  const loadVolume = (name, size) => new DataTextureLoader(THREE.Data3DTexture, parseUint8Array, {
    width: size, height: size, depth: size, format: THREE.RedFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, wrapR: THREE.RepeatWrapping,
  }).loadAsync(`/sky/clouds/${name}.bin`)
  const [atmosphere, weather, shape, detail, turbulence, stbn] = await Promise.all([
    new PrecomputedTexturesLoader({ format: 'binary', higherOrderScattering: false }).loadAsync('/sky/atmosphere'),
    textureLoader.loadAsync('/sky/clouds/local_weather.png'), loadVolume('shape', 128),
    loadVolume('shape_detail', 32), textureLoader.loadAsync('/sky/clouds/turbulence.png'),
    new STBNLoader().loadAsync('/sky/stbn.bin'),
  ])
  if (isCancelled()) {
    [...Object.values(atmosphere), weather, shape, detail, turbulence, stbn].forEach(texture => texture?.dispose())
    return null
  }
  for (const texture of [weather, turbulence]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.needsUpdate = true
  }

  const origin = new Geodetic(THREE.MathUtils.degToRad(101.5), THREE.MathUtils.degToRad(28)).toECEF()
  const east = new THREE.Vector3(), north = new THREE.Vector3(), up = new THREE.Vector3()
  Ellipsoid.WGS84.getEastNorthUpVectors(origin, east, north, up)
  const worldToECEF = new THREE.Matrix4().makeBasis(east, up, north.negate()).setPosition(origin)
  const skyMaterial = new SkyMaterial({ ...atmosphere, sun: false, moon: false })
  skyMaterial.worldToECEFMatrix.copy(worldToECEF)
  const scene = new THREE.Scene()
  const plane = new THREE.PlaneGeometry(2, 2)
  const sky = new THREE.Mesh(plane, skyMaterial)
  sky.frustumCulled = false
  scene.add(sky)
  function makeClouds(camera) {
    const effect = new CloudsEffect(camera)
    effect.qualityPreset = 'high'
    effect.clouds.minStepSize = 25
    effect.clouds.maxIterationCount = 500
    effect.skyLightScale = 1.25
    effect.shadow.mapSize.set(768,768)
    effect.shadow.maxIterationCount = 64
    effect.shadow.minStepSize = 50
    effect.lightShafts = false
    effect.haze = false // Mapbox and the horizon blend already supply distant haze.
    effect.skipRendering = false
    effect.coverage = .3
    effect.localWeatherRepeat.setScalar(50)
    effect.shapeRepeat.setScalar(.0003)
    effect.cloudLayers[0].altitude = 8500
    effect.cloudLayers[0].height = 1000
    effect.cloudLayers[0].densityScale = .055
    effect.cloudLayers[1].altitude = 9200
    effect.cloudLayers[1].height = 1800
    effect.cloudLayers[1].densityScale = .045
    effect.cloudLayers[2].altitude = 15000
    effect.cloudLayers[2].densityScale = .001
    effect.shadow.temporalPass = false
    effect.shadow.far = 250000
    Object.assign(effect, atmosphere, { localWeatherTexture: weather, shapeTexture: shape,
      shapeDetailTexture: detail, turbulenceTexture: turbulence, stbnTexture: stbn })
    effect.worldToECEFMatrix.copy(worldToECEF)
    return effect
  }
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 1e6)
  const captureCamera = new THREE.PerspectiveCamera(90, 1, 1, 1e6)
  captureCamera.position.y = 7000
  const clouds = makeClouds(camera)
  clouds.temporalUpscale = false
  clouds.cloudsPass.resolveMaterial.uniforms.temporalAlpha.value = .18
  clouds.shadow.temporalPass = true
  clouds.shadowPass.resolveMaterial.uniforms.temporalAlpha.value = .12
  const captureClouds = makeClouds(captureCamera)
  captureClouds.temporalUpscale = false
  captureClouds.cloudsPass.resolveMaterial.uniforms.temporalAlpha.value = 1
  const pass = new EffectPass(camera, clouds)
  const capturePass = new EffectPass(captureCamera, captureClouds)
  for (const effectPass of [pass,capturePass]) {
    effectPass.renderToScreen = false
    effectPass.initialize(renderer, false, THREE.HalfFloatType)
  }
  function buffer(width, height, depth = false) {
    const result = new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:depth})
    if (depth) result.depthTexture = new THREE.DepthTexture(width,height)
    return result
  }
  const input = buffer(1,1,true), output = buffer(1,1)
  const captureInput = buffer(768,768,true), captureOutput = buffer(768,768)
  capturePass.setSize(768,768)
  capturePass.setDepthTexture(captureInput.depthTexture)
  const cube = new THREE.WebGLCubeRenderTarget(768,{type:THREE.HalfFloatType,depthBuffer:false})
  const target = buffer(4096,2048)
  if (initialOptions.theme === 'light') {
    target.texture.generateMipmaps = true
    target.texture.minFilter = THREE.LinearMipmapLinearFilter
  }
  target.capturePosition = new THREE.Vector3()
  target.captureTime = 0
  target.texture.mapping = THREE.EquirectangularReflectionMapping
  const copyScene = new THREE.Scene()
  const copyMaterial = new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,
    uniforms:{ source:{value:captureOutput.texture}, mask:{value:null} },
    vertexShader:'varying vec2 uvOut;void main(){uvOut=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'uniform sampler2D source;uniform sampler2D mask;varying vec2 uvOut;void main(){gl_FragColor=vec4(texture2D(source,uvOut).rgb,texture2D(mask,uvOut).a);}',
  })
  const copy = new THREE.Mesh(plane,copyMaterial)
  copyScene.add(copy)
  const panoramaMaterial = new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,
    uniforms:{source:{value:cube.texture}},vertexShader:copyMaterial.vertexShader,
    fragmentShader:`uniform samplerCube source;varying vec2 uvOut;
      ${SKY_TONE_GLSL}
      void main(){float lon=(uvOut.x-.5)*6.28318530718,lat=(uvOut.y-.5)*3.14159265359;
        vec4 c=textureCube(source,vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon)));
        gl_FragColor=vec4(stationSkyTone(c.rgb,c.a),c.a);}`,
  })
  const faces=[[1,0,0,0,-1,0],[-1,0,0,0,-1,0],[0,1,0,0,0,1],[0,-1,0,0,0,-1],[0,0,1,0,-1,0],[0,0,-1,0,-1,0]]
  function setWeather(options, seconds) {
    const az = THREE.MathUtils.degToRad(options.azimuth ?? 289), el = THREE.MathUtils.degToRad(options.elevation ?? 45)
    const sun = new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)).transformDirection(worldToECEF)
    skyMaterial.sunDirection.copy(sun)
    for (const effect of [clouds,captureClouds]) {
      effect.sunDirection.copy(sun)
      cloudWeatherTransform(worldToECEF, seconds, effect.worldToECEFMatrix)
    }
  }
  function preserveState(draw) {
    const gl=renderer.getContext(), depth=gl.getParameter(gl.DEPTH_RANGE)
    const previous=renderer.getRenderTarget(), viewport=renderer.getViewport(new THREE.Vector4())
    const clear=renderer.getClearColor(new THREE.Color()), alpha=renderer.getClearAlpha()
    try {
      renderer.resetState();gl.depthRange(0,1);renderer.setClearColor(0,1)
      return draw()
    } finally {
      renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setClearColor(clear,alpha)
      renderer.resetState();gl.depthRange(depth[0],depth[1])
    }
  }
  function capture(firstFace=0, faceCount=6) {
    preserveState(() => {
      copy.material=copyMaterial
      for (let face=firstFace;face<firstFace+faceCount;face++) {
        const f=faces[face]
        captureCamera.up.set(f[3],f[4],f[5])
        captureCamera.lookAt(captureCamera.position.clone().add(new THREE.Vector3(...f.slice(0,3))))
        captureCamera.updateMatrixWorld(true)
        renderer.setRenderTarget(captureInput);renderer.clear();renderer.render(scene,captureCamera)
        capturePass.render(renderer,captureInput,captureOutput,0,false)
        copyMaterial.uniforms.mask.value=captureClouds.cloudsPass.outputBuffer
        renderer.setRenderTarget(cube,face);renderer.render(copyScene,new THREE.Camera())
      }
      if(firstFace+faceCount===6){
        copy.material=panoramaMaterial
        renderer.setRenderTarget(target);renderer.render(copyScene,new THREE.Camera())
        target.capturePosition.copy(captureCamera.position)
      }
    })
  }
  setWeather(initialOptions,0)
  capture()
  let lastCapture=-Infinity, lastSun='', width=0, height=0, lastFrame=0, captureFace=6, captureTime=0, captureSun=''
  const inverseVP=new THREE.Matrix4(), ray=new THREE.Vector3(), forward=new THREE.Vector3(), top=new THREE.Vector3()
  target.renderView = (viewProjection, eye, mercatorOrigin, units, options, seconds, viewportWidth, viewportHeight, reflectionPosition) => {
    inverseVP.copy(viewProjection).invert()
    function direction(x,y,result) {
      result.set(x,y,1).applyMatrix4(inverseVP).sub(eye).normalize()
      return result.set(result.x,result.z,result.y)
    }
    direction(0,0,forward);direction(0,1,top)
    // The regional map camera is kilometers above the stations and changes height with viewport size.
    // Keep the sky at a stable viewing height, preserving the map camera rays and horizontal position.
    camera.position.set((eye.x-mercatorOrigin.x)/units,7000,(eye.y-mercatorOrigin.y)/units)
    camera.up.copy(top)
    camera.lookAt(ray.copy(camera.position).add(forward))
    camera.fov=THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(forward.dot(top),-1,1))*2)
    camera.aspect=viewportWidth/viewportHeight
    camera.updateProjectionMatrix();camera.updateMatrixWorld(true)
    setWeather(options,seconds)
    const sunKey=`${options.azimuth}:${options.elevation}`
    let environmentChanged=false
    if(captureFace===6 && (seconds-lastCapture>3 || sunKey!==lastSun)){
      captureCamera.position.copy(reflectionPosition ?? camera.position)
      captureFace=0;captureTime=seconds;captureSun=sunKey
    }
    if(captureFace<6){
      // Freeze this cube's weather time; publish all six faces together without a six-pass frame spike.
      cloudWeatherTransform(worldToECEF,captureTime,captureClouds.worldToECEFMatrix)
      capture(captureFace++,1)
      if(captureFace===6){environmentChanged=true;lastCapture=seconds;lastSun=captureSun;target.captureTime=captureTime}
    }
    // 3/4 resolution with full pixel sampling gives 9x the old 1/4-by-1/4 sample count.
    const nextWidth=Math.round(Math.min(viewportWidth,1920)*.75), nextHeight=Math.round(nextWidth*viewportHeight/viewportWidth)
    if(width!==nextWidth || height!==nextHeight) {
      width=nextWidth;height=nextHeight;input.setSize(width,height);output.setSize(width,height)
      pass.setSize(width,height);pass.setDepthTexture(input.depthTexture)
    }
    const delta=Math.min(Math.max(seconds-lastFrame,1/120),.1)
    lastFrame=seconds
    clouds.shadowPass.resolveMaterial.uniforms.temporalAlpha.value = 1-Math.exp(-delta/.12)
    clouds.cloudsPass.resolveMaterial.uniforms.temporalAlpha.value = 1-Math.exp(-delta/.075)
    preserveState(() => {
      renderer.setRenderTarget(input);renderer.clear();renderer.render(scene,camera)
      pass.render(renderer,input,output,0,false)
    })
    return {texture:output.texture,cloudMask:clouds.cloudsPass.outputBuffer,environmentChanged,shadow:clouds.atmosphereShadow}
  }
  const disposeTarget=target.dispose.bind(target)
  target.dispose=()=>{
    disposeTarget();input.dispose();output.dispose();captureInput.dispose();captureOutput.dispose();cube.dispose()
    pass.dispose();capturePass.dispose();plane.dispose();skyMaterial.dispose();copyMaterial.dispose();panoramaMaterial.dispose()
    ;[...Object.values(atmosphere),weather,shape,detail,turbulence,stbn].forEach(texture=>texture?.dispose())
  }
  return target
}

export const CLOUD_UV_GLSL = `
  vec2 stationCloudUV(vec3 direction, vec2 wind) {
    vec3 d=normalize(direction);
    return vec2(fract(atan(d.z,d.x)/6.28318530718+.5+wind.x),asin(clamp(d.y,-1.,1.))/3.14159265359+.5);
  }
`
// The live volume now moves through weather offsets, not a rotating panorama.
export function cloudWindAt() { return [0,0] }
