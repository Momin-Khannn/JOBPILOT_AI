import { useEffect, useState } from 'react'
import { AlertCircle, Mail, ShieldCheck } from 'lucide-react'
import { api } from '../api/client.js'

export default function GmailSetup() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const data = await api.gmailStatus()
    setStatus(data)
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

  async function connect() {
    try {
      const data = await api.gmailAuthUrl()
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Approved email sending</span>
          <h1>Gmail Setup</h1>
          <p>Connect Gmail for real sends, or keep demo mode for safe case-study testing.</p>
        </div>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

      <section className="panel integration-panel">
        <Mail size={36} />
        <h2>{status?.connected ? 'Gmail connected' : 'Gmail not connected'}</h2>
        <p>{status?.connected ? status.email : 'OAuth credentials are required for real Gmail sending.'}</p>
        <div className="policy-note">
          <ShieldCheck size={18} />
          Gmail sends require an approved application. Demo mode records the send without contacting Gmail.
        </div>
        <button className="button button-primary" onClick={connect}>Connect Gmail</button>
      </section>
    </div>
  )
}
