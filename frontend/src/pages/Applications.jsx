import { useEffect, useState } from 'react'
import { AlertCircle, CalendarPlus, KanbanSquare, Send, Table2 } from 'lucide-react'
import { api } from '../api/client.js'
import ApplicationInsight from '../components/ApplicationInsight.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

const columns = [
  ['pending_review', 'Review'],
  ['approved', 'Approved'],
  ['applied', 'Applied'],
  ['sent_demo', 'Demo sent'],
  ['interview', 'Interview'],
  ['offer', 'Offer'],
  ['rejected', 'Rejected'],
  ['follow_up_needed', 'Follow up'],
]

export default function Applications() {
  const [applications, setApplications] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [view, setView] = useState('kanban')

  async function load() {
    const data = await api.applications()
    setApplications(data.applications)
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

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

      {view === 'kanban' ? (
        <section className="kanban-board">
          {columns.map(([status, label]) => {
            const items = applications.filter(app => app.status === status)
            return (
              <div className="kanban-column" key={status}>
                <h2>{label} <span>{items.length}</span></h2>
                <div className="kanban-list">
                  {items.map(app => (
                    <article className="kanban-card" key={app.id}>
                      <div className="kanban-card-head">
                        <div>
                          <strong>{app.job.title}</strong>
                          <span>{app.job.company} · {app.channel}</span>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="score-strip">
                        <b>Match {app.matchScore ?? '--'}%</b>
                        <b>Risk {app.risk?.riskLevel || 'n/a'}</b>
                        <b>{app.recommendation || 'Review'}</b>
                      </div>
                      <ApplicationInsight application={app} />
                      {renderActions(app)}
                    </article>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      ) : (
        <section className="panel table-panel">
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
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id}>
                    <td>{app.job.company}</td>
                    <td>{app.job.title}</td>
                    <td>{app.job.type}</td>
                    <td>{app.channel}</td>
                    <td>{app.matchScore ?? '--'}%</td>
                    <td>{app.risk?.riskLevel || '--'}</td>
                    <td><StatusBadge status={app.status} /></td>
                    <td>{renderActions(app)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!applications.length && <p className="muted">No applications queued yet.</p>}
        </section>
      )}
    </div>
  )
}
