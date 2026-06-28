import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle, KeyRound } from 'lucide-react'
import { api } from '../api/client.js'
import AuthScaffold from '../components/AuthScaffold.jsx'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const token = searchParams.get('token') || ''

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!token) {
      setError('This password reset link is missing its token.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const payload = await api.resetPassword({ token, password: form.password })
      setSuccess(payload.message)
      setForm({ password: '', confirmPassword: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScaffold
      eyebrow="Secure your workspace"
      title="Choose a fresh password and keep moving."
      description="Reset links expire after 30 minutes and can only be used once, keeping your career workspace protected."
    >
      <form className="panel auth-panel" onSubmit={submit}>
        {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
        {success && <div className="success"><CheckCircle size={18} />{success}</div>}

        <label>
          New password
          <input
            type="password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={event => setForm({ ...form, password: event.target.value })}
          />
        </label>

        <label>
          Confirm password
          <input
            type="password"
            placeholder="Repeat your new password"
            value={form.confirmPassword}
            onChange={event => setForm({ ...form, confirmPassword: event.target.value })}
          />
        </label>

        <button className="button button-primary" disabled={busy}>
          <KeyRound size={15} />
          {busy ? 'Updating password...' : 'Reset password'}
        </button>

        <div className="auth-links">
          <Link to="/login">Login</Link>
          <Link to="/">Home</Link>
        </div>
      </form>
    </AuthScaffold>
  )
}
