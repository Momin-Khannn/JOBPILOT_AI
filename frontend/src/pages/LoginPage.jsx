import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Chrome, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
import { api } from '../api/client.js'
import AuthScaffold from '../components/AuthScaffold.jsx'
import { trackEvent } from '../utils/analytics.js'

export default function LoginPage({ onAuthenticated }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    captchaAnswer: '',
  })
  const [security, setSecurity] = useState({ captchaEnabled: false, twoFactorEnabled: false })
  const [captcha, setCaptcha] = useState(null)
  const [twoFactor, setTwoFactor] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadCaptcha() {
    const payload = await api.captcha()
    setCaptcha(payload.enabled === false ? null : payload)
    setForm(current => ({ ...current, captchaAnswer: '' }))
  }

  useEffect(() => {
    api.securityConfig()
      .then(payload => {
        setSecurity(payload)
        if (payload.captchaEnabled) return loadCaptcha()
        return null
      })
      .catch(err => setError(err.message))
  }, [])

  async function startGoogleSignIn() {
    setGoogleBusy(true)
    try {
      const payload = await api.googleAuthUrl()
      trackEvent('login_google_started')
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
      const payload = await api.login({
        ...form,
        role: 'client',
        captchaChallengeId: captcha?.challengeId || '',
      })
      if (payload.requiresTwoFactor) {
        setTwoFactor(payload)
        setCode('')
        setError('')
        return
      }
      api.setSessionToken('')
      onAuthenticated(payload.user)
      setError('')
      trackEvent('login_password_completed')
    } catch (err) {
      setError(err.message)
      if (security.captchaEnabled) loadCaptcha().catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  async function resendVerification() {
    setBusy(true)
    try {
      const payload = await api.resendVerification({ email: form.email })
      setMessage(payload.message)
      setError('')
      if (payload.emailVerification?.verificationUrl) {
        setMessage(`${payload.message} Local link: ${payload.emailVerification.verificationUrl}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = await api.verifyTwoFactor({ challengeId: twoFactor.challengeId, code })
      api.setSessionToken('')
      onAuthenticated(payload.user)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function restartLogin() {
    setTwoFactor(null)
    setCode('')
    setError('')
    if (security.captchaEnabled) loadCaptcha().catch(err => setError(err.message))
  }

  return (
    <AuthScaffold
      eyebrow="Private client access"
      title="Welcome back to your career command center."
      description="Sign in to review opportunities, sharpen your career assets, and decide what moves forward."
    >
      <form className="panel auth-panel" onSubmit={twoFactor ? verifyCode : submit}>
        {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
        {message && <div className="success">{message}</div>}

        {twoFactor ? (
          <>
            <div className="auth-verification-head">
              <ShieldCheck size={24} />
              <div>
                <strong>Check your email</strong>
                <span>Enter the six-digit code sent to {twoFactor.maskedEmail}.</span>
              </div>
            </div>
            <label>
              Verification code
              <input
                className="verification-code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength="6"
                placeholder="000000"
                value={code}
                onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button className="button button-primary" disabled={busy || code.length !== 6}>
              <ShieldCheck size={15} />
              {busy ? 'Verifying...' : 'Verify and login'}
            </button>
            <button className="button button-ghost" type="button" onClick={restartLogin}>Use a different login</button>
          </>
        ) : (
          <>

            <button type="button" className="button button-google" onClick={startGoogleSignIn} disabled={googleBusy}>
              <Chrome size={16} />
              {googleBusy ? 'Opening Google...' : 'Continue with Google'}
            </button>

            <div className="auth-divider"><span>or use email and password</span></div>

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
                placeholder="Your password"
                value={form.password}
                onChange={event => setForm({ ...form, password: event.target.value })}
              />
            </label>

            {security.captchaEnabled && captcha && (
              <div className="captcha-block">
                <div className="captcha-preview">
                  <img src={captcha.image} alt="Bot-check code" />
                  <button className="captcha-refresh" type="button" onClick={() => loadCaptcha().catch(err => setError(err.message))} aria-label="Get a new bot-check code">
                    <RefreshCw size={16} />
                  </button>
                </div>
                <label>
                  Enter the bot-check code
                  <input
                    autoComplete="off"
                    maxLength="5"
                    value={form.captchaAnswer}
                    onChange={event => setForm({ ...form, captchaAnswer: event.target.value.toUpperCase() })}
                  />
                </label>
              </div>
            )}

            <button className="button button-primary" disabled={busy || (security.captchaEnabled && (!captcha || form.captchaAnswer.length !== 5))}>
              <LockKeyhole size={15} />
              {busy ? 'Signing in...' : security.twoFactorEnabled ? 'Continue securely' : 'Login'}
            </button>

            {error.toLowerCase().includes('verify your email') && (
              <button className="button button-ghost" type="button" disabled={busy || !form.email} onClick={resendVerification}>
                Resend verification email
              </button>
            )}

            <div className="auth-links">
              <Link to="/signup">Create account</Link>
              <Link to="/forgot-password">Forgot password?</Link>
              <Link to="/">Home</Link>
            </div>
          </>
        )}
      </form>
    </AuthScaffold>
  )
}
