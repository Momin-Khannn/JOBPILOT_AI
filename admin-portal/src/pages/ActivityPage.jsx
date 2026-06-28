import { useOutletContext } from 'react-router-dom'

export default function ActivityPage() {
  const { overview } = useOutletContext()
  const logs = overview?.auditLogs || []
  const sessions = overview?.sessions || []
  const supportTickets = overview?.supportTickets || []
  const analytics = overview?.analytics || {}

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Activity</span>
          <h1>Sessions and audit trail</h1>
          <p>Owner-side operational visibility for support, monitoring, and review.</p>
        </div>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Active sessions</h2>
              <p>Open signed-in sessions currently stored by the backend.</p>
            </div>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>User</th>
                  <th>Created</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.id.slice(0, 8)}</td>
                    <td>{session.userId}</td>
                    <td>{session.createdAt ? new Date(session.createdAt).toLocaleString() : '--'}</td>
                    <td>{session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Audit log</h2>
              <p>Recent system actions captured for owner review.</p>
            </div>
          </div>
          <div className="activity-list">
            {logs.map((log) => (
              <div key={log.id} className="activity-item">
                <strong>{log.action}</strong>
                <small>{new Date(log.createdAt).toLocaleString()}</small>
                <span>{JSON.stringify(log.details)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Support queue</h2>
              <p>Latest support requests and bug reports submitted from the public form.</p>
            </div>
          </div>
          <div className="activity-list">
            {supportTickets.slice(0, 10).map((ticket) => (
              <div key={ticket.id} className="activity-item">
                <strong>{ticket.type}: {ticket.subject}</strong>
                <small>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '--'} · {ticket.email || 'no reply email'}</small>
                <span>{ticket.message}</span>
              </div>
            ))}
            {!supportTickets.length && <p className="muted">No support tickets yet.</p>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Analytics signal</h2>
              <p>Recent consented page and product events.</p>
            </div>
          </div>
          <div className="activity-list">
            {[...(analytics.recentPageViews || []), ...(analytics.recentEvents || [])].slice(0, 10).map((event) => (
              <div key={event.id} className="activity-item">
                <strong>{event.name}</strong>
                <small>{event.createdAt ? new Date(event.createdAt).toLocaleString() : '--'}</small>
                <span>{event.path || JSON.stringify(event.properties || {})}</span>
              </div>
            ))}
            {!(analytics.recentPageViews || []).length && !(analytics.recentEvents || []).length && <p className="muted">No analytics events yet.</p>}
          </div>
        </article>
      </section>
    </div>
  )
}
