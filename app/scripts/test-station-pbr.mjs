import assert from 'node:assert/strict'
import * as THREE from 'three'
import { upgradeStationMaterials, fitTerrainReceiver, TERRAIN_SHADOW_BLEND } from '../src/components/stationPbrLayer.js'

const scene = new THREE.Group()
const concrete = new THREE.Texture()
const panelMap = new THREE.Texture()
for (const name of ['光伏面板001', '储能', '金属支架', '底座']) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: panelMap }))
  mesh.name = name
  scene.add(mesh)
}
upgradeStationMaterials(scene, concrete)
const [solar, storage, support, base] = scene.children
assert.equal(solar.material.map, panelMap, 'Keep original photovoltaic cell texture')
assert.equal(solar.material.clearcoat, 1)
assert.ok(solar.material.roughness < storage.material.roughness)
assert.ok(storage.material.metalness > 0.3)
assert.ok(support.material.metalness > storage.material.metalness)
assert.equal(base.material.map, concrete)
assert.equal(base.material.bumpMap, concrete)
assert.equal(base.material.metalness, 0)
assert.ok(base.material.roughness > 0.9)
assert.ok([...base.geometry.attributes.uv.array].every(Number.isFinite))
for (const mesh of scene.children) {
  assert.ok(mesh.receiveShadow)
  assert.equal(mesh.castShadow, true)
  assert.ok(mesh.material.isMeshPhysicalMaterial)
}
console.log('Station PBR: cell texture preserved, glass/metal/concrete and UVs passed')

assert.equal(base.geometry.boundingBox.max.y - base.geometry.boundingBox.min.y, 1, 'Preserve original foundation height')

const terrain = new THREE.PlaneGeometry(4, 4, 2, 2).rotateX(-Math.PI / 2)
const transform = new THREE.Matrix4().makeTranslation(0.4, 0.3, -0.2)
  .scale(new THREE.Vector3(0.01, -0.01, 0.01)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
fitTerrainReceiver(terrain, transform, 0.001, (x, y) => 20 + x * 10 - y * 5)
const vertex = new THREE.Vector3()
for (let i = 0; i < terrain.attributes.position.count; i++) {
  vertex.fromBufferAttribute(terrain.attributes.position, i).applyMatrix4(transform)
  assert.ok(Math.abs(vertex.z - (28 + vertex.x * 10 - vertex.y * 5) * 0.001) < 1e-7,
    'Shadow receiver follows the sampled terrain under the model transform')
}
console.log('Terrain shadow receiver: sampled elevations and model transform passed')

const { cloudWindAt } = await import('../src/components/stationSky.js')
assert.deepEqual(cloudWindAt(0), [0, 0])
assert.deepEqual(cloudWindAt(10), [0,0], 'Live cloud motion must not also rotate the reflection panorama')
const cloudUniforms = { stationWind: { value: new THREE.Vector2() } }
const reflected = new THREE.Group()
const panel = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial())
panel.name = '光伏面板'
reflected.add(panel)
upgradeStationMaterials(reflected, concrete, new THREE.Texture(), cloudUniforms)
const shader = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: '#include <lights_fragment_end>\n#include <opaque_fragment>' }
panel.material.onBeforeCompile(shader)
assert.equal(shader.uniforms.stationWind, cloudUniforms.stationWind, 'Cloud shadow and reflection share the same wind uniform')
assert.ok(shader.fragmentShader.includes('stationCloudUV(glassDirection.xzy, stationWind)'), 'Reflection uses map-space direction and moving cloud field')
assert.ok(shader.fragmentShader.includes('stationCloudShadow(stationWorld)'), 'Model receives projected cloud shadow')
console.log('Moving clouds: shared wind, world-space glass reflection and model cloud shadow passed')

// Only the light-theme equipment should get reduced fill; keep direct sun, concrete and glass intact.
for (const lightTheme of [false, true]) {
  const models = new THREE.Group()
  for (const name of ['储能', '金属支架', '底座', '光伏面板']) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ normalMap: panelMap }))
    mesh.name = name
    models.add(mesh)
  }
  upgradeStationMaterials(models, concrete, new THREE.Texture(), cloudUniforms, lightTheme)
  for (const mesh of models.children) {
    assert.equal(mesh.material.normalMap, mesh.name === '底座' ? null : panelMap, 'Keep the equipment normal texture and its panel details')
    const compiled = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader }
    mesh.material.onBeforeCompile(compiled)
    assert.equal(compiled.fragmentShader.includes('float housingPaint ='), lightTheme && mesh.name === '储能', 'Lighten only the light-theme storage paint before lighting')
    const localReflection = lightTheme && mesh.name === '光伏面板'
    assert.equal(compiled.fragmentShader.includes('textureLod(cloudEnvironment,'), localReflection, 'Light-theme frost filters only the sky reflection')
    if (localReflection) {
      assert.ok(mesh.material.roughness >= .2 && mesh.material.clearcoatRoughness >= .15, 'Solar glass has a soft highlight instead of a mirror finish')
    }
    assert.equal(compiled.fragmentShader.includes('vec3 panelPosition = ((stationWorld - stationCloudOrigin) / stationUnits).xzy;'), localReflection, 'Cloud reflections must account for each position across the panel')
    assert.equal(compiled.fragmentShader.includes('reflectedRay * cloudDistance - stationReflectionDrift'), localReflection, 'Reflection footprints move with cloud advection between captures')
    assert.equal(compiled.fragmentShader.includes('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz;'), lightTheme && mesh.name !== '底座', 'Decode flat (0,0,1) normals without tilting the light-theme surfaces')
    const reducedFill = lightTheme && ['储能', '金属支架'].includes(mesh.name)
    assert.equal(compiled.fragmentShader.includes('reflectedLight.indirectDiffuse *= .32'), reducedFill)
    assert.equal(compiled.fragmentShader.includes('reflectedLight.indirectSpecular *= .45'), reducedFill)
    assert.equal(compiled.fragmentShader.includes('clearcoatSpecularIndirect *= .45'), reducedFill)
    assert.ok(compiled.fragmentShader.includes('reflectedLight.directDiffuse *= cloudLight'), 'Keep the existing direct sun and cloud-shadow path')
  }
}
console.log('Equipment contrast: reduced light-theme fill; direct sun, base, glass and dark theme preserved')

// Regression: shadow blending must darken RGB without revealing the page behind the canvas.
const factors = new Map([
  [THREE.ZeroFactor, () => 0], [THREE.OneFactor, () => 1],
  [THREE.OneMinusSrcAlphaFactor, alpha => 1-alpha],
])
for (const alpha of [0, .36, .8]) {
  const blend = (source, destination, src, dst) => source*factors.get(src)(alpha)+destination*factors.get(dst)(alpha)
  const rgb = blend(0, .7, TERRAIN_SHADOW_BLEND.blendSrc, TERRAIN_SHADOW_BLEND.blendDst)
  const canvasAlpha = blend(alpha, 1, TERRAIN_SHADOW_BLEND.blendSrcAlpha, TERRAIN_SHADOW_BLEND.blendDstAlpha)
  assert.equal(canvasAlpha, 1, 'Terrain shadows must keep the map opaque')
  assert.ok(Math.abs(rgb-.7*(1-alpha))<1e-9, 'Terrain shadows attenuate existing terrain color')
}
console.log('Terrain shadow composition: darkens terrain while retaining opaque canvas alpha')

const { cloudWeatherTransform, CLOUD_VELOCITY } = await import('../src/components/stationSky.js')
const { Geodetic, Ellipsoid } = await import('@takram/three-geospatial')
const origin = new Geodetic(101.5*Math.PI/180,28*Math.PI/180).toECEF()
const east=new THREE.Vector3(),north=new THREE.Vector3(),up=new THREE.Vector3()
Ellipsoid.WGS84.getEastNorthUpVectors(origin,east,north,up)
const baseTransform=new THREE.Matrix4().makeBasis(east,up,north.negate()).setPosition(origin)
const cloudPoint=new THREE.Vector3(0,9000,0)
const fixedWeatherPoint=cloudPoint.clone().applyMatrix4(baseTransform)
const moving=cloudWeatherTransform(baseTransform,10)
const movedCloud=fixedWeatherPoint.clone().applyMatrix4(moving.clone().invert())
assert.ok(Math.abs(movedCloud.x-600)<2 && Math.abs(movedCloud.z-150)<2, 'Cloud body advects at the specified east/south wind speed')
assert.ok(Math.abs(movedCloud.clone().applyMatrix4(baseTransform).length()-fixedWeatherPoint.length())<1e-7, 'Wind preserves cloud altitude above the globe')
const sunDirection=new THREE.Vector3(-.6,.7,.3).normalize()
const shadowPoint=p=>p.clone().addScaledVector(sunDirection,-p.y/sunDirection.y)
const cloudTravel=movedCloud.clone().sub(cloudPoint).setY(0)
const shadowTravel=shadowPoint(movedCloud).sub(shadowPoint(cloudPoint)).setY(0)
assert.ok(cloudTravel.distanceTo(shadowTravel)<1, 'Sun-projected shadow travels with the same cloud body')
assert.deepEqual(cloudWeatherTransform(baseTransform,0).elements,baseTransform.elements,'Motion begins without a jump')
assert.deepEqual(CLOUD_VELOCITY.toArray(),[60,0,15],'Weather updates must not mutate the velocity shared with panel reflections')
console.log('Cloud advection: speed, fixed altitude, shadow synchronization and initial frame passed')
