import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Filter, RefreshCw } from 'lucide-react'
import { api } from '../api/client.js'
import JobCard from '../components/JobCard.jsx'

const jobTypes = ['All', 'Remote', 'Office 9-5', 'Internship', 'Hybrid']

export default function JobFeed() {
  const [jobs, setJobs] = useState([])
  const [selected, setSelected] = useState([])
  const [filters, setFilters] = useState({ query: '', location: '', type: 'All', minSalary: '', experience: '' })
  const [channel, setChannel] = useState('gmail')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await api.searchJobs(filters)
      setJobs(data.jobs)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const selectedIds = useMemo(() => new Set(selected.map(job => job.id)), [selected])

  function toggle(job) {
    setSelected(current => selectedIds.has(job.id)
      ? current.filter(item => item.id !== job.id)
      : [...current, job]
    )
  }

  async function queue() {
    try {
      const data = await api.queueApplications(selected, channel)
      setSelected([])
      setMessage(`Queued ${data.queued.length} job(s). ${data.skipped.length} duplicate(s) skipped.`)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Remote · 9-5 · internship · hybrid</span>
          <h1>Job Feed</h1>
          <p>Search roles, compare match scores, and queue only the jobs worth reviewing.</p>
        </div>
        <button className="button button-primary" onClick={queue} disabled={!selected.length}>
          Queue {selected.length || ''} for review
        </button>
      </section>

      <section className="filter-panel">
        <label>
          Role or skill
          <input value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} placeholder="Backend, SQL, React" />
        </label>
        <label>
          Location
          <input value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })} placeholder="Remote, Lahore" />
        </label>
        <label>
          Type
          <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
            {jobTypes.map(type => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label>
          Min salary
          <input type="number" value={filters.minSalary} onChange={e => setFilters({ ...filters, minSalary: e.target.value })} placeholder="0" />
        </label>
        <label>
          Channel
          <select value={channel} onChange={e => setChannel(e.target.value)}>
            <option value="gmail">Gmail</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <button className="button button-secondary" onClick={load} disabled={loading}>
          {loading ? <RefreshCw size={16} className="spin" /> : <Filter size={16} />} Apply
        </button>
      </section>

      {message && <div className="success">{message}</div>}
      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

      <section className="job-grid">
        {jobs.map(job => (
          <JobCard key={job.id} job={job} selected={selectedIds.has(job.id)} onToggle={toggle} />
        ))}
      </section>
    </div>
  )
}
