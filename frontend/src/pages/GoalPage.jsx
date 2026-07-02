import { useEffect, useState } from 'react'
import { AlertCircle, Save, Target } from 'lucide-react'
import { api } from '../api/client.js'

const jobTypes = ['Remote', 'Office 9-5', 'Internship', 'Hybrid']

export default function GoalPage() {
  const [goal, setGoal] = useState({ roles: [], locations: [], jobTypes: [], experienceLevel: '', minSalary: 0 })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.goal().then(data => setGoal(data.goal)).catch(err => setError(err.message))
  }, [])

  function commaList(field, value) {
    setGoal(current => ({ ...current, [field]: value.split(',').map(item => item.trim()).filter(Boolean) }))
  }

  function toggleType(type) {
    setGoal(current => ({
      ...current,
      jobTypes: current.jobTypes.includes(type) ? current.jobTypes.filter(item => item !== type) : [...current.jobTypes, type],
    }))
  }

  async function save(event) {
    event.preventDefault()
    try {
      const data = await api.saveGoal(goal)
      setGoal(data.goal)
      setMessage('Career goal saved. Your job feed will use these preferences.')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div><span className="eyebrow">Search direction</span><h1>Career Goal</h1><p>Tell the agent what to look for so matching and recommendations start from the right target.</p></div>
        <Target size={34} />
      </section>
      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
      {message && <div className="success">{message}</div>}
      <form className="panel settings-grid" onSubmit={save}>
        <label className="wide">Target roles<input value={goal.roles.join(', ')} onChange={e => commaList('roles', e.target.value)} placeholder="Backend Engineer, Data Analyst" /></label>
        <label className="wide">Preferred locations<input value={goal.locations.join(', ')} onChange={e => commaList('locations', e.target.value)} placeholder="Remote, Lahore, Karachi" /></label>
        <label>Experience level<input value={goal.experienceLevel} onChange={e => setGoal({ ...goal, experienceLevel: e.target.value })} placeholder="Entry, mid, senior" /></label>
        <label>Minimum salary<input type="number" min="0" value={goal.minSalary} onChange={e => setGoal({ ...goal, minSalary: Number(e.target.value) })} /></label>
        <fieldset className="wide choice-field"><legend>Job types</legend><div>{jobTypes.map(type => <label key={type}><input type="checkbox" checked={goal.jobTypes.includes(type)} onChange={() => toggleType(type)} />{type}</label>)}</div></fieldset>
        <button className="button button-primary wide"><Save size={16} /> Save career goal</button>
      </form>
    </div>
  )
}
