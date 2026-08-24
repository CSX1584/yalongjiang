import { useMemo } from 'react'
import { mergeAssetRegistry } from './assets/assetRegistry.js'
import { createDefaultDocuments } from './domain/documents.js'
import { ViewportErrorBoundary } from './editor/ViewportErrorBoundary.jsx'
import { MonitorCanvas } from './monitor/MonitorCanvas.jsx'
import {
  DEFAULT_MOCK_STATUS_OPTIONS,
  createMockPvDeviceStatuses,
} from './monitor/monitoringStatus.js'
import './styles/monitor.css'

export function SolarPlantMonitor({
  documents,
  assetRegistry: assetRegistryOverrides,
  environment,
  deviceStatuses,
  performanceMode = false,
  mockStatusOptions = DEFAULT_MOCK_STATUS_OPTIONS,
  className = '',
}) {
  const resolvedDocuments = useMemo(
    () => documents ?? createDefaultDocuments(),
    [documents],
  )
  const assetRegistry = useMemo(
    () => mergeAssetRegistry(assetRegistryOverrides),
    [assetRegistryOverrides],
  )
  const resolvedDeviceStatuses = useMemo(
    () =>
      deviceStatuses === undefined
        ? createMockPvDeviceStatuses(resolvedDocuments, mockStatusOptions)
        : (deviceStatuses ?? {}),
    [deviceStatuses, mockStatusOptions, resolvedDocuments],
  )

  return (
    <section
      className={`solar-plant-monitor ${className}`.trim()}
      aria-label="光伏电站三维监控场景"
    >
      <ViewportErrorBoundary>
        <MonitorCanvas
          assetRegistry={assetRegistry}
          deviceStatuses={resolvedDeviceStatuses}
          documents={resolvedDocuments}
          environment={environment}
          performanceMode={performanceMode}
        />
      </ViewportErrorBoundary>
    </section>
  )
}
