import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle, Mail } from 'lucide-react'
import { api } from '../api/client.js'
import AuthScaffold from '../components/AuthScaffold.jsx'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const payload = await api.forgotPassword({ email })
      setResult(payload)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScaffold
      eyebrow="Account recovery"
      title="A quick reset, then back to the work that matters."
      description="Enter the email for your client account and we’ll prepare a secure, time-limited reset link."
    >
      <form className="panel auth-panel" onSubmit={submit}>
        {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
        {result && (
          <div className="success reset-result">
            <CheckCircle size={18} />
            <div>
              <strong>Password reset ready</strong>
              <p>{result.message}</p>
              {result.resetUrl && (
                <>
                  <p className="muted">Local development reset link:</p>
                  <Link className="reset-link" to={new URL(result.resetUrl).pathname + new URL(result.resetUrl).search}>
                    {result.resetUrl}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        <label>
          Email
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </label>

        <button className="button button-primary" disabled={busy}>
          <Mail size={15} />
          {busy ? 'Preparing reset...' : 'Send reset link'}
        </button>

        <div className="auth-links">
          <Link to="/login">Back to login</Link>
          <Link to="/signup">Create account</Link>
        </div>
      </form>
    </AuthScaffold>
  )
}
