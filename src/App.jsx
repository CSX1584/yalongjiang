import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import TicketPage from './pages/TicketPage'
import InspectionPage from './pages/InspectionPage'
import ChatPage from './pages/ChatPage'
import StationPage from './pages/StationPage'
import DevicePage from './pages/DevicePage'
import { scheduleSolarPlantAssetPreload } from './preloadSolarPlantAssets'

export default function App() {
  useEffect(() => scheduleSolarPlantAssetPreload(), [])

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={null} />
        <Route path="ticket/:ticketId" element={<TicketPage />} />
        <Route path="inspection" element={<InspectionPage />} />
        <Route path="chat/:chatId?" element={<ChatPage />} />
        <Route path="station/:stationId" element={<StationPage />} />
        <Route path="station/:stationId/device/:deviceId" element={<DevicePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
