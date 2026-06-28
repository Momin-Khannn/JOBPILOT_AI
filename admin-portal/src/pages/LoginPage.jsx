import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, BadgeCheck, LockKeyhole, RefreshCw, Shield, ShieldCheck } from 'lucide-react'
import { api } from '../api/client.js'

export default function LoginPage({ onAuthenticated }) {
  const clientLoginHref = import.meta.env.DEV ? 'http://127.0.0.1:3000/login' : '/login'
  const publicSiteHref = import.meta.env.DEV ? 'http://127.0.0.1:3000/' : '/'
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
  const [error, setError] = useState('')
  const reduceMotion = useReducedMotion()

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

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = await api.login({
        ...form,
        role: 'owner',
        captchaChallengeId: captcha?.challengeId || '',
      })
      if (payload.requiresTwoFactor) {
        setTwoFactor(payload)
        setCode('')
        setError('')
        return
      }
      api.setSessionToken(payload.token)
      onAuthenticated(payload.user)
      setError('')
    } catch (err) {
      setError(err.message)
      if (security.captchaEnabled) loadCaptcha().catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = await api.verifyTwoFactor({ challengeId: twoFactor.challengeId, code })
      api.setSessionToken(payload.token)
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

  async function continueWithGoogle() {
    setBusy(true)
    try {
      const { url } = await api.ownerGoogleAuthUrl()
      window.location.assign(url)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-shell admin-login-shell">
      <motion.section className="login-copy" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="admin-login-brand"><span><Shield size={18} /></span><strong>JobPilot</strong><small>ADMIN</small></div>
        <span className="eyebrow">Private owner software</span>
        <h1>Run the platform with quiet confidence.</h1>
        <p>One secure control room for users, applications, provider health, client updates, and the audit trail behind every change.</p>
        <div className="admin-login-proof"><span><ShieldCheck size={16} /> Owner-only access</span><span><BadgeCheck size={16} /> Complete audit visibility</span></div>
        {import.meta.env.DEV && <p className="muted">Local demo owner: owner@jobpilot.ai / owner12345</p>}
      </motion.section>

      <motion.form className="panel login-panel" onSubmit={twoFactor ? verifyCode : submit} initial={reduceMotion ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, delay: 0.08 }}>
        <div className="admin-form-head"><span>Secure owner session</span><strong>Sign in</strong></div>
        {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

        {twoFactor ? (
          <>
            <div className="auth-verification-head">
              <ShieldCheck size={24} />
              <div><strong>Check your owner email</strong><span>Enter the six-digit code sent to {twoFactor.maskedEmail}.</span></div>
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
            <button className="button button-secondary" type="button" onClick={restartLogin}>Use a different login</button>
          </>
        ) : (
          <>

            <button className="button button-primary" type="button" disabled={busy} onClick={continueWithGoogle}>
              <ShieldCheck size={15} />
              {busy ? 'Opening Google...' : 'Continue with owner Google account'}
            </button>

            <div className="login-divider"><span>or use owner password</span></div>

            <label>
              Owner email
              <input
                type="email"
                placeholder="owner@yourcompany.com"
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

            <button className="button button-secondary" disabled={busy || (security.captchaEnabled && (!captcha || form.captchaAnswer.length !== 5))}>
              <LockKeyhole size={15} />
              {busy ? 'Signing in...' : security.twoFactorEnabled ? 'Continue securely' : 'Login to admin portal'}
            </button>

            <div className="login-links">
              <a href={clientLoginHref}>Open client login</a>
              <a href={publicSiteHref}>Public site</a>
            </div>
          </>
        )}
      </motion.form>
    </div>
  )
}
