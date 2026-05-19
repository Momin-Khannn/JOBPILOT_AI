import { Check, Mail, MapPin, MessageCircle, Plus, Star } from 'lucide-react'

export default function JobCard({ job, selected, onToggle }) {
  return (
    <article className={`job-card ${selected ? 'selected' : ''}`}>
      <div className="job-head">
        <div>
          <h3>{job.title}</h3>
          <p>{job.company}</p>
        </div>
        <button className="icon-button" onClick={() => onToggle(job)} aria-label={selected ? 'Remove job' : 'Select job'}>
          {selected ? <Check size={18} /> : <Plus size={18} />}
        </button>
      </div>
      <div className="job-meta">
        <span><MapPin size={14} />{job.location}</span>
        <span>{job.type}</span>
        <span>{job.salary}</span>
      </div>
      <p className="job-description">{job.description}</p>
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
    </article>
  )
}
