import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  FileUp,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { api } from '../api/client.js'
import MetricCard from '../components/MetricCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [applications, setApplications] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const reduceMotion = useReducedMotion()

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

  useEffect(() => { load() }, [])

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
  const progress = summary?.totalApplications
    ? Math.min(100, Math.round((((summary?.interviews || 0) + (summary?.offers || 0)) / summary.totalApplications) * 100))
    : 0

  return (
    <div className="stack dashboard-page">
      <motion.section
        className="dashboard-hero"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="dashboard-hero-copy">
          <span className="eyebrow"><Sparkles size={13} /> Intelligent job search</span>
          <h1>Make your next move count.</h1>
          <p>One focused workspace for stronger applications, thoughtful outreach, and career decisions backed by evidence.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/jobs">Explore opportunities <ArrowRight size={16} /></Link>
            <Link className="button button-quiet" to="/career-lab">Open Career Lab</Link>
          </div>
        </div>

        <div className="dashboard-signal-card">
          <div className="signal-card-top"><span>Today’s focus</span><span className="signal-live"><i /> Live workspace</span></div>
          <strong>{reviewItems.length ? `${reviewItems.length} application${reviewItems.length === 1 ? '' : 's'} need your review` : 'Your review queue is clear'}</strong>
          <p>{reviewItems.length ? 'Approve only the applications that still feel right.' : 'Use the space to sharpen your next application or practice an interview.'}</p>
          <div className="signal-progress"><span><i style={{ width: `${Math.max(progress, 4)}%` }} /></span><small>{progress}% reached interview or offer stage</small></div>
        </div>
      </motion.section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

      <section className="metrics-grid dashboard-metrics">
        <MetricCard label="Applications" value={summary?.totalApplications ?? 0} tone="gold" detail="Tracked opportunities" />
        <MetricCard label="Needs review" value={summary?.review ?? 0} tone="coral" detail="Your approval matters" />
        <MetricCard label="Follow-ups" value={summary?.followUps ?? 0} tone="green" detail="Planned touchpoints" />
        <MetricCard label="Avg. match" value={`${summary?.averageMatch ?? 0}%`} tone="blue" detail="Across your pipeline" />
      </section>

      <section className="dashboard-content-grid">
        <article className="panel review-panel">
          <div className="panel-head premium-panel-head">
            <div><span className="panel-kicker">Approval desk</span><h2>Review queue</h2><p>Every outbound application remains yours to approve.</p></div>
            <span className="review-lock"><ShieldCheck size={14} /> Human controlled</span>
          </div>
          <div className="item-list">
            {reviewItems.length === 0 && (
              <div className="empty-state premium-empty-state">
                <span><CheckCircle2 size={23} /></span>
                <div><strong>Nothing waiting on you</strong><p>Queue promising roles from the job feed when you are ready.</p></div>
                <Link className="button button-quiet" to="/jobs">Find a role</Link>
              </div>
            )}
            {reviewItems.map((app, index) => (
              <motion.div
                className="application-row"
                key={app.id}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <span className="company-monogram">{(app.job?.company || 'J').slice(0, 1).toUpperCase()}</span>
                <div><strong>{app.job?.title || 'Unknown role'}</strong><span>{app.job?.company || 'Unknown company'} · {app.channel}</span></div>
                <StatusBadge status={app.status} />
                {app.status === 'pending_review' ? (
                  <button className="button button-secondary" disabled={busyId === app.id} onClick={() => approve(app.id)}>Approve</button>
                ) : (
                  <button className="button button-primary" disabled={busyId === app.id} onClick={() => send(app)}><Send size={15} /> Send</button>
                )}
              </motion.div>
            ))}
          </div>
        </article>

        <div className="dashboard-side-stack">
          <article className="panel resume-card-premium">
            <div className="panel-head premium-panel-head"><div><span className="panel-kicker">Career asset</span><h2>Current CV</h2></div><span className="panel-icon"><FileText size={18} /></span></div>
            {summary?.latestResume ? (
              <div className="resume-summary">
                <strong>{summary.latestResume.profile?.name || summary.latestResume.fileName}</strong>
                <p>{summary.latestResume.profile?.summary || 'Resume parsed and saved.'}</p>
                <div className="tag-row">{(summary.latestResume.profile?.skills || []).slice(0, 6).map(skill => <span key={skill}>{skill}</span>)}</div>
                <div className="dashboard-cv-actions">
                  <Link className="button button-secondary" to="/resume"><FileUp size={15} /> Replace CV from device</Link>
                  <Link className="text-link" to="/profile">Edit public CV page <ArrowRight size={14} /></Link>
                </div>
              </div>
            ) : (
              <div className="empty-state"><p>Upload a CV from your device to unlock match scores and ATS guidance.</p><Link className="button button-primary" to="/resume"><FileUp size={15} /> Upload CV from device</Link></div>
            )}
          </article>

          <article className="panel intelligence-card">
            <span className="panel-icon accent"><TrendingUp size={18} /></span>
            <div><span className="panel-kicker">Career intelligence</span><h2>{summary?.averageMatch ? `${summary.averageMatch}% average role match` : 'Build your signal'}</h2></div>
            <p>{summary?.averageMatch ? 'Career Lab can show which skills are holding back your strongest applications.' : 'Add a resume and target roles to unlock evidence-based career guidance.'}</p>
            <Link className="text-link" to="/career-lab">View intelligence <ArrowRight size={14} /></Link>
          </article>
        </div>
      </section>
    </div>
  )
}
