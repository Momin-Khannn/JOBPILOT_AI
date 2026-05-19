import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Applications from './pages/Applications.jsx'
import Dashboard from './pages/Dashboard.jsx'
import FollowUps from './pages/FollowUps.jsx'
import GmailSetup from './pages/GmailSetup.jsx'
import InboxMonitor from './pages/InboxMonitor.jsx'
import JobFeed from './pages/JobFeed.jsx'
import Landing from './pages/Landing.jsx'
import ResumeManager from './pages/ResumeManager.jsx'
import Settings from './pages/Settings.jsx'
import WhatsAppSetup from './pages/WhatsAppSetup.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/" element={<Layout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="jobs" element={<JobFeed />} />
        <Route path="resume" element={<ResumeManager />} />
        <Route path="applications" element={<Applications />} />
        <Route path="followups" element={<FollowUps />} />
        <Route path="inbox" element={<InboxMonitor />} />
        <Route path="gmail" element={<GmailSetup />} />
        <Route path="whatsapp" element={<WhatsAppSetup />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
