import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Bug, CheckCircle, LifeBuoy, Send, Zap } from 'lucide-react'
import { api } from '../api/client.js'
import { trackEvent } from '../utils/analytics.js'

const ticketTypes = [
  ['support', 'Support'],
  ['bug', 'Bug report'],
  ['billing', 'Billing'],
  ['privacy', 'Privacy'],
]

export default function SupportPage() {
  const requestedType = new URLSearchParams(window.location.search).get('type')
  const [form, setForm] = useState({
    type: ticketTypes.some(([value]) => value === requestedType) ? requestedType : 'support',
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const payload = await api.supportContact({
        ...form,
        pageUrl: window.location.href,
      })
      trackEvent('support_ticket_submitted', { type: form.type })
      setSuccess(`${payload.message} Reference: ${payload.ticketId}`)
      setForm(current => ({ ...current, subject: '', message: '' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="support-shell">
      <header className="legal-header">
        <Link className="marketing-brand" to="/"><span className="brand-mark"><Zap size={17} /></span><span><strong>JobPilot</strong><small>support</small></span></Link>
        <Link className="text-link" to="/"><ArrowLeft size={15} /> Back to JobPilot</Link>
      </header>

      <main className="support-layout">
        <section className="support-copy">
          <span className="eyebrow"><LifeBuoy size={15} /> Help and feedback</span>
          <h1>Tell us what needs attention.</h1>
          <p>Send support questions, billing issues, privacy requests, or bug reports. Include the page and steps when something breaks.</p>
          <div className="support-proof">
            <span><CheckCircle size={15} /> Saved to support queue</span>
            <span><Bug size={15} /> Bug reports include page context</span>
          </div>
        </section>

        <form className="panel support-form" onSubmit={submit}>
          {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
          {success && <div className="success"><CheckCircle size={18} />{success}</div>}

          <div className="segmented support-type">
            {ticketTypes.map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={form.type === value ? 'active' : ''}
                onClick={() => setForm({ ...form, type: value })}
              >
                {label}
              </button>
            ))}
          </div>

          <label>
            Name
            <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Your name" />
          </label>
          <label>
            Reply email
            <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" />
          </label>
          <label>
            Subject
            <input value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} placeholder="Short summary" />
          </label>
          <label>
            Message
            <textarea value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} placeholder="What happened? What did you expect?" rows={7} />
          </label>
          <button className="button button-primary" disabled={busy}>
            <Send size={15} />
            {busy ? 'Sending...' : 'Send message'}
          </button>
        </form>
      </main>
    </div>
  )
}
