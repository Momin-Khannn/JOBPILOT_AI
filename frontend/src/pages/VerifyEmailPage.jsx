import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle, MailCheck } from 'lucide-react'
import { api } from '../api/client.js'
import AuthScaffold from '../components/AuthScaffold.jsx'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState({ loading: true, error: '', message: '' })
  const token = searchParams.get('token') || ''

  useEffect(() => {
    if (!token) {
      setStatus({ loading: false, error: 'This verification link is missing its token.', message: '' })
      return
    }
    api.verifyEmail({ token })
      .then(payload => setStatus({ loading: false, error: '', message: payload.message || 'Email verified.' }))
      .catch(error => setStatus({ loading: false, error: error.message, message: '' }))
  }, [token])

  return (
    <AuthScaffold
      eyebrow="Email verification"
      title="Confirm your email address."
      description="A verified email keeps account recovery, billing notices, and security alerts pointed at the right person."
    >
      <section className="panel auth-panel">
        {status.loading && (
          <>
            <MailCheck size={34} />
            <h2>Checking verification link</h2>
            <p className="muted">This usually takes a moment.</p>
          </>
        )}
        {status.error && (
          <>
            <div className="alert"><AlertCircle size={18} />{status.error}</div>
            <Link className="button button-primary" to="/login">Back to login</Link>
          </>
        )}
        {status.message && (
          <>
            <div className="success"><CheckCircle size={18} />{status.message}</div>
            <Link className="button button-primary" to="/login">Login</Link>
          </>
        )}
      </section>
    </AuthScaffold>
  )
}
