import { useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, BadgeCheck, Command, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
import { api } from '../api/client.js'

export default function LoginPage({ onAuthenticated }) {
  const clientLoginHref = import.meta.env.DEV ? 'http://127.0.0.1:3000/login' : '/login'
  const publicSiteHref = import.meta.env.DEV ? 'http://127.0.0.1:3000/' : '/'
  const [form, setForm] = useState({
    email: '',
    password: '',
    captchaAnswer: '',
  })
  const [security, setSecurity] = useState({
    captchaEnabled: false,
    twoFactorEnabled: false,
    ownerGoogleEnabled: false,
    ownerPasswordEnabled: false,
  })
  const [captcha, setCaptcha] = useState(null)
  const [twoFactor, setTwoFactor] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
      api.setSessionToken('')
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
    <div className="owner-login-shell">
      <section className="owner-login-brief">
        <div className="admin-login-brand"><span><Command size={18} /></span><strong>JobPilot Control</strong><small>OWNER</small></div>
        <div className="owner-login-copy">
          <span>Private operations workspace</span>
          <h1>The operating layer behind JobPilot.</h1>
          <p>Control client access, application traffic, delivery infrastructure, and the system record from a workspace built only for ownership.</p>
        </div>
        <div className="admin-login-proof"><span><ShieldCheck size={17} /><strong>Restricted access</strong><small>Owner identity is checked on every session.</small></span><span><BadgeCheck size={17} /><strong>Audited actions</strong><small>Operational changes remain reviewable.</small></span></div>
      </section>

      <main className="owner-login-entry">
      <div className="mobile-login-brand"><span><Command size={17} /></span><strong>JobPilot Control</strong><small>OWNER</small></div>
      <form className="login-panel" onSubmit={twoFactor ? verifyCode : submit}>
        <div className="admin-form-head"><span>Protected workspace</span><strong>{twoFactor ? 'Verify your sign-in' : 'Sign in to Control'}</strong><p>{twoFactor ? 'Use the short-lived code sent to the owner email.' : 'Use your approved Google account or owner credentials.'}</p></div>
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

            {security.ownerGoogleEnabled && (
              <button className="button button-primary" type="button" disabled={busy} onClick={continueWithGoogle}>
                <ArrowUpRight size={16} />
                {busy ? 'Opening Google...' : 'Continue with owner Google account'}
              </button>
            )}

            {security.ownerGoogleEnabled && security.ownerPasswordEnabled && <div className="login-divider"><span>or use owner password</span></div>}

            {security.ownerPasswordEnabled && (
              <>
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
              </>
            )}

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

            {security.ownerPasswordEnabled && (
              <button className="button button-secondary" disabled={busy || (security.captchaEnabled && (!captcha || form.captchaAnswer.length !== 5))}>
                <LockKeyhole size={15} />
                {busy ? 'Signing in...' : security.twoFactorEnabled ? 'Continue securely' : 'Login to admin portal'}
              </button>
            )}

            {!security.ownerGoogleEnabled && !security.ownerPasswordEnabled && <div className="alert"><AlertCircle size={18} />Owner sign-in is not configured in this environment.</div>}

            <div className="login-links">
              <a href={clientLoginHref}>Open client login</a>
              <a href={publicSiteHref}>Public site</a>
            </div>
          </>
        )}
      </form>
      <p className="login-entry-note"><LockKeyhole size={14} /> Access is limited to approved owner identities.</p>
      </main>
    </div>
  )
}
