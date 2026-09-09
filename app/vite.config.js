import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const SOLAR_PLANT_PACKAGE_PATH = '/node_modules/solar-plant-monitor-embed/'

function solarPlantMonitorAssets() {
  let command = 'serve'

  return {
    name: 'solar-plant-monitor-assets',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = request.url ?? ''
        const queryIndex = requestUrl.indexOf('?')
        if (queryIndex === -1) {
          next()
          return
        }

        const pathname = requestUrl.slice(0, queryIndex)
        const queryText = requestUrl.slice(queryIndex + 1)
        const query = new URLSearchParams(queryText)
        if (
          !pathname.includes(SOLAR_PLANT_PACKAGE_PATH) ||
          (!query.has('raw') && !query.has('url'))
        ) {
          next()
          return
        }

        const filePath = resolve(
          server.config.root,
          `.${decodeURIComponent(pathname)}`,
        )
        const moduleSource = query.has('raw')
          ? readFileSync(filePath, 'utf8')
          : `/@fs${filePath}`

        response.statusCode = 200
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        response.setHeader('Cache-Control', 'no-cache')
        response.end(`export default ${JSON.stringify(moduleSource)}`)
      })
    },
    configResolved(config) {
      command = config.command
    },
    load(id) {
      const queryIndex = id.indexOf('?')
      if (queryIndex === -1) return null

      const filePath = id.slice(0, queryIndex)
      if (!filePath.includes(SOLAR_PLANT_PACKAGE_PATH)) return null

      const query = new URLSearchParams(id.slice(queryIndex + 1))
      if (query.has('raw')) {
        return `export default ${JSON.stringify(readFileSync(filePath, 'utf8'))}`
      }

      if (!query.has('url')) return null

      if (command === 'serve') {
        return `export default ${JSON.stringify(`/@fs${filePath}`)}`
      }

      const referenceId = this.emitFile({
        type: 'asset',
        name: basename(filePath),
        source: readFileSync(filePath),
      })
      return `export default import.meta.ROLLUP_FILE_URL_${referenceId}`
    },
  }
}

export default defineConfig({
  // Relative asset URLs allow the production build to run inside the
  // self-contained macOS WebKit launcher as well as behind any web server.
  base: './',
  plugins: [solarPlantMonitorAssets(), react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['solar-plant-monitor-embed'],
    include: [
      '@react-three/drei',
      '@react-three/fiber',
      'three',
      'use-sync-external-store/shim/with-selector.js',
      'zustand',
    ],
  },
})
