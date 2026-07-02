import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Search } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function ApplicationsPage() {
  const { overview } = useOutletContext()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const allApplications = overview?.applications || []
  const statuses = [...new Set(allApplications.map(application => application.status).filter(Boolean))]
  const normalizedQuery = query.trim().toLowerCase()
  const applications = allApplications.filter(application => {
    const matchesStatus = statusFilter === 'all' || application.status === statusFilter
    const matchesQuery = !normalizedQuery || [application.user?.email, application.job?.company, application.job?.title, application.channel]
      .some(value => String(value || '').toLowerCase().includes(normalizedQuery))
    return matchesStatus && matchesQuery
  })

  return (
    <div className="stack">
      <PageHeader title="Application traffic" description="Inspect applications moving through client workspaces and delivery channels." meta={`${allApplications.length} total`} />

      <section className="panel data-panel">
        <div className="table-toolbar">
          <div><h2>Pipeline</h2><p>{applications.length} visible records</p></div>
          <div className="table-filters">
            <label className="search-field"><Search size={16} /><span className="sr-only">Search applications</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search client, company, or role" /></label>
            <label className="select-field"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Company</th>
                <th>Role</th>
                <th>Channel</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td>{application.user?.email || '--'}</td>
                  <td>{application.job?.company || '--'}</td>
                  <td>{application.job?.title || '--'}</td>
                  <td>{application.channel || '--'}</td>
                  <td>{application.job?.deadlineStatus || '--'}</td>
                  <td><StatusBadge status={application.status} /></td>
                  <td>{application.createdAt ? new Date(application.createdAt).toLocaleString() : '--'}</td>
                </tr>
              ))}
              {!applications.length && <tr><td colSpan="7"><div className="empty-state">No applications match the current filters.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
