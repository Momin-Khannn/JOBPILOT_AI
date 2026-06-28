import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, Mail, ShieldCheck } from 'lucide-react'
import { api } from '../api/client.js'

export default function GmailSetup() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const data = await api.gmailStatus()
    setStatus(data)
  }

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('gmail')
    const callbackErrors = {
      'permission-denied': 'Google permission was cancelled. Connect again and approve the Gmail send-only permission.',
      'invalid-callback': 'Google returned an incomplete connection. Please start again from this page.',
      'session-expired': 'The Gmail connection session expired. Please start it again.',
      'connection-failed': 'Google could not complete the Gmail connection. Try again and make sure you choose the intended account.',
    }
    if (callbackErrors[result]) setError(callbackErrors[result])
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
          <p>Connect an official Google mailbox so approved applications and follow-ups can be delivered from the user's account.</p>
        </div>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

      <section className="panel integration-panel">
        <Mail size={36} />
        <h2>{status?.connected ? 'Gmail connected' : 'Gmail not connected'}</h2>
        <p>{status?.connected ? status.email : 'Google OAuth credentials are required before Gmail delivery can be activated.'}</p>
        <div className="readiness-list">
          <span className={status?.credentialReady ? 'ready' : ''}><CheckCircle2 size={16} /> OAuth client configured</span>
          <span className={status?.realSendEnabled ? 'ready' : ''}><CheckCircle2 size={16} /> Real delivery enabled</span>
          <span className={status?.connected ? 'ready' : ''}><CheckCircle2 size={16} /> User mailbox connected</span>
        </div>
        <div className="policy-note">
          <ShieldCheck size={18} />
          Gmail sends require review approval, a connected mailbox, and a stored resume attachment before delivery.
        </div>
        <ol className="connection-steps">
          <li><span>1</span><div><strong>Choose your sending Gmail</strong><small>This can be different from your JobPilot login email.</small></div></li>
          <li><span>2</span><div><strong>Approve send-only access</strong><small>JobPilot cannot read or delete your inbox through this permission.</small></div></li>
          <li><span>3</span><div><strong>Return here automatically</strong><small>The connected address will appear above after Google confirms it.</small></div></li>
        </ol>
        <button className="button button-primary" onClick={connect}>{status?.connected ? 'Reconnect Gmail' : 'Connect Gmail'} <ExternalLink size={15} /></button>
      </section>
    </div>
  )
}
