import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'

export default function ActivityPage() {
  const { overview } = useOutletContext()
  const logs = overview?.auditLogs || []
  const sessions = overview?.sessions || []
  const supportTickets = overview?.supportTickets || []
  const analytics = overview?.analytics || {}
  const analyticsEvents = [...(analytics.recentPageViews || []), ...(analytics.recentEvents || [])]
  const [activeView, setActiveView] = useState('audit')
  const views = [
    { id: 'audit', label: 'Audit log', count: logs.length },
    { id: 'sessions', label: 'Sessions', count: sessions.length },
    { id: 'support', label: 'Support', count: supportTickets.length },
    { id: 'analytics', label: 'Analytics', count: analyticsEvents.length },
  ]

  return (
    <div className="stack">
      <PageHeader
        title="Activity and audit"
        description="Trace platform changes, active sessions, support requests, and consented events."
        meta={`${logs.length + sessions.length} signals`}
      />

      <section className="activity-workspace">
        <div className="activity-tabs" role="tablist" aria-label="Activity views">
          {views.map(view => (
            <button
              key={view.id}
              role="tab"
              aria-selected={activeView === view.id}
              className={activeView === view.id ? 'active' : ''}
              onClick={() => setActiveView(view.id)}
            >
              <span>{view.label}</span>
              <strong>{view.count}</strong>
            </button>
          ))}
        </div>

        <article className="panel activity-console">
          {activeView === 'sessions' && (
            <>
              <div className="panel-head"><div><h2>Active sessions</h2><p>Open signed-in sessions currently stored by the backend.</p></div></div>
              <div className="responsive-table">
                <table>
                  <thead><tr><th>Session</th><th>User</th><th>Created</th><th>Last seen</th></tr></thead>
                  <tbody>
                    {sessions.map(session => <tr key={session.id}><td><code>{session.id.slice(0, 8)}</code></td><td>{session.userId}</td><td>{session.createdAt ? new Date(session.createdAt).toLocaleString() : '--'}</td><td>{session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : '--'}</td></tr>)}
                    {!sessions.length && <tr><td colSpan="4"><div className="empty-state">No active sessions are stored.</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeView === 'audit' && (
            <>
              <div className="panel-head"><div><h2>Audit log</h2><p>Recent system actions captured for owner review.</p></div></div>
              <div className="activity-list">
                {logs.map(log => <div key={log.id} className="activity-item"><div><strong>{log.action}</strong><small>{new Date(log.createdAt).toLocaleString()}</small></div><code>{JSON.stringify(log.details)}</code></div>)}
                {!logs.length && <div className="empty-state">No audit activity has been recorded yet.</div>}
              </div>
            </>
          )}

          {activeView === 'support' && (
            <>
              <div className="panel-head"><div><h2>Support queue</h2><p>Requests and bug reports submitted from the public form.</p></div></div>
              <div className="activity-list">
                {supportTickets.slice(0, 20).map(ticket => <div key={ticket.id} className="activity-item"><div><strong>{ticket.type}: {ticket.subject}</strong><small>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '--'} | {ticket.email || 'No reply email'}</small></div><span>{ticket.message}</span></div>)}
                {!supportTickets.length && <div className="empty-state">No support tickets are waiting.</div>}
              </div>
            </>
          )}

          {activeView === 'analytics' && (
            <>
              <div className="panel-head"><div><h2>Analytics signal</h2><p>Recent consented page and product events.</p></div></div>
              <div className="activity-list">
                {analyticsEvents.slice(0, 20).map(event => <div key={event.id} className="activity-item"><div><strong>{event.name}</strong><small>{event.createdAt ? new Date(event.createdAt).toLocaleString() : '--'}</small></div><code>{event.path || JSON.stringify(event.properties || {})}</code></div>)}
                {!analyticsEvents.length && <div className="empty-state">No consented analytics events are available.</div>}
              </div>
            </>
          )}
        </article>
      </section>
    </div>
  )
}
