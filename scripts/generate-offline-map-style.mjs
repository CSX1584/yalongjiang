import { mkdir, writeFile } from 'node:fs/promises'
import { layers, DARK } from '@protomaps/basemaps'

const outputDirectory = new URL('../public/offline-map/', import.meta.url)
const outputPath = new URL('style.json', outputDirectory)

const style = {
  version: 8,
  name: '雅砻江运维离线地图',
  metadata: {
    'ops:provider': 'Protomaps Basemap',
    'ops:license': 'OpenStreetMap data © OpenStreetMap contributors, ODbL',
  },
  sources: {
    protomaps: {
      type: 'vector',
      url: 'pmtiles://./offline-map/yalongjiang.pmtiles',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a> · <a href="https://github.com/protomaps/basemaps" target="_blank">Protomaps</a>',
    },
  },
  layers: layers('protomaps', DARK),
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, `${JSON.stringify(style, null, 2)}\n`)
