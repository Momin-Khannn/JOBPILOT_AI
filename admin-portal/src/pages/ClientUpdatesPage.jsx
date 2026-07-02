import { useEffect, useState } from 'react'
import { AlertCircle, Bot, ExternalLink, MailCheck, RefreshCw, Send } from 'lucide-react'
import { api } from '../api/client.js'
import PageHeader from '../components/PageHeader.jsx'

const initialForm = {
  title: '',
  summary: '',
  changes: '',
  actionUrl: '',
  activeSessionOnly: false,
  personalize: true,
  force: false,
}

export default function ClientUpdatesPage() {
  const [status, setStatus] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const payload = await api.clientUpdateStatus()
    setStatus(payload)
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

  async function testMailbox() {
    setBusy('test')
    try {
      const payload = await api.testClientUpdateMailbox()
      setStatus(payload)
      setMessage('Business Gmail connection verified.')
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function connectBusinessGmail() {
    setBusy('connect')
    try {
      const payload = await api.gmailAuthUrl()
      window.location.assign(payload.url)
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  async function sendUpdate(event) {
    event.preventDefault()
    setBusy('send')
    try {
      const result = await api.sendClientUpdate({
        ...form,
        changes: form.changes.split('\n').map(item => item.trim()).filter(Boolean),
      })
      await load()
      setForm(initialForm)
      setMessage(`Update sent to ${result.sent} client${result.sent === 1 ? '' : 's'}. ${result.skipped} skipped, ${result.failed.length} failed.`)
      setError(result.failed[0]?.error || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function scanSoftwareUpdates() {
    setBusy('scan')
    try {
      const result = await api.scanSoftwareUpdates({ force: false })
      await load()
      if (result.status === 'sent') {
        setMessage(`Software update email sent to ${result.result.sent} client${result.result.sent === 1 ? '' : 's'}.`)
      } else if (result.status === 'skipped') {
        setMessage(result.reason === 'no_client_facing_changes'
          ? 'No new client-facing UI or feature changes need an email.'
          : 'This release was already announced. No duplicate email was sent.')
      } else if (result.reason === 'waiting_for_digest_window') {
        setMessage(`New changes are queued for the next digest${result.nextAllowedAt ? ` after ${new Date(result.nextAllowedAt).toLocaleTimeString()}` : ''}.`)
      } else if (result.reason === 'waiting_for_quiet_period') {
        setMessage('New client-facing changes were found. The agent is waiting for editing to settle before sending one digest.')
      } else {
        setMessage(`Software scan finished: ${result.reason || result.status}.`)
      }
      setError(result.result?.failed?.[0]?.error || result.error || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function refreshPortals() {
    setBusy('portals')
    try {
      await api.refreshPortals()
      await load()
      setMessage('Owner and client portal links refreshed.')
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const softwareAgent = status?.softwareChangeAgent
  const portalAgent = status?.portalUpdateAgent
  const portalState = portalAgent?.portalUpdateState

  return (
    <div className="stack">
      <PageHeader title="Client update agent" description="Operate release emails, recipient eligibility, Gmail delivery, and portal links." meta={softwareAgent?.enabled ? 'Automation on' : 'Manual mode'} />

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
      {message && <div className="success"><MailCheck size={18} />{message}</div>}

      <section className="update-workspace">
        <article className="panel agent-panel">
          <div className="panel-head">
            <div>
              <h2>Agent status</h2>
              <p>{status?.agentName || 'Client Update Agent'}</p>
            </div>
            <Bot size={26} />
          </div>
          <div className="agent-status-grid">
            <div><span>Mailbox</span><strong>{status?.mailbox?.configured ? 'Configured' : 'Missing'}</strong></div>
            <div><span>Delivery route</span><strong>{status?.mailbox?.gmailConnected ? 'Gmail API' : 'SMTP fallback'}</strong></div>
            <div><span>SMTP user</span><strong>{status?.mailbox?.user || '--'}</strong></div>
            <div><span>Eligible clients</span><strong>{status?.eligibleClients ?? 0}</strong></div>
            <div><span>Active sessions</span><strong>{status?.activeEligibleClients ?? 0}</strong></div>
            <div><span>Total sent</span><strong>{status?.totalSent ?? 0}</strong></div>
            <div><span>Last sent</span><strong>{status?.lastSentAt ? new Date(status.lastSentAt).toLocaleString() : '--'}</strong></div>
            <div><span>Auto software emails</span><strong>{softwareAgent?.enabled ? 'Enabled' : 'Disabled'}</strong></div>
            <div><span>Launch progress</span><strong>{softwareAgent?.launchProgress ? `${softwareAgent.launchProgress.percent}%` : '--'}</strong></div>
            <div><span>Last auto update</span><strong>{softwareAgent?.lastSoftwareUpdateAt ? new Date(softwareAgent.lastSoftwareUpdateAt).toLocaleString() : '--'}</strong></div>
            <div><span>Last scan</span><strong>{softwareAgent?.lastScanAt ? new Date(softwareAgent.lastScanAt).toLocaleString() : '--'}</strong></div>
            <div><span>Digest window</span><strong>{softwareAgent?.minDigestIntervalMs ? `${Math.round(softwareAgent.minDigestIntervalMs / 60000)} min` : 'Immediate'}</strong></div>
            <div><span>Personalization</span><strong>{status?.personalization?.enabled ? status?.personalization?.gemini ? 'Behavior + Gemini' : 'Behavior-aware' : 'Off'}</strong></div>
            <div><span>Queued release</span><strong>{softwareAgent?.pending?.features?.join(', ') || 'None'}</strong></div>
            <div><span>Client portal</span><strong>{portalState?.clientPortal?.url || '--'}</strong></div>
            <div><span>Owner portal</span><strong>{portalState?.ownerPortal?.status || '--'}</strong></div>
            <div><span>Portal refresh</span><strong>{portalState?.updatedAt ? new Date(portalState.updatedAt).toLocaleString() : '--'}</strong></div>
            <div><span>Google callback</span><strong>{portalState?.oauthCallbacks?.googleLogin || '--'}</strong></div>
          </div>
          <div className="button-row">
            <button className="button button-primary" type="button" onClick={connectBusinessGmail} disabled={busy === 'connect'}>
              <MailCheck size={15} />
              {busy === 'connect' ? 'Opening Google...' : status?.mailbox?.gmailConnected ? 'Reconnect business Gmail' : 'Connect business Gmail'}
            </button>
            <button className="button button-secondary" type="button" onClick={testMailbox} disabled={busy === 'test'}>
              <MailCheck size={15} />
              {busy === 'test' ? 'Checking...' : 'Test business Gmail'}
            </button>
            <button className="button button-secondary" type="button" onClick={scanSoftwareUpdates} disabled={busy === 'scan'}>
              <RefreshCw size={15} />
              {busy === 'scan' ? 'Checking...' : 'Check for client-facing updates'}
            </button>
            <button className="button button-secondary" type="button" onClick={refreshPortals} disabled={busy === 'portals'}>
              <RefreshCw size={15} />
              {busy === 'portals' ? 'Refreshing...' : 'Refresh portal links'}
            </button>
            {portalState?.clientPortal?.url && (
              <a className="button button-secondary" href={portalState.clientPortal.url} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                Open client portal
              </a>
            )}
          </div>
        </article>

        <form className="panel update-form" onSubmit={sendUpdate}>
          <div className="panel-head">
            <div>
              <h2>Send update</h2>
              <p>The agent deduplicates by content unless force resend is enabled.</p>
            </div>
          </div>
          <label>
            Update title
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="New CV page and Gmail improvements" />
          </label>
          <label>
            Client summary
            <textarea rows="4" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="We improved your workspace with..." />
          </label>
          <label>
            Changes, one per line
            <textarea rows="5" value={form.changes} onChange={e => setForm({ ...form, changes: e.target.value })} placeholder="Facebook-style CV profile&#10;Business Gmail notifications&#10;Safer Google sign-in" />
          </label>
          <label>
            Action URL
            <input value={form.actionUrl} onChange={e => setForm({ ...form, actionUrl: e.target.value })} placeholder="https://your-domain.com/dashboard" />
          </label>
          <div className="checkbox-grid">
            <label><input type="checkbox" checked={form.activeSessionOnly} onChange={e => setForm({ ...form, activeSessionOnly: e.target.checked })} />Only clients with active sessions</label>
            <label><input type="checkbox" checked={form.personalize} onChange={e => setForm({ ...form, personalize: e.target.checked })} />Personalize from safe workspace activity</label>
            <label><input type="checkbox" checked={form.force} onChange={e => setForm({ ...form, force: e.target.checked })} />Force resend</label>
          </div>
          <button className="button button-primary" disabled={busy === 'send'}>
            <Send size={15} />
            {busy === 'send' ? 'Sending...' : 'Send client update'}
          </button>
        </form>
      </section>

      <section className="panel data-panel">
        <div className="panel-head">
          <div>
            <h2>Registered email recipients</h2>
            <p>Only active client accounts stored in the JobPilot database receive client-update emails. Owner and demo accounts are excluded.</p>
          </div>
          <MailCheck size={24} />
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr><th>Client</th><th>Email</th><th>Next useful step</th><th>Status</th><th>Last login</th></tr>
            </thead>
            <tbody>
              {(status?.eligibleRecipients || []).map(recipient => (
                <tr key={recipient.id}>
                  <td>{recipient.name}</td>
                  <td>{recipient.email}</td>
                  <td>{recipient.nextAction?.label || 'Open workspace'}</td>
                  <td><span className="status-badge status-active">Active</span></td>
                  <td>{recipient.lastLoginAt ? new Date(recipient.lastLoginAt).toLocaleString() : '--'}</td>
                </tr>
              ))}
              {!status?.eligibleRecipients?.length && (
                <tr><td colSpan="5">No registered active clients are currently eligible for update emails.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
