import { useEffect, useState } from 'react'
import { AlertCircle, Inbox, Sparkles } from 'lucide-react'
import { api } from '../api/client.js'

export default function InboxMonitor() {
  const [form, setForm] = useState({
    from: 'recruiter@arbisoft.com',
    subject: 'Interview invitation for Backend Engineer',
    body: 'We reviewed your application and would like to schedule an interview. Please share your availability this week.',
  })
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await api.inboxEvents()
    setEvents(data.inboxEvents)
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

  async function classify(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await api.classifyInbox(form)
      await load()
      setForm({ from: '', subject: '', body: '' })
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Inbox intelligence</span>
          <h1>Inbox Monitor</h1>
          <p>Paste recruiter email content to classify interviews, offers, rejections, and follow-up needs.</p>
        </div>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

      <section className="two-column">
        <form className="panel settings-grid" onSubmit={classify}>
          <label>
            From
            <input value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} />
          </label>
          <label>
            Subject
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          </label>
          <label className="wide">
            Body
            <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={8} />
          </label>
          <button className="button button-primary wide" disabled={busy}><Sparkles size={16} /> Classify message</button>
        </form>

        <section className="stack">
          {events.map(event => (
            <article className="panel inbox-event" key={event.id}>
              <Inbox size={20} />
              <div>
                <h2>{event.classification?.intent || 'Message'}</h2>
                <p>{event.subject}</p>
                <strong>{event.classification?.confidence ?? '--'}% confidence · {event.classification?.action || 'Review message'}</strong>
              </div>
            </article>
          ))}
          {!events.length && <article className="panel"><p className="muted">No messages classified yet.</p></article>}
        </section>
      </section>
    </div>
  )
}
