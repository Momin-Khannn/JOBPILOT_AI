import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api/client.js'
import AdminLayout from './components/AdminLayout.jsx'
import ApplicationsPage from './pages/ApplicationsPage.jsx'
import ActivityPage from './pages/ActivityPage.jsx'
import ClientUpdatesPage from './pages/ClientUpdatesPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import UsersPage from './pages/UsersPage.jsx'

export default function App() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const googleToken = fragment.get('token')
    const googleError = fragment.get('error')
    if (googleToken) api.setSessionToken(googleToken)
    if (googleToken || googleError) {
      window.history.replaceState({}, '', `${import.meta.env.BASE_URL}`)
    }
    if (googleError) setError(googleError)

    api.me()
      .then(({ user: currentUser }) => {
        if (!active) return
        if (currentUser?.role !== 'owner') {
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

  const refreshOverview = useCallback(async () => {
    try {
      const payload = await api.adminOverview()
      setOverview(payload)
      setError('')
      return payload
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  useEffect(() => {
    if (!user) return
    refreshOverview().catch(() => {})
  }, [user])

  async function handleLogout() {
    try {
      await api.logout()
    } catch {}
    api.setSessionToken('')
    setUser(null)
    setOverview(null)
  }

  function handleAuthenticated(nextUser) {
    setUser(nextUser)
  }

  const outletContext = useMemo(() => ({
    overview,
    refreshOverview,
    error,
    setError,
  }), [overview, error, refreshOverview])

  if (!ready) {
    return (
      <div className="loading-shell">
        <div className="panel"><p className="muted">Loading owner portal...</p></div>
      </div>
    )
  }

  return (
    <>
      {error && <div className="global-alert"><AlertCircle size={18} />{error}</div>}
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onAuthenticated={handleAuthenticated} />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onAuthenticated={handleAuthenticated} />} />
        <Route element={user ? <AdminLayout user={user} onLogout={handleLogout} context={outletContext} /> : <Navigate to="/login" replace />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="client-updates" element={<ClientUpdatesPage />} />
          <Route path="activity" element={<ActivityPage />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </>
  )
}
