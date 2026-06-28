import { useOutletContext } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'

export default function ApplicationsPage() {
  const { overview } = useOutletContext()
  const applications = overview?.applications || []

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Applications</span>
          <h1>Platform application traffic</h1>
          <p>See what clients are queueing, approving, and sending across the platform.</p>
        </div>
      </section>

      <section className="panel">
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
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
