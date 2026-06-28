import { motion, useReducedMotion } from 'framer-motion'
import { CalendarClock, Check, Mail, MapPin, MessageCircle, Plus, Star } from 'lucide-react'

function deadlineLabel(job) {
  if (job.deadlineStatus === 'closed') return 'Closed'
  if (job.deadlineStatus === 'expired') return 'Expired'
  if (job.expiresAt) return `${job.deadlineStatus === 'closing_soon' ? 'Closes' : 'Open until'} ${new Date(job.expiresAt).toLocaleDateString()}`
  return 'Deadline unknown'
}

function descriptionSnippet(text = '') {
  const compact = String(text).replace(/\s+/g, ' ').trim()
  if (compact.length <= 180) return compact
  return `${compact.slice(0, 180).trim()}...`
}

export default function JobCard({ job, selected, onToggle, onOpen }) {
  const disabled = Boolean(job.isExpired || job.deadlineStatus === 'closed' || job.deadlineStatus === 'expired')
  const reduceMotion = useReducedMotion()
  function openFromCard(event) {
    if (event.target.closest('button, a, input, select, textarea')) return
    onOpen(job)
  }
  return (
    <motion.article
      layout={!reduceMotion}
      className={`job-card ${selected ? 'selected' : ''} ${disabled ? 'job-card-disabled' : ''}`}
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.14 }}
      whileHover={reduceMotion || disabled ? undefined : { y: -4 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      onClick={openFromCard}
    >
      <div className="job-head">
        <div>
          <h3><button type="button" className="job-title-button" onClick={() => onOpen(job)}>{job.title}</button></h3>
          <p>{job.company}</p>
        </div>
        <button className="icon-button" disabled={disabled} onClick={() => onToggle(job)} aria-label={selected ? 'Remove job' : 'Select job'}>
          {selected ? <Check size={18} /> : <Plus size={18} />}
        </button>
      </div>
      <button type="button" className="job-card-open" onClick={() => onOpen(job)}>
        <span>View details</span>
      </button>
      <div className="job-meta">
        <span><MapPin size={14} />{job.location}</span>
        <span>{job.type}</span>
        <span>{job.salary}</span>
        <span className={`deadline-pill deadline-${job.deadlineStatus || 'unknown'}`}><CalendarClock size={14} />{deadlineLabel(job)}</span>
        <span>{job.source || job.provider || 'Job source'}</span>
      </div>
      <p className="job-description">{descriptionSnippet(job.description)}</p>
      <div className="tag-row">
        {(job.tags || []).slice(0, 5).map(tag => <span key={tag}>{tag}</span>)}
      </div>
      <div className="score-row">
        <span><Star size={15} /> Match {job.matchScore ?? '--'}%</span>
        <span>ATS {job.atsScore ?? '--'}%</span>
        <span>Risk {job.risk?.riskLevel || 'n/a'}</span>
        <span>{job.recommendation || 'Review'}</span>
        <span className="channel-hints">
          {job.recruiterEmail && <Mail size={15} />}
          {job.recruiterPhone && <MessageCircle size={15} />}
        </span>
      </div>
    </motion.article>
  )
}
