import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api/client.js'
import CookieConsent from './components/CookieConsent.jsx'
import Layout from './components/Layout.jsx'
import PageTracker from './components/PageTracker.jsx'
import Applications from './pages/Applications.jsx'
import CareerLab from './pages/CareerLab.jsx'
import Dashboard from './pages/Dashboard.jsx'
import FollowUps from './pages/FollowUps.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import GmailSetup from './pages/GmailSetup.jsx'
import GoogleAuthCallback from './pages/GoogleAuthCallback.jsx'
import GoalPage from './pages/GoalPage.jsx'
import InboxMonitor from './pages/InboxMonitor.jsx'
import JobFeed from './pages/JobFeed.jsx'
import Landing from './pages/Landing.jsx'
import LegalPage from './pages/LegalPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ProfileBuilder from './pages/ProfileBuilder.jsx'
import PublicCvPage from './pages/PublicCvPage.jsx'
import ResumeManager from './pages/ResumeManager.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import Settings from './pages/Settings.jsx'
import SignupPage from './pages/SignupPage.jsx'
import SupportPage from './pages/SupportPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import WhatsAppSetup from './pages/WhatsAppSetup.jsx'

export default function App() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    let active = true
    api.me()
      .then(({ user: currentUser }) => {
        if (!active) return
        if (currentUser?.role !== 'client') {
          api.setSessionToken('')
          setUser(null)
          setReady(true)
          return
        }
        setUser(currentUser)
        setReady(true)
      })
      .catch(() => {
        api.setSessionToken('')
        if (!active) return
        setUser(null)
        setReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  async function handleLogout() {
    try {
      await api.logout()
    } catch {}
    api.setSessionToken('')
    setUser(null)
  }

  function handleAuthenticated(nextUser) {
    setUser(nextUser)
  }

  if (!ready) {
    return (
      <div className="loading-shell">
        <div className="panel"><p className="muted">Loading JobPilot AI...</p></div>
      </div>
    )
  }

  return (
    <>
      <PageTracker />
      <CookieConsent />
      <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onAuthenticated={handleAuthenticated} />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <SignupPage onAuthenticated={handleAuthenticated} />} />
      <Route path="/auth/google/callback" element={user ? <Navigate to="/dashboard" replace /> : <GoogleAuthCallback onAuthenticated={handleAuthenticated} />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
      <Route path="/reset-password" element={user ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/privacy" element={<LegalPage type="privacy" />} />
      <Route path="/terms" element={<LegalPage type="terms" />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/cv/:slug" element={<PublicCvPage />} />
      <Route element={user ? <Layout user={user} onUserUpdated={setUser} onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="goal" element={<GoalPage />} />
        <Route path="jobs" element={<JobFeed />} />
        <Route path="resume" element={<ResumeManager />} />
        <Route path="profile" element={<ProfileBuilder />} />
        <Route path="applications" element={<Applications />} />
        <Route path="career-lab" element={<CareerLab />} />
        <Route path="followups" element={<FollowUps />} />
        <Route path="inbox" element={<InboxMonitor />} />
        <Route path="gmail" element={<GmailSetup />} />
        <Route path="whatsapp" element={<WhatsAppSetup />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </>
  )
}
