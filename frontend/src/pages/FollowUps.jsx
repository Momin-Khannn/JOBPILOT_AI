import { useEffect, useState } from 'react'
import { AlertCircle, Bell, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client.js'

export default function FollowUps() {
  const [followUps, setFollowUps] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const data = await api.followUps()
    setFollowUps(data.followUps)
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

  async function complete(id) {
    try {
      await api.updateFollowUp(id, { status: 'completed' })
      await load()
      setMessage('Follow-up marked complete.')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setError('This browser does not support notifications.')
      return
    }
    const permission = await Notification.requestPermission()
    setMessage(permission === 'granted' ? 'Notifications enabled.' : 'Notifications were not enabled.')
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Follow-up scheduler</span>
          <h1>Follow-ups</h1>
          <p>Review scheduled follow-ups after applications are sent. Sending still requires approval.</p>
        </div>
        <button className="button button-secondary" onClick={enableNotifications}><Bell size={16} /> Enable alerts</button>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
      {message && <div className="success">{message}</div>}

      <section className="followup-list">
        {followUps.map(item => (
          <article className="panel followup-card" key={item.id}>
            <div>
              <h2>{item.role}</h2>
              <p>{item.company} · due {new Date(item.dueAt).toLocaleDateString()}</p>
            </div>
            <pre>{item.body}</pre>
            <button className="button button-secondary" onClick={() => complete(item.id)} disabled={item.status === 'completed'}>
              <CheckCircle2 size={16} /> {item.status === 'completed' ? 'Completed' : 'Mark complete'}
            </button>
          </article>
        ))}
        {!followUps.length && <article className="panel"><p className="muted">No follow-ups scheduled yet. Queue and send applications to create follow-up plans.</p></article>}
      </section>
    </div>
  )
}
