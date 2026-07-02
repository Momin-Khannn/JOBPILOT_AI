import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { api } from '../api/client.js'

export default function GoogleAuthCallback({ onAuthenticated }) {
  const [params] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const fragmentParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const authError = fragmentParams.get('error') || params.get('error')

    if (authError) {
      setError(authError)
      window.history.replaceState({}, '', '/auth/google/callback')
      return
    }

    window.history.replaceState({}, '', '/auth/google/callback')
    api.me()
      .then(({ user }) => {
        api.setSessionToken('')
        onAuthenticated(user)
      })
      .catch((err) => {
        api.setSessionToken('')
        setError(err.message)
      })
  }, [onAuthenticated, params])

  return (
    <div className="auth-shell">
      <div className="auth-copy">
        <span className="eyebrow">Google account</span>
        <h1>Finishing secure sign-in</h1>
        <p>Your official Google email is being linked to a private JobPilot workspace for updates, resumes, and application activity.</p>
      </div>

      <section className="panel auth-panel">
        {error ? (
          <>
            <div className="alert"><AlertCircle size={18} />{error}</div>
            <Link className="button button-primary" to="/login">Back to login</Link>
          </>
        ) : (
          <>
            <ShieldCheck size={34} />
            <h2>Verifying Google account</h2>
            <p className="muted">This usually takes a moment.</p>
            <Loader2 className="spin" size={22} />
          </>
        )}
      </section>
    </div>
  )
}
