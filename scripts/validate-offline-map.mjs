import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PMTiles } from 'pmtiles'

const publicDirectory = new URL('../public/', import.meta.url)

class BufferSource {
  constructor(key, bytes) {
    this.key = key
    this.bytes = bytes
  }

  getKey() {
    return this.key
  }

  async getBytes(offset, length) {
    return {
      data: this.bytes.buffer.slice(
        this.bytes.byteOffset + offset,
        this.bytes.byteOffset + offset + length,
      ),
    }
  }
}

function resolvePublicAsset(assetPath) {
  return new URL(String(assetPath).replace(/^\.\//, ''), publicDirectory)
}

function longitudeToTileX(longitude, zoom) {
  return Math.floor(((longitude + 180) / 360) * (2 ** zoom))
}

function latitudeToTileY(latitude, zoom) {
  const radians = latitude * Math.PI / 180
  return Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * (2 ** zoom))
}

function readLosslessWebpSize(data) {
  const bytes = Buffer.from(data)
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', '地形瓦片不是 RIFF 容器')
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', '地形瓦片不是 WebP 图片')
  assert.equal(bytes.toString('ascii', 12, 16), 'VP8L', '地形 WebP 必须无损编码，否则会破坏高程颜色值')
  assert.equal(bytes[20], 0x2f, '地形 WebP 无损数据头无效')
  const sizeBits = bytes.readUInt32LE(21)
  return {
    width: (sizeBits & 0x3fff) + 1,
    height: ((sizeBits >>> 14) & 0x3fff) + 1,
  }
}

async function openArchive(assetPath) {
  const fileUrl = resolvePublicAsset(assetPath)
  const bytes = await readFile(fileUrl)
  return {
    archive: new PMTiles(new BufferSource(fileUrl.href, bytes)),
    bytes,
  }
}

const manifest = JSON.parse(await readFile(new URL('offline-map/manifest.json', publicDirectory), 'utf8'))
const style = JSON.parse(await readFile(resolvePublicAsset(manifest.style), 'utf8'))

assert.equal(style.version, 8)
assert.equal(style.sources?.protomaps?.url, 'pmtiles://./offline-map/yalongjiang.pmtiles')
assert.equal(style.glyphs, undefined, '离线样式不能依赖远程字体')
assert.equal(style.sprite, undefined, '离线样式不能依赖远程图标')

const { archive: basemap, bytes: basemapBytes } = await openArchive(manifest.basemap)
const basemapHeader = await basemap.getHeader()
assert.deepEqual(
  [basemapHeader.minLon, basemapHeader.minLat, basemapHeader.maxLon, basemapHeader.maxLat],
  manifest.bounds,
)
assert.equal(basemapHeader.maxZoom, manifest.maxZoom)

const representativeZoom = Math.min(basemapHeader.maxZoom, 12)
const representativeTile = await basemap.getZxy(
  representativeZoom,
  longitudeToTileX(manifest.center[0], representativeZoom),
  latitudeToTileY(manifest.center[1], representativeZoom),
)
assert.ok(representativeTile?.data?.byteLength, '默认视角没有可读取的离线底图瓦片')

const { archive: terrain, bytes: terrainBytes } = await openArchive(manifest.terrain)
const terrainHeader = await terrain.getHeader()
const terrainMetadata = await terrain.getMetadata()
assert.deepEqual(
  [terrainHeader.minLon, terrainHeader.minLat, terrainHeader.maxLon, terrainHeader.maxLat],
  manifest.bounds,
)
assert.equal(terrainHeader.maxZoom, manifest.terrainMaxZoom)
assert.equal(manifest.terrainEncoding, 'terrarium')
assert.equal(manifest.terrainTileSize, 512)
assert.match(terrainMetadata.attribution || '', /mapterhorn/i)

const terrainRepresentativeTile = await terrain.getZxy(
  terrainHeader.maxZoom,
  longitudeToTileX(manifest.center[0], terrainHeader.maxZoom),
  latitudeToTileY(manifest.center[1], terrainHeader.maxZoom),
)
assert.ok(terrainRepresentativeTile?.data?.byteLength, '默认视角没有可读取的离线高程瓦片')
const terrainTileSize = readLosslessWebpSize(terrainRepresentativeTile.data)
assert.deepEqual(terrainTileSize, { width: manifest.terrainTileSize, height: manifest.terrainTileSize })

console.log(JSON.stringify({
  basemap: {
    bytes: basemapBytes.byteLength,
    maxZoom: basemapHeader.maxZoom,
    representativeTileBytes: representativeTile.data.byteLength,
  },
  bounds: manifest.bounds,
  terrain: {
    bytes: terrainBytes.byteLength,
    encoding: manifest.terrainEncoding,
    maxZoom: terrainHeader.maxZoom,
    representativeTileBytes: terrainRepresentativeTile.data.byteLength,
    tileSize: terrainTileSize,
  },
}, null, 2))
