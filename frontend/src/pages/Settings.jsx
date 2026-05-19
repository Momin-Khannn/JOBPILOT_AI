import { useEffect, useState } from 'react'
import { AlertCircle, Save } from 'lucide-react'
import { api } from '../api/client.js'

export default function Settings() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.settings()
      .then(data => setUser(data.user))
      .catch(err => setError(err.message))
  }, [])

  function update(path, value) {
    setUser(current => {
      const next = structuredClone(current)
      if (path.startsWith('preferences.')) {
        next.preferences[path.replace('preferences.', '')] = value
      } else {
        next[path] = value
      }
      return next
    })
  }

  async function save(event) {
    event.preventDefault()
    try {
      const data = await api.saveSettings(user)
      setUser(data.user)
      setMessage('Settings saved.')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  if (!user) return <p className="muted">Loading settings...</p>

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Preferences and safety</span>
          <h1>Settings</h1>
          <p>Control profile details, target job preferences, blacklists, and daily send limits.</p>
        </div>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
      {message && <div className="success">{message}</div>}

      <form className="panel settings-grid" onSubmit={save}>
        <label>
          Name
          <input value={user.name || ''} onChange={e => update('name', e.target.value)} />
        </label>
        <label>
          Email
          <input value={user.email || ''} onChange={e => update('email', e.target.value)} />
        </label>
        <label>
          Phone
          <input value={user.phone || ''} onChange={e => update('phone', e.target.value)} />
        </label>
        <label>
          Location
          <input value={user.location || ''} onChange={e => update('location', e.target.value)} />
        </label>
        <label>
          Target roles
          <input value={(user.preferences.roles || []).join(', ')} onChange={e => update('preferences.roles', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} />
        </label>
        <label>
          Target locations
          <input value={(user.preferences.locations || []).join(', ')} onChange={e => update('preferences.locations', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} />
        </label>
        <label>
          Experience level
          <input value={user.preferences.experienceLevel || ''} onChange={e => update('preferences.experienceLevel', e.target.value)} />
        </label>
        <label>
          Daily send limit
          <input type="number" value={user.preferences.dailySendLimit || 15} onChange={e => update('preferences.dailySendLimit', Number(e.target.value))} />
        </label>
        <label className="wide">
          Blacklisted companies or roles
          <input value={(user.preferences.blacklist || []).join(', ')} onChange={e => update('preferences.blacklist', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} />
        </label>
        <button className="button button-primary wide"><Save size={16} /> Save settings</button>
      </form>
    </div>
  )
}
