import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, BadgeCheck, CalendarClock, Filter, Mail, MapPin, MessageCircle, RefreshCw, ShieldCheck, Sparkles, Star, X } from 'lucide-react'
import { api } from '../api/client.js'
import JobCard from '../components/JobCard.jsx'

const jobTypes = ['All', 'Remote', 'Office 9-5', 'Internship', 'Hybrid']
const deadlineTypes = [
  ['open', 'Open only'],
  ['closing_soon', 'Closing soon'],
  ['unknown', 'Deadline unknown'],
  ['expired', 'Expired'],
  ['all', 'All jobs'],
]

const sortOptions = [
  ['match_desc', 'Best match first'],
  ['ats_desc', 'ATS score: high to low'],
  ['risk_asc', 'Risk: low to high'],
  ['risk_desc', 'Risk: high to low'],
  ['deadline_asc', 'Deadline: soonest first'],
]

const riskWeight = { low: 1, medium: 2, high: 3, critical: 4 }

export default function JobFeed() {
  const [jobs, setJobs] = useState([])
  const [selected, setSelected] = useState([])
  const [filters, setFilters] = useState({ query: '', location: '', type: 'All', minSalary: '', experience: '', deadline: 'open' })
  const [channel, setChannel] = useState('gmail')
  const [whatsappRecipientOptIn, setWhatsappRecipientOptIn] = useState(false)
  const [sortBy, setSortBy] = useState('match_desc')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeJob, setActiveJob] = useState(null)
  const reduceMotion = useReducedMotion()

  async function load(nextFilters = filters) {
    setLoading(true)
    try {
      const data = await api.searchJobs(nextFilters)
      setJobs(data.jobs)
      setSelected(current => current.filter(selectedJob => data.jobs.some(job => job.id === selectedJob.id && !job.isExpired)))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.goal()
      .then(({ goal }) => {
        const preferredType = goal.remotePreference === 'remote'
          ? 'Remote'
          : goal.remotePreference === 'hybrid'
            ? 'Hybrid'
            : goal.remotePreference === 'onsite'
              ? 'Office 9-5'
              : jobTypes.includes(goal.jobTypes?.[0]) ? goal.jobTypes[0] : 'All'
        const preferredFilters = {
          query: '',
          location: goal.locations?.[0] || '',
          type: preferredType,
          minSalary: goal.minSalary || '',
          experience: '',
          deadline: 'open',
        }
        setFilters(preferredFilters)
        return load(preferredFilters)
      })
      .catch(err => setError(err.message))
  }, [])

  useEffect(() => {
    if (!activeJob) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') setActiveJob(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [activeJob])

  const selectedIds = useMemo(() => new Set(selected.map(job => job.id)), [selected])
  const orderedJobs = useMemo(() => [...jobs].filter(job => {
    const direct = job.provider === 'jobpilot' || job.applicationMode === 'in_app'
    if (sourceFilter === 'direct') return direct
    if (sourceFilter === 'external') return !direct
    return true
  }).sort((a, b) => {
    const directBoost = Number(Boolean(b.promoted)) - Number(Boolean(a.promoted))
    if (directBoost) return directBoost
    if (sortBy === 'ats_desc') return Number(b.atsScore || 0) - Number(a.atsScore || 0)
    if (sortBy === 'risk_asc' || sortBy === 'risk_desc') {
      const difference = (riskWeight[String(a.risk?.riskLevel || '').toLowerCase()] || 0) - (riskWeight[String(b.risk?.riskLevel || '').toLowerCase()] || 0)
      return sortBy === 'risk_desc' ? -difference : difference
    }
    if (sortBy === 'deadline_asc') return new Date(a.expiresAt || '2999-12-31') - new Date(b.expiresAt || '2999-12-31')
    return Number(b.matchScore || 0) - Number(a.matchScore || 0)
  }), [jobs, sortBy, sourceFilter])

  function toggle(job) {
    if (job.provider === 'jobpilot' || job.applicationMode === 'in_app') {
      setActiveJob(job)
      return
    }
    setSelected(current => selectedIds.has(job.id)
      ? current.filter(item => item.id !== job.id)
      : [...current, job]
    )
  }

  async function queue() {
    try {
      const data = await api.queueApplications(selected, channel, whatsappRecipientOptIn)
      setSelected([])
      setWhatsappRecipientOptIn(false)
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
          <p>Apply privately to verified JobPilot employers or review opportunities from the open market.</p>
        </div>
        <button className="button button-primary" onClick={queue} disabled={!selected.length || (channel === 'whatsapp' && !whatsappRecipientOptIn)}>
          Queue {selected.length || ''} for review
        </button>
      </section>

      <div className="source-switcher" role="group" aria-label="Job source">
        <button className={sourceFilter === 'all' ? 'active' : ''} onClick={() => setSourceFilter('all')}>All jobs</button>
        <button className={sourceFilter === 'direct' ? 'active' : ''} onClick={() => setSourceFilter('direct')}><BadgeCheck size={15} /> JobPilot Direct</button>
        <button className={sourceFilter === 'external' ? 'active' : ''} onClick={() => setSourceFilter('external')}>Open market</button>
      </div>

      {sourceFilter !== 'external' && orderedJobs.some(job => job.promoted) && (
        <div className="promoted-disclosure"><Sparkles size={15} /><span><strong>Promoted roles</strong> are paid placements from verified employers. Promotion never changes match scoring or safety review.</span></div>
      )}

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
          <select value={channel} onChange={e => {
            setChannel(e.target.value)
            setWhatsappRecipientOptIn(false)
          }}>
            <option value="gmail">Gmail</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label>
          Deadline
          <select value={filters.deadline} onChange={e => setFilters({ ...filters, deadline: e.target.value })}>
            {deadlineTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Sort results
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button className="button button-secondary" onClick={() => load()} disabled={loading}>
          {loading ? <RefreshCw size={16} className="spin" /> : <Filter size={16} />} Apply
        </button>
      </section>

      {channel === 'whatsapp' && (
        <label className="channel-consent">
          <input type="checkbox" checked={whatsappRecipientOptIn} onChange={event => setWhatsappRecipientOptIn(event.target.checked)} />
          <span>
            <strong>Recipient permission confirmed</strong>
            <small>Every selected recruiter explicitly permitted contact on their WhatsApp number. JobPilot sends text only; no CV or document is attached.</small>
          </span>
        </label>
      )}

      {message && <div className="success">{message}</div>}
      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

      <motion.section className="job-grid" layout={!reduceMotion}>
        {orderedJobs.map(job => (
          <JobCard key={job.id} job={job} selected={selectedIds.has(job.id)} onToggle={toggle} onOpen={setActiveJob} />
        ))}
      </motion.section>

      {createPortal(<AnimatePresence>
        {activeJob && (
          <JobDetailModal
            job={activeJob}
            selected={selectedIds.has(activeJob.id)}
            onClose={() => setActiveJob(null)}
            onToggle={() => toggle(activeJob)}
            onApplied={() => {
              setMessage(`Application sent to ${activeJob.company} inside JobPilot.`)
              setActiveJob(null)
            }}
          />
        )}
      </AnimatePresence>, document.body)}
    </div>
  )
}

function deadlineText(job) {
  if (job.expiresAt) return new Date(job.expiresAt).toLocaleDateString()
  return job.deadlineStatus || 'Unknown'
}

function JobDetailModal({ job, selected, onClose, onToggle, onApplied }) {
  const disabled = Boolean(job.isExpired || job.deadlineStatus === 'closed' || job.deadlineStatus === 'expired')
  const isDirect = job.provider === 'jobpilot' || job.applicationMode === 'in_app'
  const [note, setNote] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const reduceMotion = useReducedMotion()
  const closeRef = useRef(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  async function applyDirect() {
    setApplying(true)
    setApplyError('')
    try {
      await api.applyDirectJob(job.id, { note })
      onApplied()
    } catch (err) {
      setApplyError(err.message)
    } finally {
      setApplying(false)
    }
  }

  return (
    <motion.div
      className="job-modal-backdrop"
      role="presentation"
      data-testid="job-detail-backdrop"
      onMouseDown={onClose}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.article
        className="job-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-detail-title"
        data-testid="job-detail-modal"
        onMouseDown={event => event.stopPropagation()}
        initial={reduceMotion ? false : { opacity: 0, y: 26, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.985 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="job-modal-hero">
          <button ref={closeRef} type="button" className="icon-button job-modal-close" onClick={onClose} aria-label="Close job details">
            <X size={18} />
          </button>
          <div>
            <span className="eyebrow">{isDirect ? 'JobPilot Direct · Verified employer' : (job.source || job.provider || 'Open-market source')}</span>
            <h2 id="job-detail-title">{job.title}</h2>
            <p>{job.company}</p>
          </div>
        </div>
        <div className="job-modal-content">
          <div className="job-modal-actions">
            {isDirect ? (
              <span className="direct-trust-line"><ShieldCheck size={16} /> Identity checked by JobPilot</span>
            ) : (
              <>
                <button className={selected ? 'button button-secondary' : 'button button-primary'} disabled={disabled} onClick={onToggle}>
                  {selected ? 'Remove from review queue' : 'Queue for review'}
                </button>
                {job.url && <a className="button button-secondary" href={job.url} target="_blank" rel="noreferrer">Open original</a>}
              </>
            )}
          </div>
          {isDirect && (
            <section className="direct-apply-panel">
              <div><BadgeCheck size={20} /><span><strong>Apply inside JobPilot</strong><small>Your verified CV is shared privately with this employer. Your email and phone stay hidden.</small></span></div>
              <label>Optional note<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1500} placeholder="A short, relevant note for the hiring team" /></label>
              {applyError && <div className="alert"><AlertCircle size={17} />{applyError}</div>}
              <button className="button button-primary" disabled={disabled || applying} onClick={applyDirect}>{applying ? 'Sending application…' : 'Apply in JobPilot'}</button>
            </section>
          )}
          <div className="job-modal-meta">
            <span><MapPin size={15} />{job.location}</span>
            <span>{job.type}</span>
            <span>{job.salary || 'Salary not listed'}</span>
            <span><CalendarClock size={15} />{deadlineText(job)}</span>
            <span><Star size={15} />Match {job.matchScore ?? '--'}%</span>
            <span>ATS {job.atsScore ?? '--'}%</span>
            {job.recruiterEmail && <span><Mail size={15} />Email available</span>}
            {job.recruiterPhone && <span><MessageCircle size={15} />WhatsApp available</span>}
          </div>
          <section className="job-modal-section">
            <h3>Job description</h3>
            <p>{job.description || 'No description provided.'}</p>
          </section>
          {(job.tags || []).length > 0 && (
            <section className="job-modal-section">
              <h3>Skills and keywords</h3>
              <div className="tag-row">{job.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
            </section>
          )}
        </div>
      </motion.article>
    </motion.div>
  )
}
