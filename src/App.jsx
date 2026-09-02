import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Shell from './components/Shell'
import CockpitPage from './pages/CockpitPage'
import TicketPage from './pages/TicketPage'
import InspectionPage from './pages/InspectionPage'
import InspectionTaskPage from './pages/InspectionTaskPage'
import ChatPage from './pages/ChatPage'
import AgentPage from './pages/AgentPage'
import StationPage from './pages/StationPage'
import DevicePage from './pages/DevicePage'
import DefectManagementPage from './pages/DefectManagementPage'
import WorkOrderPage from './pages/WorkOrderPage'
import AlarmPage from './pages/AlarmPage'
import PlaceholderPage from './pages/PlaceholderPage'
import { scheduleSolarPlantAssetPreload } from './preloadSolarPlantAssets'

// 生产管理子菜单占位模块
const PRODUCTION_PLACEHOLDERS = [
  ['report', '生产报表'],
  ['device', '设备管理'],
  ['operation', '运行管理'],
  ['maintenance', '检修管理'],
  ['plan', '计划管理'],
  ['material', '物资管理'],
  ['project', '项目管理'],
  ['mobile', '移动应用'],
]

// 一级导航占位模块（告警管理已实装为 AlarmPage）
const MODULE_PLACEHOLDERS = [
  ['diagnosis', '诊断预警'],
  ['smart-inspection', '智能巡检'],
  ['energy', '能效管理'],
  ['security', '智能安防'],
]

export default function App() {
  const navigate = useNavigate()
  useEffect(() => scheduleSolarPlantAssetPreload(), [])
  // 打开/刷新一律回总览页，HashRouter 不记忆上次页面（仅挂载时执行一次，空依赖防 navigate 身份抖动误触发）
  useEffect(() => {
    navigate('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={null} />
        <Route path="workbench" element={<CockpitPage />} />
        <Route path="ticket/:ticketId" element={<TicketPage />} />
        <Route path="inspection" element={<InspectionPage />} />
        <Route path="inspection-task/:ticketId" element={<InspectionTaskPage />} />
        <Route path="chat/:chatId?" element={<ChatPage />} />
        <Route path="agent/:agentId" element={<AgentPage />} />
        <Route path="station/:stationId" element={<StationPage />} />
        <Route path="station/:stationId/device/:deviceId" element={<DevicePage />} />
        <Route path="production" element={<Navigate to="/production/defect" replace />} />
        <Route path="production/defect" element={<DefectManagementPage />} />
        <Route path="production/work-order" element={<WorkOrderPage />} />
        <Route path="alarm" element={<AlarmPage />} />
        {PRODUCTION_PLACEHOLDERS.map(([key, title]) => (
          <Route element={<PlaceholderPage eyebrow="PRODUCTION" title={title} />} key={key} path={`production/${key}`} />
        ))}
        {MODULE_PLACEHOLDERS.map(([key, title]) => (
          <Route element={<PlaceholderPage title={title} />} key={key} path={key} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
