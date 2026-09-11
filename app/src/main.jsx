import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AppProvider } from './context/AppContext'
import './styles.css'
import projectMapConfig from './data/mapConfig.json'

async function start() {
  // The local server serves the latest disk settings, including in build preview.
  // Static hosting uses the configuration embedded at build time.
  try {
    const response = await fetch('/__map-config', { signal: AbortSignal.timeout(3000) })
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) Object.assign(projectMapConfig, await response.json())
  } catch { /* The bundled project configuration remains available offline. */ }
  createRoot(document.getElementById('root')).render(
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>,
  )
}
start()
