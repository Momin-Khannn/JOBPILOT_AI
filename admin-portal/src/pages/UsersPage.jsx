import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Ban, CheckCircle2, Search } from 'lucide-react'
import { api } from '../api/client.js'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function UsersPage() {
  const { overview, refreshOverview, setError } = useOutletContext()
  const [busyId, setBusyId] = useState('')
  const [query, setQuery] = useState('')
  const allUsers = (overview?.users || []).filter(user => user.role === 'client')
  const normalizedQuery = query.trim().toLowerCase()
  const users = allUsers.filter(user => !normalizedQuery || [user.name, user.email, user.status].some(value => String(value || '').toLowerCase().includes(normalizedQuery)))

  async function toggleUser(targetUser) {
    setBusyId(targetUser.id)
    try {
      await api.adminUpdateUser(targetUser.id, {
        status: targetUser.status === 'active' ? 'suspended' : 'active',
      })
      setError('')
      await refreshOverview()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Client workspaces" description="Review account access, sign-in recency, and workspace status." meta={`${allUsers.length} clients`} />

      <section className="panel data-panel">
        <div className="table-toolbar">
          <div><h2>Accounts</h2><p>{users.length === allUsers.length ? 'All client workspaces' : `${users.length} matching workspaces`}</p></div>
          <label className="search-field"><Search size={16} /><span className="sr-only">Search client accounts</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email, or status" /></label>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td><StatusBadge status={user.status} /></td>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '--'}</td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '--'}</td>
                  <td>
                    <button className={`button ${user.status === 'active' ? 'button-danger-quiet' : 'button-secondary'}`} disabled={busyId === user.id} onClick={() => toggleUser(user)}>
                      {user.status === 'active' ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                      {user.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan="6"><div className="empty-state">No client workspaces match this search.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
