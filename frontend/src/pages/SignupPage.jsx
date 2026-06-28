import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle, Chrome, UserPlus } from 'lucide-react'
import { api } from '../api/client.js'
import AuthScaffold from '../components/AuthScaffold.jsx'
import { trackEvent } from '../utils/analytics.js'

export default function SignupPage({ onAuthenticated }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    acceptedTerms: false,
  })
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState('')
  const [verification, setVerification] = useState(null)

  async function startGoogleSignIn() {
    setGoogleBusy(true)
    try {
      if (!form.acceptedTerms) throw new Error('Accept the Terms and Privacy Notice before creating an account.')
      const payload = await api.googleAuthUrl({ intent: 'signup', acceptedTerms: true })
      trackEvent('signup_google_started')
      window.location.href = payload.url
    } catch (err) {
      setError(err.message)
      setGoogleBusy(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = await api.register(form)
      trackEvent('signup_password_submitted')
      if (payload.emailVerification?.required) {
        setVerification(payload.emailVerification)
        setError('')
        return
      }
      api.setSessionToken(payload.token)
      onAuthenticated(payload.user)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScaffold
      eyebrow="Your private workspace"
      title="Build a better system for your next move."
      description="Create one place for your goals, CV, opportunities, applications, and the evidence behind every decision."
    >
      <form className="panel auth-panel" onSubmit={submit}>
        {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
        {verification && (
          <div className="success reset-result">
            <CheckCircle size={18} />
            <div>
              <strong>Check your email</strong>
              <p>{verification.message}</p>
              {verification.verificationUrl && (
                <>
                  <p className="muted">Local development verification link:</p>
                  <Link className="reset-link" to={new URL(verification.verificationUrl).pathname + new URL(verification.verificationUrl).search}>
                    {verification.verificationUrl}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        <button type="button" className="button button-google" onClick={startGoogleSignIn} disabled={googleBusy || !form.acceptedTerms}>
          <Chrome size={16} />
          {googleBusy ? 'Opening Google...' : 'Sign up with Google'}
        </button>

        <div className="auth-divider"><span>or create with email and password</span></div>

        <label>
          Full name
          <input
            placeholder="Your full name"
            value={form.name}
            onChange={event => setForm({ ...form, name: event.target.value })}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={event => setForm({ ...form, email: event.target.value })}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={event => setForm({ ...form, password: event.target.value })}
          />
        </label>

        <label className="terms-consent">
          <input type="checkbox" checked={form.acceptedTerms} onChange={event => setForm({ ...form, acceptedTerms: event.target.checked })} />
          <span>I am at least 18 and agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Notice</Link>.</span>
        </label>

        <button className="button button-primary" disabled={busy || !form.acceptedTerms}>
          <UserPlus size={15} />
          {busy ? 'Creating account...' : 'Create account'}
        </button>

        <div className="auth-links">
          <Link to="/login">Already have an account?</Link>
          <Link to="/">Home</Link>
        </div>
      </form>
    </AuthScaffold>
  )
}
