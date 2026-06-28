import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react'
import { api } from '../api/client.js'

export default function WhatsAppSetup() {
  const [status, setStatus] = useState(null)
  const [provider, setProvider] = useState('meta')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const data = await api.whatsappStatus()
    setStatus(data)
    setProvider(data.provider || 'twilio')
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

  async function configure() {
    try {
      const data = await api.configureWhatsApp(provider)
      setStatus(data)
      setMessage(`WhatsApp configured for ${data.provider}.`)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Official provider only</span>
          <h1>WhatsApp Setup</h1>
          <p>Connect Meta Cloud API for consent-based, text-only WhatsApp delivery.</p>
        </div>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
      {message && <div className="success">{message}</div>}

      <section className="panel integration-panel">
        <MessageCircle size={36} />
        <h2>{status?.connected ? 'WhatsApp configured' : 'Choose an official provider'}</h2>
        <label>
          Provider
          <select value={provider} onChange={e => setProvider(e.target.value)}>
            <option value="meta">Meta Cloud API</option>
            <option value="twilio">Twilio WhatsApp</option>
          </select>
        </label>
        <div className="readiness-list">
          <span className={status?.realSendEnabled ? 'ready' : ''}><CheckCircle2 size={16} /> Real delivery enabled</span>
          <span className={status?.credentialReady ? 'ready' : ''}><CheckCircle2 size={16} /> Provider credentials configured</span>
          <span className={status?.connected ? 'ready' : ''}><CheckCircle2 size={16} /> Provider saved for this workspace</span>
          <span className="ready"><CheckCircle2 size={16} /> Text-only delivery; no CV attachments</span>
        </div>
        <div className="policy-note">
          <ShieldCheck size={18} />
          WhatsApp messages require recipient permission, review approval, and daily send limits.
        </div>
        <button className="button button-primary" onClick={configure}>Save provider</button>
      </section>
    </div>
  )
}
