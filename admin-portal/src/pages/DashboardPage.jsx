import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../api/client.js'
import MetricCard from '../components/MetricCard.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function DashboardPage() {
  const { overview, refreshOverview, setError } = useOutletContext()
  const [syncing, setSyncing] = useState(false)
  const summary = overview?.summary || {}
  const recentUsers = summary.recentUsers || []
  const recentLogs = overview?.auditLogs || []
  const providers = Object.values(overview?.providerStatus || {})
  const lastRun = overview?.jobSyncRuns?.[0]

  async function syncJobs() {
    setSyncing(true)
    try {
      await api.syncJobs({ query: 'software engineer', location: 'remote' })
      await refreshOverview()
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Operations overview"
        description="Platform health, client activity, and delivery infrastructure in one working view."
        meta={overview ? 'Live data' : 'Connecting'}
        actions={<button className="button button-secondary" onClick={syncJobs} disabled={syncing}>
          <RefreshCw size={15} />
          {syncing ? 'Syncing...' : 'Sync jobs'}
        </button>}
      />

      <section className="metrics-grid">
        <MetricCard label="Client users" value={summary.totalUsers ?? 0} detail="Registered accounts" />
        <MetricCard label="Active users" value={summary.activeUsers ?? 0} detail="Can sign in" />
        <MetricCard label="Applications" value={summary.totalApplications ?? 0} detail="Across all workspaces" />
        <MetricCard label="Employers" value={summary.employerUsers ?? 0} detail={`${summary.verifiedCompanies ?? 0} verified companies`} />
        <MetricCard label="Pending employers" value={summary.pendingEmployers ?? 0} detail="Awaiting owner review" />
        <MetricCard label="Direct jobs" value={summary.directJobs ?? 0} detail="JobPilot marketplace roles" />
        <MetricCard label="Safety reports" value={summary.openMarketplaceReports ?? 0} detail="Open marketplace cases" />
        <MetricCard label="Follow-ups" value={summary.totalFollowUps ?? 0} detail="Tracked follow-up items" />
        <MetricCard label="Support" value={summary.totalSupportTickets ?? 0} detail="Tickets and bug reports" />
        <MetricCard label="Analytics" value={summary.totalAnalyticsEvents ?? 0} detail="Consented events" />
        <MetricCard label="Open jobs" value={summary.openJobs ?? 0} detail="Live market cache" />
        <MetricCard label="Expired jobs" value={summary.expiredJobs ?? 0} detail="Closed or deadline passed" />
      </section>

      <section className="dashboard-grid">
        <article className="panel provider-panel">
          <div className="panel-head">
            <div>
              <h2>Job provider health</h2>
              <p>Last sync: {lastRun?.createdAt ? new Date(lastRun.createdAt).toLocaleString() : 'Not synced yet'}</p>
            </div>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Imported</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.provider}>
                    <td>{provider.provider}</td>
                    <td><StatusBadge status={provider.ok ? 'active' : 'suspended'} /></td>
                    <td>{provider.imported ?? 0}</td>
                    <td>{provider.error || provider.message || 'Ready'}</td>
                  </tr>
                ))}
                {!providers.length && (
                  <tr>
                    <td colSpan="4">No provider sync has run yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel accounts-panel">
          <div className="panel-head">
            <div>
              <h2>Recent client accounts</h2>
              <p>Newest client workspaces created in the platform.</p>
            </div>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td><StatusBadge status={user.status} /></td>
                    <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-head">
            <div>
              <h2>Latest activity</h2>
              <p>Most recent changes recorded by the platform.</p>
            </div>
          </div>
          <div className="activity-list">
            {recentLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="activity-item">
                <strong>{log.action}</strong>
                <small>{new Date(log.createdAt).toLocaleString()}</small>
                <span>{JSON.stringify(log.details)}</span>
              </div>
            ))}
            {!recentLogs.length && <div className="empty-state">No platform activity has been recorded yet.</div>}
          </div>
        </article>
      </section>
    </div>
  )
}
