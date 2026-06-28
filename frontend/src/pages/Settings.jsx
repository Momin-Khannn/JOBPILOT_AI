import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  AlertCircle,
  BadgeCheck,
  BellRing,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ContactRound,
  Copy,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  Eye,
  KeyRound,
  LockKeyhole,
  Mail,
  MailCheck,
  MessageCircle,
  MonitorCog,
  PlugZap,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { api } from '../api/client.js'
import { readConsent, writeConsent } from '../utils/consent.js'

const sections = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'search', label: 'Job search', icon: BriefcaseBusiness },
  { id: 'automation', label: 'Automation', icon: ClipboardCheck },
  { id: 'connections', label: 'Connections', icon: PlugZap },
  { id: 'notifications', label: 'Notifications', icon: BellRing },
  { id: 'public-cv', label: 'Public CV', icon: ContactRound },
  { id: 'security', label: 'Security', icon: LockKeyhole },
  { id: 'privacy', label: 'Privacy & display', icon: Eye },
  { id: 'billing', label: 'Billing & support', icon: CreditCard },
]

function listValue(value) {
  return (value || []).join(', ')
}

function splitList(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean)
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function ToggleRow({ checked, disabled = false, label, detail, onChange }) {
  return (
    <label className={`settings-toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <span><strong>{label}</strong><small>{detail}</small></span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} />
    </label>
  )
}

function SettingStatus({ good = false, children }) {
  return <span className={`settings-status ${good ? 'is-good' : ''}`}>{good ? <Check size={14} /> : null}{children}</span>
}

export default function Settings() {
  const { onUserUpdated } = useOutletContext() || {}
  const [activeSection, setActiveSection] = useState('account')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [billing, setBilling] = useState(null)
  const [authentication, setAuthentication] = useState(null)
  const [sessions, setSessions] = useState([])
  const [gmail, setGmail] = useState(null)
  const [whatsapp, setWhatsapp] = useState(null)
  const [consent, setConsent] = useState(() => readConsent() || { necessary: true, analytics: false })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [disconnecting, setDisconnecting] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const [settingsData, billingData, profileData, gmailData, whatsappData] = await Promise.all([
      api.settings(),
      api.billingStatus(),
      api.profile(),
      api.gmailStatus().catch(() => null),
      api.whatsappStatus().catch(() => null),
    ])
    setUser(settingsData.user)
    setAuthentication(settingsData.authentication)
    setSessions(settingsData.sessions || [])
    setBilling(billingData)
    setProfile(profileData.profile)
    setGmail(gmailData || settingsData.integrations?.gmail || null)
    setWhatsapp(whatsappData || settingsData.integrations?.whatsapp || null)
    const result = new URLSearchParams(window.location.search).get('billing')
    if (result === 'success') setMessage('Payment received. Pro activates after Stripe verifies the subscription.')
    if (result === 'cancelled') setMessage('Checkout cancelled. No plan change was made.')
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

  useEffect(() => {
    if (!user) return
    const density = user.preferences?.density || 'comfortable'
    document.documentElement.dataset.density = density
    document.documentElement.classList.toggle('user-reduced-motion', Boolean(user.preferences?.reducedMotion))
  }, [user])

  const billingStatus = billing?.billing?.status || ''
  const isLifetimePro = billing?.tier === 'pro' && billingStatus === 'lifetime'
  const canManageSubscription = billing?.tier === 'pro' && !isLifetimePro && billing?.billing
  const publicUrl = profile ? `${window.location.origin}/cv/${profile.slug}` : ''
  const currentSection = useMemo(() => sections.find(item => item.id === activeSection), [activeSection])
  const ActiveSectionIcon = currentSection?.icon

  function showResult(nextMessage) {
    setMessage(nextMessage)
    setError('')
    window.scrollTo({ top: 0, behavior: user?.preferences?.reducedMotion ? 'auto' : 'smooth' })
  }

  function update(field, value) {
    setUser(current => ({ ...current, [field]: value }))
  }

  function updatePreference(field, value) {
    setUser(current => ({
      ...current,
      preferences: { ...(current.preferences || {}), [field]: value },
    }))
  }

  function updateProfileVisibility(field, value) {
    setProfile(current => ({
      ...current,
      visibility: { ...(current.visibility || {}), [field]: value },
    }))
  }

  async function saveUser(successMessage = 'Settings saved.') {
    setBusy('save-user')
    try {
      const data = await api.saveSettings(user)
      setUser(data.user)
      onUserUpdated?.(data.user)
      showResult(successMessage)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function saveProfilePrivacy() {
    setBusy('save-profile')
    try {
      const data = await api.saveProfile(profile)
      setProfile(data.profile)
      showResult(data.profile.published ? 'Public CV settings saved.' : 'CV webpage is now private.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function savePrivacyAndDisplay() {
    writeConsent({ analytics: consent.analytics })
    await saveUser('Privacy and display preferences saved.')
  }

  async function resendVerification() {
    setBusy('verification')
    try {
      const payload = await api.resendVerification({ email: user.email })
      showResult(payload.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function changePassword() {
    setBusy('password')
    try {
      const payload = await api.changePassword(passwords)
      setPasswords({ currentPassword: '', newPassword: '' })
      setSessions(current => current.filter(item => item.current))
      showResult(payload.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function signOutOtherSessions() {
    setBusy('sessions')
    try {
      const payload = await api.signOutOtherSessions()
      setSessions(current => current.filter(item => item.current))
      showResult(payload.revoked ? `${payload.revoked} other session${payload.revoked === 1 ? '' : 's'} signed out.` : 'No other sessions were active.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function connectGmail() {
    setBusy('gmail')
    try {
      const { url } = await api.gmailAuthUrl()
      window.location.assign(url)
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  async function disconnectIntegration(kind) {
    setBusy(kind)
    try {
      if (kind === 'gmail') {
        await api.disconnectGmail()
        setGmail(current => ({ ...(current || {}), connected: false, email: null, connectedEmail: null }))
      } else {
        await api.disconnectWhatsApp()
        setWhatsapp(current => ({ ...(current || {}), connected: false }))
      }
      setDisconnecting('')
      showResult(`${kind === 'gmail' ? 'Gmail' : 'WhatsApp'} disconnected from JobPilot.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function startCheckout(interval) {
    setBusy('billing')
    try {
      const { url } = await api.startProCheckout(interval)
      window.location.assign(url)
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  async function manageSubscription() {
    setBusy('billing')
    try {
      const { url } = await api.openBillingPortal()
      window.location.assign(url)
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  async function exportData() {
    setBusy('export')
    try {
      const data = await api.exportAccount()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `jobpilot-export-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      showResult('Your account export was created.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function deleteAccount() {
    setBusy('delete')
    try {
      await api.deleteAccount(deleteConfirmation)
      api.setSessionToken('')
      window.location.assign('/')
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  async function copyPublicLink() {
    await navigator.clipboard.writeText(publicUrl)
    showResult('Public CV link copied.')
  }

  if (!user || !profile) return <div className="settings-loading" aria-label="Loading settings"><span /><span /><span /></div>

  return (
    <div className="stack settings-page">
      <section className="page-heading settings-heading">
        <div>
          <span className="eyebrow">Workspace controls</span>
          <h1>Settings</h1>
          <p>Account, automation, privacy, connections, and billing.</p>
        </div>
        <div className="settings-heading-status"><ShieldCheck size={16} /> Review required for every external send</div>
      </section>

      {error && <div className="alert" role="alert"><AlertCircle size={18} />{error}</div>}
      {message && <div className="success" role="status"><Check size={17} />{message}</div>}

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings categories">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={activeSection === id ? 'active' : ''} onClick={() => setActiveSection(id)} aria-current={activeSection === id ? 'page' : undefined}>
              <Icon size={17} /><span>{label}</span><ChevronRight size={14} />
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <header className="settings-content-header">
            <span>{ActiveSectionIcon && <ActiveSectionIcon size={18} />}</span>
            <h2>{currentSection?.label}</h2>
          </header>

          {activeSection === 'account' && (
            <section className="settings-section" aria-labelledby="account-heading">
              <div className="settings-section-title"><h3 id="account-heading">Personal details</h3><p>Used for your private workspace and application drafts.</p></div>
              <div className="settings-form-grid">
                <label>Name<input value={user.name || ''} maxLength={120} onChange={event => update('name', event.target.value)} /></label>
                <label>Email<input value={user.email || ''} readOnly /></label>
                <label>Phone<input value={user.phone || ''} maxLength={40} onChange={event => update('phone', event.target.value)} /></label>
                <label>Location<input value={user.location || ''} maxLength={160} onChange={event => update('location', event.target.value)} /></label>
              </div>
              <div className="settings-inline-status">
                <div><BadgeCheck size={18} /><span><strong>{user.emailVerified ? 'Email verified' : 'Verification required'}</strong><small>{user.email}</small></span></div>
                {!user.emailVerified && <button type="button" className="button button-secondary" disabled={busy === 'verification'} onClick={resendVerification}><MailCheck size={16} />Resend verification</button>}
              </div>
              <div className="settings-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={() => saveUser('Account details saved.')}><Save size={16} />Save account</button></div>
            </section>
          )}

          {activeSection === 'search' && (
            <section className="settings-section" aria-labelledby="search-heading">
              <div className="settings-section-title"><h3 id="search-heading">Opportunity preferences</h3><p>Used by Career Goal, discovery filters, exclusions, and salary context.</p></div>
              <div className="settings-form-grid">
                <label className="wide">Target roles<input value={listValue(user.preferences?.roles)} onChange={event => updatePreference('roles', splitList(event.target.value))} placeholder="Backend Engineer, Product Engineer" /></label>
                <label className="wide">Target locations<input value={listValue(user.preferences?.locations)} onChange={event => updatePreference('locations', splitList(event.target.value))} placeholder="Remote, Lahore, London" /></label>
                <label>Work arrangement<select value={user.preferences?.remotePreference || 'any'} onChange={event => updatePreference('remotePreference', event.target.value)}><option value="any">Any arrangement</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
                <label>Experience level<select value={user.preferences?.experienceLevel || ''} onChange={event => updatePreference('experienceLevel', event.target.value)}><option value="">Any level</option><option value="Entry">Entry</option><option value="Entry to Mid">Entry to mid</option><option value="Mid">Mid-level</option><option value="Senior">Senior</option><option value="Lead">Lead</option></select></label>
                <label>Minimum salary<input type="number" min="0" value={user.preferences?.minSalary || 0} onChange={event => updatePreference('minSalary', Number(event.target.value))} /></label>
                <label>Salary currency<select value={user.preferences?.salaryCurrency || 'USD'} onChange={event => updatePreference('salaryCurrency', event.target.value)}><option value="USD">USD</option><option value="PKR">PKR</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="AED">AED</option></select></label>
                <label className="wide">Job types<input value={listValue(user.preferences?.jobTypes)} onChange={event => updatePreference('jobTypes', splitList(event.target.value))} placeholder="Full-time, Contract, Internship" /></label>
                <label className="wide">Excluded companies or roles<input value={listValue(user.preferences?.blacklist)} onChange={event => updatePreference('blacklist', splitList(event.target.value))} /></label>
              </div>
              <div className="settings-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={() => saveUser('Job preferences saved.')}><Save size={16} />Save preferences</button></div>
            </section>
          )}

          {activeSection === 'automation' && (
            <section className="settings-section" aria-labelledby="automation-heading">
              <div className="settings-section-title"><h3 id="automation-heading">Safety and timing</h3><p>These controls apply before any application or career message can leave JobPilot.</p></div>
              <div className="settings-toggle-list">
                <ToggleRow checked disabled label="Review before sending" detail="Required for applications, follow-ups, and negotiation messages." />
                <ToggleRow checked={Boolean(user.preferences?.quietHoursEnabled)} label="Quiet hours" detail="Pause Gmail and WhatsApp sends during the selected window." onChange={value => updatePreference('quietHoursEnabled', value)} />
              </div>
              <div className="settings-form-grid compact-grid">
                <label>Daily send limit<input type="number" min="1" max="100" value={user.preferences?.dailySendLimit || 15} onChange={event => updatePreference('dailySendLimit', Number(event.target.value))} /></label>
                <label>Timezone<input value={user.preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} maxLength={80} onChange={event => updatePreference('timezone', event.target.value)} /></label>
                <label>Quiet hours start<input type="time" value={user.preferences?.quietHoursStart || '22:00'} onChange={event => updatePreference('quietHoursStart', event.target.value)} /></label>
                <label>Quiet hours end<input type="time" value={user.preferences?.quietHoursEnd || '08:00'} onChange={event => updatePreference('quietHoursEnd', event.target.value)} /></label>
                <label>Application silence threshold<input type="number" min="3" max="30" value={user.preferences?.ghostingApplicationDays || 7} onChange={event => updatePreference('ghostingApplicationDays', Number(event.target.value))} /><small>Days after an application or follow-up</small></label>
                <label>Interview silence threshold<input type="number" min="3" max="30" value={user.preferences?.ghostingInterviewDays || 9} onChange={event => updatePreference('ghostingInterviewDays', Number(event.target.value))} /><small>Days after an interview</small></label>
                <label>Draft tone<select value={user.preferences?.aiTone || 'balanced'} onChange={event => updatePreference('aiTone', event.target.value)}><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="warm">Warm</option></select></label>
              </div>
              <div className="settings-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={() => saveUser('Automation controls saved.')}><Save size={16} />Save automation</button></div>
            </section>
          )}

          {activeSection === 'connections' && (
            <section className="settings-section" aria-labelledby="connections-heading">
              <div className="settings-section-title"><h3 id="connections-heading">Delivery connections</h3><p>Provider access is encrypted and remains subject to approval and send limits.</p></div>
              <div className="integration-settings-list">
                <article>
                  <span className="integration-settings-icon"><Mail size={19} /></span>
                  <div><strong>Gmail</strong><small>{gmail?.connected ? gmail.email || gmail.connectedEmail || 'Connected mailbox' : 'Not connected'}</small></div>
                  <SettingStatus good={gmail?.connected}>{gmail?.connected ? 'Connected' : gmail?.credentialReady ? 'Ready to connect' : 'Unavailable'}</SettingStatus>
                  <div className="integration-settings-actions">
                    <button className="button button-secondary" disabled={busy === 'gmail' || !gmail?.credentialReady} onClick={connectGmail}>{gmail?.connected ? 'Reconnect' : 'Connect'}</button>
                    {gmail?.connected && (disconnecting === 'gmail' ? <><button className="button button-ghost" onClick={() => setDisconnecting('')}>Cancel</button><button className="button button-danger" disabled={busy === 'gmail'} onClick={() => disconnectIntegration('gmail')}>Confirm</button></> : <button className="button button-ghost" onClick={() => setDisconnecting('gmail')}>Disconnect</button>)}
                  </div>
                </article>
                <article>
                  <span className="integration-settings-icon"><MessageCircle size={19} /></span>
                  <div><strong>WhatsApp</strong><small>{whatsapp?.connected ? `${whatsapp.provider || 'Official'} provider` : 'Not configured'}</small></div>
                  <SettingStatus good={whatsapp?.connected}>{whatsapp?.connected ? 'Configured' : whatsapp?.credentialReady ? 'Provider ready' : 'Needs setup'}</SettingStatus>
                  <div className="integration-settings-actions">
                    <Link className="button button-secondary" to="/whatsapp">Manage</Link>
                    {whatsapp?.connected && (disconnecting === 'whatsapp' ? <><button className="button button-ghost" onClick={() => setDisconnecting('')}>Cancel</button><button className="button button-danger" disabled={busy === 'whatsapp'} onClick={() => disconnectIntegration('whatsapp')}>Confirm</button></> : <button className="button button-ghost" onClick={() => setDisconnecting('whatsapp')}>Disconnect</button>)}
                  </div>
                </article>
              </div>
            </section>
          )}

          {activeSection === 'notifications' && (
            <section className="settings-section" aria-labelledby="notifications-heading">
              <div className="settings-section-title"><h3 id="notifications-heading">Email notices</h3><p>Messages are sent only to the verified account address.</p></div>
              <div className="settings-toggle-list">
                <ToggleRow checked={user.preferences?.productUpdatesOptIn !== false} label="Product and application updates" detail="Release notes and important changes to your JobPilot workspace." onChange={value => updatePreference('productUpdatesOptIn', value)} />
                <ToggleRow checked disabled label="Security notices" detail="Verification, password, and critical account notices cannot be disabled." />
              </div>
              <div className="settings-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={() => saveUser('Notification preferences saved.')}><Save size={16} />Save notifications</button></div>
            </section>
          )}

          {activeSection === 'public-cv' && (
            <section className="settings-section" aria-labelledby="cv-heading">
              <div className="settings-section-title"><h3 id="cv-heading">Publishing and contact privacy</h3><p>Only enabled details appear to visitors with your CV link.</p></div>
              <div className="settings-toggle-list">
                <ToggleRow checked={Boolean(profile.published)} label="Publish CV webpage" detail={profile.published ? 'The link is publicly accessible.' : 'The page returns unavailable to visitors.'} onChange={value => setProfile(current => ({ ...current, published: value }))} />
                {['email', 'phone', 'location', 'website', 'linkedin', 'github'].map(field => <ToggleRow key={field} checked={Boolean(profile.visibility?.[field])} label={`Show ${field}`} detail={`Include ${field} on the public page.`} onChange={value => updateProfileVisibility(field, value)} />)}
              </div>
              {profile.published && <div className="public-cv-setting-link"><input readOnly value={publicUrl} aria-label="Public CV link" /><button className="icon-button" onClick={copyPublicLink} aria-label="Copy public CV link"><Copy size={16} /></button><a className="icon-button" href={publicUrl} target="_blank" rel="noreferrer" aria-label="Open public CV"><ExternalLink size={16} /></a></div>}
              <div className="settings-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={saveProfilePrivacy}><Save size={16} />Save CV privacy</button><Link className="button button-secondary" to="/profile">Open CV editor</Link></div>
            </section>
          )}

          {activeSection === 'security' && (
            <section className="settings-section" aria-labelledby="security-heading">
              <div className="settings-section-title"><h3 id="security-heading">Sign-in protection</h3><p>Authentication status and active sessions for this account.</p></div>
              <div className="security-summary">
                <div><ShieldCheck size={18} /><span><strong>{authentication?.provider === 'google' ? 'Google sign-in' : 'Password sign-in'}</strong><small>Last login {formatDate(authentication?.lastLoginAt)}</small></span></div>
                <SettingStatus good={authentication?.twoFactorEnabled}>{authentication?.twoFactorEnabled ? 'Email code enabled' : 'Standard protection'}</SettingStatus>
                <SettingStatus good={authentication?.captchaEnabled}>{authentication?.captchaEnabled ? 'Bot check enabled' : 'Rate limited'}</SettingStatus>
              </div>
              <div className="settings-subsection">
                <div className="settings-subsection-heading"><div><h4>Active sessions</h4><p>{sessions.length} signed-in session{sessions.length === 1 ? '' : 's'}</p></div><button className="button button-secondary" disabled={busy === 'sessions' || sessions.length <= 1} onClick={signOutOtherSessions}>Sign out others</button></div>
                <div className="session-list">{sessions.map(session => <div key={session.id}><span className={session.current ? 'current-session-dot' : ''} /><div><strong>{session.current ? 'This device' : 'Other signed-in session'}</strong><small>Last active {formatDate(session.lastSeenAt)}</small></div>{session.current && <SettingStatus good>Current</SettingStatus>}</div>)}</div>
              </div>
              {authentication?.passwordChangeAvailable ? <div className="settings-subsection"><div className="settings-subsection-heading"><div><h4>Change password</h4><p>Other sessions are signed out after the change.</p></div></div><div className="settings-form-grid"><label>Current password<input type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={event => setPasswords(current => ({ ...current, currentPassword: event.target.value }))} /></label><label>New password<input type="password" minLength="8" autoComplete="new-password" value={passwords.newPassword} onChange={event => setPasswords(current => ({ ...current, newPassword: event.target.value }))} /></label></div><div className="settings-actions"><button className="button button-primary" disabled={busy === 'password' || !passwords.currentPassword || passwords.newPassword.length < 8} onClick={changePassword}><KeyRound size={16} />Change password</button></div></div> : <div className="settings-inline-status"><div><BadgeCheck size={18} /><span><strong>Password managed by Google</strong><small>Use your Google Account security settings to change it.</small></span></div></div>}
            </section>
          )}

          {activeSection === 'privacy' && (
            <section className="settings-section" aria-labelledby="privacy-heading">
              <div className="settings-section-title"><h3 id="privacy-heading">Consent and display</h3><p>Necessary login storage remains enabled. Analytics is optional.</p></div>
              <div className="settings-toggle-list">
                <ToggleRow checked disabled label="Necessary storage" detail="Required for secure sessions and saved workspace preferences." />
                <ToggleRow checked={Boolean(consent.analytics)} label="Optional product analytics" detail="Anonymous page and feature events used to improve reliability." onChange={value => setConsent(current => ({ ...current, analytics: value }))} />
                <ToggleRow checked={Boolean(user.preferences?.reducedMotion)} label="Reduce motion" detail="Removes non-essential interface transitions for this account." onChange={value => updatePreference('reducedMotion', value)} />
              </div>
              <div className="settings-form-grid compact-grid"><label>Interface density<select value={user.preferences?.density || 'comfortable'} onChange={event => updatePreference('density', event.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div>
              <div className="settings-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={savePrivacyAndDisplay}><MonitorCog size={16} />Save privacy & display</button><button className="button button-secondary" disabled={busy === 'export'} onClick={exportData}><Download size={16} />Export my data</button></div>
              <div className="danger-zone settings-danger">
                <div><h4><ShieldAlert size={18} />Permanently delete account</h4><p>Removes CVs, applications, integrations, interview sessions, and active sessions. Cancel an active subscription first.</p></div>
                <div className="danger-actions"><input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm" /><button className="button button-danger" disabled={busy === 'delete' || deleteConfirmation !== 'DELETE'} onClick={deleteAccount}><Trash2 size={16} />Delete account</button></div>
              </div>
            </section>
          )}

          {activeSection === 'billing' && (
            <section className="settings-section" aria-labelledby="billing-heading">
              <div className="settings-section-title"><h3 id="billing-heading">Plan and payment</h3><p>Subscription changes are handled through verified Stripe pages.</p></div>
              <div className="billing-setting">
                <span><Crown size={20} /></span>
                <div><strong>{billing?.tier === 'pro' ? 'JobPilot Pro' : 'JobPilot Basic'}</strong><small>{isLifetimePro ? 'Lifetime access · no renewal required' : billing?.tier === 'pro' ? `Subscription ${billing.billing?.status || 'active'}${billing.billing?.cancelAtPeriodEnd ? ' · cancels at period end' : ''}` : 'Basic workspace access'}</small></div>
                <SettingStatus good={billing?.tier === 'pro'}>{billing?.tier === 'pro' ? 'Pro active' : 'Basic'}</SettingStatus>
                <div className="subscription-actions">{canManageSubscription ? <button className="button button-secondary" disabled={busy === 'billing'} onClick={manageSubscription}><CreditCard size={16} />Manage subscription</button> : isLifetimePro ? <span className="subscription-note">No card required</span> : <><button className="button button-primary" disabled={busy === 'billing' || !billing?.configured} onClick={() => startCheckout('monthly')}><CircleDollarSign size={16} />Upgrade monthly</button>{billing?.annualAvailable && <button className="button button-secondary" disabled={busy === 'billing'} onClick={() => startCheckout('annual')}>Upgrade annually</button>}</>}</div>
              </div>
              {!billing?.configured && billing?.tier !== 'pro' && <p className="settings-caution">Stripe checkout is not connected yet. No payment can be collected until live billing is configured.</p>}
              <div className="settings-subsection support-links"><div className="settings-subsection-heading"><div><h4>Support</h4><p>Contact the JobPilot team or report a reproducible problem.</p></div></div><div><Link className="button button-secondary" to="/support?type=support">Contact support</Link><Link className="button button-secondary" to="/support?type=bug">Report a bug</Link></div></div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
