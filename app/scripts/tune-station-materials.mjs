import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../public/models/station_light.glb', import.meta.url)
const original = readFileSync(path)
assert.equal(original.readUInt32LE(0), 0x46546c67)
assert.equal(original.readUInt32LE(4), 2)
assert.equal(original.readUInt32LE(16), 0x4e4f534a)
const jsonEnd = 20 + original.readUInt32LE(12)
const model = JSON.parse(original.subarray(20, jsonEnd))
const material = (name) => {
  const match = model.materials.find((item) => item.name === name)
  assert.ok(match, `Missing material: ${name}`)
  return match
}

// Painted equipment reflects illumination; the diffuse texture is not an emission map.
const enclosure = material('Material')
delete enclosure.emissiveTexture
enclosure.emissiveFactor = [0, 0, 0]
enclosure.pbrMetallicRoughness.roughnessFactor = 0.55
// Retain the authored roughness/normal textures, with glass rather than full-metal reflectance.
Object.assign(material('光伏.001').pbrMetallicRoughness, { metallicFactor: 0.15, roughnessFactor: 0.65 })
Object.assign(material('Material.002').pbrMetallicRoughness, { metallicFactor: 0.65, roughnessFactor: 0.4 })
Object.assign(material('风车材质').pbrMetallicRoughness, { metallicFactor: 0.05, roughnessFactor: 0.5 })
// Neutral concrete avoids the previous yellow/green cast under warm sunlight.
Object.assign(material('Material.001').pbrMetallicRoughness, { baseColorFactor: [0.55, 0.55, 0.55, 1], roughnessFactor: 0.9 })

const json = Buffer.from(JSON.stringify(model))
const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20)
json.copy(padded)
const header = Buffer.from(original.subarray(0, 20))
header.writeUInt32LE(20 + padded.length + original.length - jsonEnd, 8)
header.writeUInt32LE(padded.length, 12)
const output = Buffer.concat([header, padded, original.subarray(jsonEnd)])
assert.equal(output.readUInt32LE(8), output.length)
assert.ok(output.subarray(20 + padded.length).equals(original.subarray(jsonEnd)), 'Geometry, UVs, animation and image bytes must remain unchanged')
writeFileSync(path, output)
console.log('Station PBR materials updated; binary geometry and textures preserved.')
