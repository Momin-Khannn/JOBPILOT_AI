import { useEffect, useState } from 'react'
import { AlertCircle, MessageCircle, ShieldCheck } from 'lucide-react'
import { api } from '../api/client.js'

export default function WhatsAppSetup() {
  const [status, setStatus] = useState(null)
  const [provider, setProvider] = useState('twilio')
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
          <p>Use Twilio or Meta Cloud API. V1 avoids unofficial WhatsApp automation.</p>
        </div>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
      {message && <div className="success">{message}</div>}

      <section className="panel integration-panel">
        <MessageCircle size={36} />
        <h2>{status?.connected ? 'WhatsApp configured' : 'Choose a provider'}</h2>
        <label>
          Provider
          <select value={provider} onChange={e => setProvider(e.target.value)}>
            <option value="twilio">Twilio WhatsApp</option>
            <option value="meta">Meta Cloud API</option>
          </select>
        </label>
        <div className="policy-note">
          <ShieldCheck size={18} />
          WhatsApp messages require review approval and daily send limits.
        </div>
        <button className="button button-primary" onClick={configure}>Save provider</button>
      </section>
    </div>
  )
}
