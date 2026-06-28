import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Ban, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client.js'
import StatusBadge from '../components/StatusBadge.jsx'

export default function UsersPage() {
  const { overview, refreshOverview, setError } = useOutletContext()
  const [busyId, setBusyId] = useState('')
  const users = (overview?.users || []).filter(user => user.role === 'client')

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
      <section className="page-heading">
        <div>
          <span className="eyebrow">Users</span>
          <h1>Client workspaces</h1>
          <p>Manage client account status without exposing owner controls in the client-facing product.</p>
        </div>
      </section>

      <section className="panel">
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
                    <button className="button button-secondary" disabled={busyId === user.id} onClick={() => toggleUser(user)}>
                      {user.status === 'active' ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                      {user.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
