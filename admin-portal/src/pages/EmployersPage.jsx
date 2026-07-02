import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BadgeCheck, Ban, Building2, Check, Flag, ShieldAlert, X } from 'lucide-react'
import { api } from '../api/client.js'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function EmployersPage() {
  const { overview, refreshOverview, setError } = useOutletContext()
  const [busyId, setBusyId] = useState('')
  const companies = overview?.companies || []
  const requests = overview?.employerAccessRequests || []
  const reports = overview?.marketplaceReports || []
  const companyById = useMemo(() => new Map(companies.map(company => [company.id, company])), [companies])

  async function review(request, status) {
    const label = status === 'verified' ? 'approve and publish this employer’s pending jobs' : `${status} this employer`
    if (!window.confirm(`Are you sure you want to ${label}?`)) return
    setBusyId(request.id)
    try {
      await api.adminReviewEmployer(request.id, { status })
      await refreshOverview()
      setError('')
    } catch (err) { setError(err.message) } finally { setBusyId('') }
  }

  async function reviewReport(report, status) {
    setBusyId(report.id)
    try {
      await api.adminReviewMarketplaceReport(report.id, { status })
      await refreshOverview()
      setError('')
    } catch (err) { setError(err.message) } finally { setBusyId('') }
  }

  return (
    <div className="stack">
      <PageHeader title="Employer trust" description="Verify businesses before their first role goes live, and resolve marketplace safety reports." meta={`${requests.filter(item => item.status === 'pending').length} awaiting review`} />

      <section className="moderation-summary">
        <article><Building2 size={19} /><span><strong>{companies.length}</strong><small>Companies</small></span></article>
        <article><BadgeCheck size={19} /><span><strong>{companies.filter(item => item.status === 'verified').length}</strong><small>Verified</small></span></article>
        <article><ShieldAlert size={19} /><span><strong>{requests.filter(item => item.status === 'pending').length}</strong><small>Pending</small></span></article>
        <article><Flag size={19} /><span><strong>{reports.filter(item => ['open', 'reviewing'].includes(item.status)).length}</strong><small>Open reports</small></span></article>
      </section>

      <section className="panel table-panel">
        <div className="panel-head"><div><h2>Employer access requests</h2><p>Approve only when the business domain and company details are credible.</p></div></div>
        <div className="responsive-table"><table><thead><tr><th>Company</th><th>Domain</th><th>Requester</th><th>Status</th><th>Submitted</th><th>Decision</th></tr></thead><tbody>
          {requests.map(request => {
            const company = companyById.get(request.companyId) || {}
            return <tr key={request.id}>
              <td><strong>{company.name || request.companyName || 'Unknown company'}</strong></td>
              <td>{company.domain || request.domain || '--'}</td>
              <td>{request.businessEmail || request.email || company.contactEmail || '--'}</td>
              <td><StatusBadge status={request.status} /></td>
              <td>{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '--'}</td>
              <td><div className="table-actions">
                <button className="button button-primary" disabled={busyId === request.id || request.status === 'verified'} onClick={() => review(request, 'verified')}><Check size={14} /> Approve</button>
                <button className="button button-quiet" disabled={busyId === request.id} onClick={() => review(request, 'rejected')}><X size={14} /> Reject</button>
                <button className="button button-danger-quiet" disabled={busyId === request.id} onClick={() => review(request, 'suspended')}><Ban size={14} /> Suspend</button>
              </div></td>
            </tr>
          })}
          {!requests.length && <tr><td colSpan="6">No employer access requests yet.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel table-panel">
        <div className="panel-head"><div><h2>Safety reports</h2><p>Review reports from job-linked conversations and record the outcome.</p></div></div>
        <div className="responsive-table"><table><thead><tr><th>Reason</th><th>Detail</th><th>Status</th><th>Reported</th><th>Action</th></tr></thead><tbody>
          {reports.map(report => <tr key={report.id}>
            <td>{report.reason}</td><td>{report.detail || 'No additional detail'}</td><td><StatusBadge status={report.status} /></td><td>{new Date(report.createdAt).toLocaleString()}</td>
            <td><div className="table-actions"><button className="button button-secondary" disabled={busyId === report.id} onClick={() => reviewReport(report, 'reviewing')}>Reviewing</button><button className="button button-primary" disabled={busyId === report.id} onClick={() => reviewReport(report, 'resolved')}>Resolve</button><button className="button button-quiet" disabled={busyId === report.id} onClick={() => reviewReport(report, 'dismissed')}>Dismiss</button></div></td>
          </tr>)}
          {!reports.length && <tr><td colSpan="5">No marketplace reports. That is the good kind of quiet.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  )
}
