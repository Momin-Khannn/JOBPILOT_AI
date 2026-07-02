import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, useOutletContext } from 'react-router-dom'
import { AlertCircle, BadgeDollarSign, CalendarPlus, Gauge, KanbanSquare, MessageSquareText, Send, ShieldAlert, Sparkles, Table2 } from 'lucide-react'
import { api } from '../api/client.js'
import ApplicationInsight from '../components/ApplicationInsight.jsx'
import CareerMoveWorkspace from '../components/CareerMoveWorkspace.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

const pipelineGroups = [
  { id: 'review', label: 'Needs review', helper: 'New opportunities', statuses: ['pending_review'] },
  { id: 'ready', label: 'Ready to send', helper: 'Human-approved', statuses: ['approved'] },
  { id: 'sent', label: 'Sent', helper: 'Waiting for response', statuses: ['applied', 'viewed', 'sent_demo'] },
  { id: 'progress', label: 'In progress', helper: 'Shortlists, interviews and offers', statuses: ['shortlisted', 'interview', 'offer'] },
  { id: 'hired', label: 'Hired', helper: 'Confirmed outcomes', statuses: ['hired'] },
  { id: 'attention', label: 'Needs attention', helper: 'Follow-ups and outcomes', statuses: ['follow_up_needed', 'rejected', 'job_closed'] },
]

const sortOptions = [
  ['updated_desc', 'Recently updated'],
  ['ats_desc', 'ATS score: high to low'],
  ['match_desc', 'Match score: high to low'],
  ['risk_desc', 'Risk: high to low'],
  ['risk_asc', 'Risk: low to high'],
]

const riskWeight = { low: 1, medium: 2, high: 3, critical: 4 }

export default function Applications() {
  const [applications, setApplications] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [view, setView] = useState('kanban')
  const [sortBy, setSortBy] = useState('updated_desc')
  const [groupFilter, setGroupFilter] = useState('all')
  const [careerMove, setCareerMove] = useState(null)
  const reduceMotion = useReducedMotion()
  const { user } = useOutletContext() || {}

  async function load() {
    const data = await api.applications()
    setApplications(data.applications)
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

  const sortedApplications = useMemo(() => [...applications].sort((a, b) => {
    if (sortBy === 'ats_desc') return Number(b.resumeTailoring?.atsScoreAfter || b.decisionReport?.match?.atsScore || b.atsScore || 0) - Number(a.resumeTailoring?.atsScoreAfter || a.decisionReport?.match?.atsScore || a.atsScore || 0)
    if (sortBy === 'match_desc') return Number(b.matchScore || 0) - Number(a.matchScore || 0)
    if (sortBy === 'risk_desc' || sortBy === 'risk_asc') {
      const difference = (riskWeight[String(a.risk?.riskLevel || '').toLowerCase()] || 0) - (riskWeight[String(b.risk?.riskLevel || '').toLowerCase()] || 0)
      return sortBy === 'risk_desc' ? -difference : difference
    }
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  }), [applications, sortBy])

  const visibleGroups = groupFilter === 'all' ? pipelineGroups : pipelineGroups.filter(group => group.id === groupFilter)
  const visibleStatuses = useMemo(() => new Set(visibleGroups.flatMap(group => group.statuses)), [visibleGroups])
  const visibleApplications = useMemo(() => sortedApplications.filter(app => visibleStatuses.has(app.status)), [sortedApplications, visibleStatuses])
  const selectedApplication = careerMove ? applications.find(app => app.id === careerMove.applicationId) : null
  const careerMoveQueue = useMemo(() => applications.flatMap(app => {
    const moves = []
    const ghostingOpen = app.agentSignals?.ghosting?.eligible || (app.ghostingResolution && !['sent', 'sent_demo'].includes(app.ghostingResolution.status))
    if (ghostingOpen) moves.push({ application: app, mode: 'ghosting' })
    if (app.status === 'offer' || (app.negotiation && !['sent', 'sent_demo'].includes(app.negotiation.status))) moves.push({ application: app, mode: 'negotiation' })
    return moves
  }), [applications])

  async function approve(id) {
    setBusyId(id)
    try {
      await api.approveApplication(id)
      await load()
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  async function send(app) {
    setBusyId(app.id)
    try {
      if (app.channel === 'whatsapp') await api.sendWhatsApp(app.id)
      else await api.sendGmail(app.id)
      await load()
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  async function schedule(app) {
    setBusyId(app.id)
    try {
      await api.scheduleFollowUp(app.id, 5)
      await load()
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  function renderActions(app) {
    if (app.channel === 'jobpilot' || app.sourceType === 'direct') {
      return <div className="action-row"><Link className="button button-secondary" to="/messages"><MessageSquareText size={15} /> Message employer</Link></div>
    }
    return (
      <div className="action-row">
        {app.status === 'pending_review' && (
          <button className="button button-secondary" disabled={busyId === app.id} onClick={() => approve(app.id)}>Approve</button>
        )}
        {app.status === 'approved' && (
          <button className="button button-primary" disabled={busyId === app.id} onClick={() => send(app)}>
            <Send size={15} /> Send
          </button>
        )}
        {['applied', 'sent_demo', 'follow_up_needed'].includes(app.status) && (
          <button className="button button-secondary" disabled={busyId === app.id} onClick={() => schedule(app)}>
            <CalendarPlus size={15} /> Follow-up
          </button>
        )}
        {(app.agentSignals?.ghosting?.eligible || app.ghostingResolution) && (
          <button className="button button-secondary" onClick={() => setCareerMove({ applicationId: app.id, mode: 'ghosting' })}>
            <MessageSquareText size={15} /> Resolve silence
          </button>
        )}
        {(app.status === 'offer' || app.negotiation) && (
          <button className="button button-secondary" onClick={() => setCareerMove({ applicationId: app.id, mode: 'negotiation' })}>
            <BadgeDollarSign size={15} /> Negotiate
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Audit trail</span>
          <h1>Applications</h1>
          <p>Every application now carries a decision report, scam-risk check, resume tailoring, and interview prep.</p>
        </div>
        <div className="segmented">
          <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}><KanbanSquare size={15} /> Board</button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><Table2 size={15} /> Table</button>
        </div>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

      <section className="career-move-queue" aria-label="Career moves requiring review">
        <div className="career-move-queue-copy">
          <span><Sparkles size={16} /></span>
          <div><h2>Career moves</h2><p>JobPilot prepares the next move; you approve every message.</p></div>
        </div>
        {careerMoveQueue.length ? (
          <div className="career-move-queue-items">
            {careerMoveQueue.slice(0, 4).map(({ application, mode }) => (
              <button key={`${application.id}-${mode}`} onClick={() => setCareerMove({ applicationId: application.id, mode })}>
                {mode === 'ghosting' ? <MessageSquareText size={16} /> : <BadgeDollarSign size={16} />}
                <span><strong>{mode === 'ghosting' ? `${application.agentSignals?.ghosting?.daysWaiting || 0} days quiet` : 'Offer ready'}</strong><small>{application.job?.company} · {application.job?.title}</small></span>
              </button>
            ))}
          </div>
        ) : (
          <p className="career-move-clear"><ShieldAlert size={15} /> No stalled conversations or offers need action.</p>
        )}
      </section>

      <AnimatePresence initial={false}>
        {selectedApplication && (
          <motion.div
            key={`${careerMove.applicationId}-${careerMove.mode}`}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
          <CareerMoveWorkspace
            application={selectedApplication}
            mode={careerMove.mode}
            isPro={user?.tier === 'pro'}
            preferences={user?.preferences || {}}
            onClose={() => setCareerMove(null)}
            onRefresh={load}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <section className="pipeline-toolbar" aria-label="Application ordering and categories">
        <label>
          Show category
          <select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}>
            <option value="all">All pipeline categories</option>
            {pipelineGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
        </label>
        <label>
          Order by
          <select value={sortBy} onChange={event => setSortBy(event.target.value)}>
            {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="pipeline-summary">
          <span><Gauge size={16} />{applications.length} tracked</span>
          <span><ShieldAlert size={16} />{applications.filter(app => ['high', 'critical'].includes(String(app.risk?.riskLevel || '').toLowerCase())).length} high risk</span>
        </div>
      </section>

      <AnimatePresence mode="wait" initial={false}>
      {view === 'kanban' ? (
        <motion.section
          className="kanban-board"
          key="kanban"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
          transition={{ duration: 0.24 }}
        >
          {visibleGroups.map(group => {
            const items = sortedApplications.filter(app => group.statuses.includes(app.status))
            return (
              <motion.div className={`kanban-column kanban-column-${group.id}`} layout={!reduceMotion} key={group.id}>
                <header className="kanban-column-heading"><div><h2>{group.label}</h2><p>{group.helper}</p></div><span>{items.length}</span></header>
                <div className="kanban-list">
                  {items.map((app, index) => (
                    <motion.article
                      className="kanban-card"
                      layout={!reduceMotion}
                      key={app.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: Math.min(index * 0.035, 0.18) }}
                    >
                      <div className="kanban-card-head">
                        <div>
                          <strong>{app.job?.title || 'Unknown role'}</strong>
                          <span>{app.job?.company || 'Unknown company'}</span>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="application-metrics">
                        <span><small>Match</small><strong>{app.matchScore ?? '--'}%</strong></span>
                        <span><small>ATS</small><strong>{app.resumeTailoring?.atsScoreAfter ?? app.decisionReport?.match?.atsScore ?? '--'}%</strong></span>
                        <span className={`risk-metric risk-${String(app.risk?.riskLevel || 'unknown').toLowerCase()}`}><small>Risk</small><strong>{app.risk?.riskLevel || 'Unknown'}</strong></span>
                      </div>
                      <div className="application-card-meta"><span>{app.channel}</span><span>{app.job?.deadlineStatus === 'closing_soon' ? 'Closing soon' : app.job?.deadlineStatus || 'Deadline unknown'}</span></div>
                      <ApplicationInsight application={app} />
                      {renderActions(app)}
                    </motion.article>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </motion.section>
      ) : (
        <motion.section
          className="panel table-panel"
          key="table"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
          transition={{ duration: 0.24 }}
        >
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Channel</th>
                  <th>Match</th>
                  <th>Risk</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleApplications.map(app => (
                  <tr key={app.id}>
                    <td>{app.job?.company || '--'}</td>
                    <td>{app.job?.title || '--'}</td>
                    <td>{app.job?.type || '--'}</td>
                    <td>{app.channel}</td>
                    <td>{app.matchScore ?? '--'}%</td>
                    <td>{app.risk?.riskLevel || '--'}</td>
                    <td>{app.job?.deadlineStatus || '--'}</td>
                    <td><StatusBadge status={app.status} /></td>
                    <td>{renderActions(app)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visibleApplications.length && <p className="muted">No applications in this category yet.</p>}
        </motion.section>
      )}
      </AnimatePresence>
    </div>
  )
}
