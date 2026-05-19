import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Send } from 'lucide-react'
import { api } from '../api/client.js'
import MetricCard from '../components/MetricCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [applications, setApplications] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    try {
      const data = await api.applications()
      setApplications(data.applications)
      setSummary(data.summary)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function approve(id) {
    setBusyId(id)
    try {
      await api.approveApplication(id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  async function send(application) {
    setBusyId(application.id)
    try {
      if (application.channel === 'whatsapp') await api.sendWhatsApp(application.id)
      else await api.sendGmail(application.id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  const reviewItems = applications.filter(app => ['pending_review', 'approved'].includes(app.status)).slice(0, 5)

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Command center</span>
          <h1>Dashboard</h1>
          <p>Track resume readiness, matched jobs, review queue approvals, and outreach status.</p>
        </div>
        <Link className="button button-primary" to="/jobs">Find jobs</Link>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

      <section className="metrics-grid">
        <MetricCard label="Applications" value={summary?.totalApplications ?? 0} tone="gold" detail="Queued and tracked" />
        <MetricCard label="Needs review" value={summary?.review ?? 0} tone="coral" detail="Approval required" />
        <MetricCard label="Follow-ups" value={summary?.followUps ?? 0} tone="green" detail="Scheduled reminders" />
        <MetricCard label="Avg. match" value={`${summary?.averageMatch ?? 0}%`} tone="blue" detail="Across queued jobs" />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Review Queue</h2>
              <p>Nothing leaves Gmail or WhatsApp until it is approved here.</p>
            </div>
            <ShieldNote />
          </div>
          <div className="item-list">
            {reviewItems.length === 0 && (
              <div className="empty-state">
                <CheckCircle2 size={24} />
                <p>No pending applications. Queue strong matches from the job feed.</p>
              </div>
            )}
            {reviewItems.map(app => (
              <div className="application-row" key={app.id}>
                <div>
                  <strong>{app.job.title}</strong>
                  <span>{app.job.company} · {app.channel}</span>
                </div>
                <StatusBadge status={app.status} />
                {app.status === 'pending_review' ? (
                  <button className="button button-secondary" disabled={busyId === app.id} onClick={() => approve(app.id)}>Approve</button>
                ) : (
                  <button className="button button-primary" disabled={busyId === app.id} onClick={() => send(app)}>
                    <Send size={16} /> Send
                  </button>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Latest Resume</h2>
          {summary?.latestResume ? (
            <div className="resume-summary">
              <strong>{summary.latestResume.profile.name || summary.latestResume.fileName}</strong>
              <p>{summary.latestResume.profile.summary}</p>
              <div className="tag-row">
                {(summary.latestResume.profile.skills || []).slice(0, 8).map(skill => <span key={skill}>{skill}</span>)}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Upload a resume to unlock match scores and ATS suggestions.</p>
              <Link className="button button-secondary" to="/resume">Upload resume</Link>
            </div>
          )}
        </article>
      </section>
    </div>
  )
}

function ShieldNote() {
  return <span className="review-lock">Review-first</span>
}
