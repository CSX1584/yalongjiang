import assert from 'node:assert/strict'
import { Vector3, Vector2, Matrix4, Box3, Object3D, DirectionalLight, PerspectiveCamera, MeshPhysicalMaterial, ShaderLib, MathUtils } from 'three'
import { Geodetic } from '@takram/three-geospatial'
import { CloudsEffect, CloudLayers } from '@takram/three-clouds'
import { AerialPerspectiveEffect } from '@takram/three-atmosphere'
import { STATION_COORDINATES, stationTransform, localSolarDate, createGeospatialScene, tokyoCameraView, setCloudAltitude, AdjustableAerialPerspectiveEffect, fitStationShadow, captureCamera, restoreCamera } from '../src/components/geospatialScene.js'
import { TOKYO_PRESET, DEFAULT_ENVIRONMENT, YALONG_ALTITUDE_OFFSET, YALONG_VIEW_TARGET } from '../src/components/geospatialPreset.js'
import { ModelCloudShadow } from '../src/components/geospatialCloudShadow.js'
import { copyReflectionWeather } from '../src/components/skyReflectionProbe.js'

// A misplaced foundation buries the equipment and detaches the labels from the terrain.
for (const coordinates of Object.values(STATION_COORDINATES)) {
  for (const scale of [100, 4950, 10000]) {
    const matrix = stationTransform(coordinates, 4200, scale, 141)
    const deck = new Geodetic().setFromECEF(new Vector3(0, 5.4586968421936035, 0).applyMatrix4(matrix))
    assert.ok(Math.abs(deck.height - 4200) < 0.01, 'Deck stays above terrain independently of model scale')
    assert.ok(Math.abs(deck.longitude * 180 / Math.PI - coordinates[0]) < 0.00001)
    assert.ok(Math.abs(deck.latitude * 180 / Math.PI - coordinates[1]) < 0.00001)
  }
}
assert.equal(+localSolarDate(120, 17.5, 2026) - +localSolarDate(105, 17.5, 2026), -3600000, 'Solar time follows longitude')
assert.equal(+localSolarDate(120, 7.5, 2026), Date.UTC(2026, 0, 1) + (170 * 24 - 0.5) * 3600000, 'Tokyo uses day 170 and 07:30 solar time')
const view = tokyoCameraView()
const target = new Geodetic(...YALONG_VIEW_TARGET.map(MathUtils.degToRad), YALONG_ALTITUDE_OFFSET).toECEF()
assert.ok(Math.abs(view.position.distanceTo(target) - 1000) < 1e-6, 'Altitude adaptation preserves the 1000 m camera distance')
const forward = new Vector3(0, 0, -1).applyQuaternion(view.quaternion)
assert.ok(forward.dot(target.clone().sub(view.position).normalize()) > 0.999999, 'Camera still points at the translated target')
assert.deepEqual([TOKYO_PRESET.heading, TOKYO_PRESET.pitch, TOKYO_PRESET.fov], [-110, -9, 75])
const liveCamera = new PerspectiveCamera(75, 1.44, 1, 250000)
liveCamera.position.copy(view.position); liveCamera.quaternion.copy(view.quaternion); liveCamera.up.copy(view.up)
liveCamera.zoom = 1.2; liveCamera.updateProjectionMatrix(); liveCamera.updateMatrixWorld(true)
const savedCamera = JSON.parse(JSON.stringify(captureCamera(liveCamera)))
const restoredCamera = new PerspectiveCamera(50, 1.44)
restoreCamera(restoredCamera, savedCamera)
assert.deepEqual(captureCamera(restoredCamera), savedCamera, 'Camera serialization restores the exact ECEF pose, lens and clipping planes')
assert.deepEqual(target.clone().project(restoredCamera).toArray(), target.clone().project(liveCamera).toArray(), 'Reload retains the same framing at the same aspect ratio')
const clouds = new CloudsEffect()
clouds.qualityPreset = 'high'
assert.deepEqual([clouds.shadow.cascadeCount, clouds.shadow.mapSize.x, clouds.shadow.splitLambda], [3, 512, 0.6])
const layers = CloudLayers.DEFAULT.clone()
setCloudAltitude(layers, DEFAULT_ENVIRONMENT.cloudAltitude)
assert.deepEqual(Array.from(layers, layer => layer.altitude).slice(0, 3), [4250, 4500, 11000])
layers.forEach((layer, index) => {
  assert.equal(layer.altitude - CloudLayers.DEFAULT[index].altitude, YALONG_ALTITUDE_OFFSET)
  assert.equal(layer.height, CloudLayers.DEFAULT[index].height)
  assert.equal(layer.densityScale, CloudLayers.DEFAULT[index].densityScale)
})
const reflectionClouds = new CloudsEffect()
clouds.coverage = .43; clouds.cloudLayers[0].altitude = 5800
clouds.localWeatherOffset.set(.7, .2); clouds.shapeOffset.set(1, 2, 3)
clouds.sunDirection.set(.2, .5, .8).normalize()
copyReflectionWeather(reflectionClouds, clouds)
assert.equal(reflectionClouds.coverage, .43)
assert.equal(reflectionClouds.cloudLayers[0].altitude, 5800)
assert.deepEqual(reflectionClouds.localWeatherOffset.toArray(), [.7, .2])
assert.deepEqual(reflectionClouds.sunDirection.toArray(), clouds.sunDirection.toArray())
clouds.localWeatherOffset.x = .9
assert.equal(reflectionClouds.localWeatherOffset.x, .7, 'Reflection faces share one frozen capture time, independent of the live weather advance')
assert.equal(reflectionClouds.localWeatherVelocity.length(), 0, 'The reflection probe does not advance a second cloud simulation')
reflectionClouds.dispose(); clouds.dispose()
const originalAerial = new AerialPerspectiveEffect()
const adjustableAerial = new AdjustableAerialPerspectiveEffect()
assert.equal(adjustableAerial.strength.value, DEFAULT_ENVIRONMENT.aerialPerspective, 'Default preserves full Tokyo scattering')
assert.equal(adjustableAerial.uniforms.get('aerialPerspectiveStrength'), adjustableAerial.strength, 'Slider updates the shader uniform directly')
const restoredShader = adjustableAerial.getFragmentShader()
  .replace('uniform float aerialPerspectiveStrength;\n', '')
  .replace(/\s*vec3 radianceBeforeScattering = radiance;\s*/, '')
  .replace(/\s*radiance = mix\(radianceBeforeScattering, radiance, aerialPerspectiveStrength\);\s*/, '')
assert.equal(restoredShader.replace(/\s/g, ''), originalAerial.getFragmentShader().replace(/\s/g, ''), 'Sky, lighting and shadow shader code remain intact')
adjustableAerial.dispose(); originalAerial.dispose()
const receiver = new ModelCloudShadow()
const material = new MeshPhysicalMaterial()
material.onBeforeCompile = shader => { shader.uniforms.existingMaterialUniform = { value: 1 } }
receiver.apply(material)
const modelShader = { uniforms: {}, vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader }
material.onBeforeCompile(modelShader)
assert.ok(modelShader.uniforms.existingMaterialUniform, 'Cloud receiver preserves the PBR material customization')
assert.ok(modelShader.fragmentShader.includes('float stationSunTransmission()'), 'Actual Three physical shader receives the sampler definition')
assert.ok(modelShader.fragmentShader.includes('directLight.color *= stationSunTransmission();'), 'Clouds attenuate direct lighting before diffuse/specular/clearcoat BRDFs')
assert.ok(modelShader.fragmentShader.includes('getShadow( directionalShadowMap'), 'Equipment self-shadows remain active')
const shadowCamera = new PerspectiveCamera()
shadowCamera.position.copy(view.position); shadowCamera.updateMatrixWorld()
const shadow = { map: {}, matrices: [new Matrix4(), new Matrix4(), new Matrix4()], intervals: [new Vector2(), new Vector2(), new Vector2()], cascadeCount: 3, far: 50000, topHeight: 6000 }
receiver.update(null, shadowCamera, new Vector3(0, 1, 0))
assert.equal(receiver.uniforms.stationShadowReady.value, false)
receiver.update(shadow, shadowCamera, new Vector3(0, 1, 0))
assert.equal(receiver.uniforms.stationShadowMap.value, shadow.map, 'Models sample the same completed shadow texture as the terrain')
assert.equal(receiver.uniforms.stationShadowMatrices.value, shadow.matrices, 'Shadow texture and ECEF projection matrices stay paired')
assert.ok(receiver.uniforms.stationShadowAltitudeCorrection.value.toArray().every(Number.isFinite))
assert.equal(receiver.uniforms.stationShadowReady.value, true)
material.dispose()
const stationBounds = new Box3(new Vector3(-1.1, 0, -1.1), new Vector3(1.1, 5.9, 1.1))
const station = new Object3D(), stationSun = new DirectionalLight()
station.matrixAutoUpdate = false
stationSun.shadow.mapSize.set(4096, 4096)
for (const scale of [100, 4950, 10000]) {
  station.matrix.copy(stationTransform(STATION_COORDINATES.labashan, 3400, scale, 141))
  station.updateMatrixWorld(true)
  stationSun.target.position.set(0, 5.4587, 0).applyMatrix4(station.matrix)
  stationSun.position.copy(stationSun.target.position).addScaledVector(new Vector3(.3, .8, .5).normalize(), 80000)
  fitStationShadow(stationSun, station, stationBounds)
  const shadowView = stationSun.shadow.camera
  const texel = Math.max(shadowView.right - shadowView.left, shadowView.top - shadowView.bottom) / 4096
  assert.ok(Math.abs(-stationSun.shadow.bias * (shadowView.far - shadowView.near) / texel - 2) < 1e-9, 'Depth bias stays two shadow texels at every model scale')
  assert.equal(stationSun.shadow.normalBias, texel, 'Normal offset follows actual shadow resolution')
  for (const x of [-1.1, 1.1]) for (const y of [0, 5.9]) for (const z of [-1.1, 1.1]) {
    const point = new Vector3(x, y, z).applyMatrix4(station.matrix).project(shadowView)
    assert.ok(Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) < 1, 'All model corners stay inside the fitted shadow camera')
  }
}
assert.throws(() => createGeospatialScene({}), /访问凭据/, 'Missing credentials fail before allocating WebGL resources')
console.log('Geospatial scene: station placement, Tokyo camera/clouds, scattering, model cloud shadows, fitted self-shadows and credential boundary passed')
