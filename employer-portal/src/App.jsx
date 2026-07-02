import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Link, Navigate, NavLink, Route, Routes, useSearchParams } from 'react-router-dom'
import {
  AlertCircle, ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, Check, ChevronRight,
  CircleDollarSign, Clock3, Command, FileText, LayoutDashboard, LockKeyhole, LogOut,
  Mail, Menu, MessageCircle, Plus, RefreshCw, Send, ShieldCheck, Sparkles, UserRoundPlus, Users, X,
} from 'lucide-react'
import { api } from './api.js'

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { to: '/applicants', label: 'Applicants', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/team', label: 'Team', icon: UserRoundPlus },
  { to: '/billing', label: 'Employer Plus', icon: CircleDollarSign },
]

const WorkspaceContext = createContext(null)

function marketplaceSocketOrigin() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:4000'
  if (['localhost', '127.0.0.1'].includes(window.location.hostname) && ['3002', '5173'].includes(window.location.port)) return 'http://127.0.0.1:4000'
  return window.location.origin
}

function Loading() {
  return <div className="employer-loading"><span>JP</span><div><strong>Opening employer workspace</strong><small>Checking your secure session…</small></div></div>
}

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', companyWebsite: '', acceptedTerms: false, captchaAnswer: '' })
  const [captcha, setCaptcha] = useState(null)
  const [security, setSecurity] = useState({ captchaEnabled: false })
  const [twoFactor, setTwoFactor] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadCaptcha = useCallback(async () => {
    const payload = await api.captcha()
    setCaptcha(payload.enabled === false ? null : payload)
    setForm(current => ({ ...current, captchaAnswer: '' }))
  }, [])

  useEffect(() => {
    api.security().then(payload => {
      setSecurity(payload)
      if (payload.captchaEnabled) loadCaptcha()
    }).catch(() => {})
  }, [loadCaptcha])

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'request') {
        const payload = await api.register({ ...form })
        setNotice(payload.emailVerification?.message || 'Request received. Verify your email, then sign in to follow approval.')
        setMode('login')
      } else {
        const payload = await api.login({ ...form, captchaChallengeId: captcha?.challengeId || '' })
        if (payload.requiresTwoFactor) setTwoFactor(payload)
        else onAuthenticated(payload.user)
      }
    } catch (err) {
      setError(err.message)
      if (security.captchaEnabled) loadCaptcha().catch(() => {})
    } finally { setBusy(false) }
  }

  async function verifyCode(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const payload = await api.verifyTwoFactor({ challengeId: twoFactor.challengeId, code })
      onAuthenticated(payload.user)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <main className="employer-auth">
    <section className="employer-auth-story">
      <Link className="employer-wordmark" to="/"><Command size={20} /><span>JobPilot<strong>Employers</strong></span></Link>
      <div>
        <span className="trust-label"><ShieldCheck size={16} /> Verified hiring workspace</span>
        <h1>Meet candidates who chose to hear from you.</h1>
        <p>Publish verified roles, review applicants, and keep every pre-hire conversation private and accountable.</p>
        <ul><li><Check size={17} /> Applicants only—no unsolicited candidate search</li><li><Check size={17} /> Business identity reviewed before jobs go live</li><li><Check size={17} /> Scam-aware, job-linked conversations</li></ul>
      </div>
      <a href="/">Back to JobPilot AI</a>
    </section>
    <section className="employer-auth-form">
      <div className="auth-panel">
        <div className="auth-mode"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button><button className={mode === 'request' ? 'active' : ''} onClick={() => setMode('request')}>Request access</button></div>
        {twoFactor ? <form onSubmit={verifyCode}><h2>Check your company email</h2><p>Enter the six-digit security code sent to {twoFactor.maskedEmail}.</p><label>Security code<input value={code} inputMode="numeric" maxLength="6" onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label><button className="primary-button" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Continue securely'}<ArrowRight size={17} /></button></form> : <form onSubmit={submit}>
          <div><h2>{mode === 'request' ? 'Request employer access' : 'Welcome back'}</h2><p>{mode === 'request' ? 'Use your company email. Your first role stays private until JobPilot approves the company.' : 'Open your verified hiring workspace.'}</p></div>
          {mode === 'request' && <><label>Your name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Company name<input required value={form.companyName} onChange={event => setForm({ ...form, companyName: event.target.value })} /></label><label>Company website<input type="url" placeholder="https://company.com" value={form.companyWebsite} onChange={event => setForm({ ...form, companyWebsite: event.target.value })} /></label></>}
          <label>Company email<input required type="email" placeholder="you@company.com" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
          <label>Password<input required minLength="8" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
          {security.captchaEnabled && captcha && <label>Bot-check code<span className="captcha-row"><img src={captcha.image} alt="Bot-check code" /><button type="button" onClick={loadCaptcha}><RefreshCw size={16} /></button></span><input required maxLength="5" value={form.captchaAnswer} onChange={event => setForm({ ...form, captchaAnswer: event.target.value.toUpperCase() })} /></label>}
          {mode === 'request' && <label className="terms-check"><input type="checkbox" checked={form.acceptedTerms} onChange={event => setForm({ ...form, acceptedTerms: event.target.checked })} /><span>I accept JobPilot’s Terms and Privacy Notice.</span></label>}
          {notice && <div className="notice"><Mail size={17} />{notice}</div>}{error && <div className="error"><AlertCircle size={17} />{error}</div>}
          <button className="primary-button" disabled={busy || (mode === 'request' && !form.acceptedTerms)}>{busy ? 'Please wait…' : mode === 'request' ? 'Submit access request' : 'Sign in'}<ArrowRight size={17} /></button>
        </form>}
      </div>
    </section>
  </main>
}

function VerifyEmailPage() {
  const [params] = useSearchParams(); const [state, setState] = useState({ loading: true, error: '', message: '' })
  useEffect(() => { const token = params.get('token'); if (!token) return setState({ loading: false, error: 'Verification token is missing.', message: '' }); api.verifyEmail(token).then(payload => setState({ loading: false, error: '', message: payload.message })).catch(error => setState({ loading: false, error: error.message, message: '' })) }, [])
  return <main className="verification-page"><div><BadgeCheck size={36} /><h1>{state.loading ? 'Verifying company email…' : state.error ? 'Verification failed' : 'Company email verified'}</h1><p>{state.error || state.message || 'One moment.'}</p><Link className="primary-button" to="/login">Continue to sign in</Link></div></main>
}

function InvitePage({ onAuthenticated }) {
  const [params] = useSearchParams(); const token = params.get('token') || ''
  const [invitation, setInvitation] = useState(null); const [form, setForm] = useState({ name: '', password: '', acceptedTerms: false }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { if (!token) return setError('Recruiter invitation token is missing.'); api.inviteInfo(token).then(payload => setInvitation(payload.invitation)).catch(err => setError(err.message)) }, [token])
  async function accept(event) { event.preventDefault(); setBusy(true); setError(''); try { const payload = await api.acceptInvite(token, form); onAuthenticated(payload.user) } catch (err) { setError(err.message) } finally { setBusy(false) } }
  return <main className="verification-page"><div className="invite-accept-panel"><UserRoundPlus size={36} /><h1>Join {invitation?.company?.name || 'the recruiting team'}</h1><p>{invitation ? `Create your recruiter account for ${invitation.email}.` : error || 'Checking your invitation…'}</p>{invitation && <form onSubmit={accept}><label>Your name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Create password<input required type="password" minLength="8" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label><label className="terms-check"><input type="checkbox" checked={form.acceptedTerms} onChange={event => setForm({ ...form, acceptedTerms: event.target.checked })} /><span>I accept JobPilot’s Terms and Privacy Notice.</span></label>{error && <div className="error"><AlertCircle size={17} />{error}</div>}<button className="primary-button" disabled={busy || !form.acceptedTerms}>{busy ? 'Joining…' : 'Join recruiting team'}<ArrowRight size={17} /></button></form>}</div></main>
}

function EmployerLayout({ user, overview, refresh, onLogout, error, setError }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return <div className="employer-shell">
    <aside className={mobileOpen ? 'open' : ''}>
      <div className="workspace-brand"><Command size={19} /><span>JobPilot<strong>Employers</strong></span><button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <nav>{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}><Icon size={18} />{label}<ChevronRight size={15} /></NavLink>)}</nav>
      <div className="workspace-company"><Building2 size={18} /><span><strong>{overview?.company?.name || 'Company workspace'}</strong><small>{overview?.company?.status === 'verified' ? 'Verified employer' : 'Approval pending'}</small></span></div>
    </aside>
    <section className="employer-main">
      <header><button className="menu-button" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><div><small>Employer workspace</small><strong>{overview?.company?.name || user.name}</strong></div><button className="quiet-button" onClick={onLogout}><LogOut size={16} /> Sign out</button></header>
      {error && <div className="global-error"><AlertCircle size={17} />{error}</div>}
      <main><WorkspaceContext.Provider value={{ overview, refresh, setError }}><Routes><Route path="/dashboard" element={<Dashboard />} /><Route path="/jobs" element={<Jobs />} /><Route path="/applicants" element={<Applicants />} /><Route path="/messages" element={<Messages user={user} />} /><Route path="/team" element={<Team />} /><Route path="/billing" element={<Billing />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></WorkspaceContext.Provider></main>
    </section>
  </div>
}

function useWorkspace() { return useContext(WorkspaceContext) }

function PageHeading({ title, description, action }) { return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div> }

function Dashboard() {
  const { overview } = useWorkspace(); const company = overview?.company; const summary = overview?.summary || {}
  return <div className="page-stack"><PageHeading title="Hiring overview" description="The roles, applicants, and conversations your team needs today." />
    {company?.status !== 'verified' && <section className="approval-banner"><Clock3 size={22} /><div><strong>Company review in progress</strong><p>You can draft your first role now. It stays private until JobPilot verifies your business email and company details.</p></div><Link to="/jobs">Draft a role</Link></section>}
    <section className="metric-row"><article><span>Live roles</span><strong>{summary.activeJobs || 0}</strong></article><article><span>Applicants</span><strong>{summary.applicants || 0}</strong></article><article><span>Unread</span><strong>{summary.unread || 0}</strong></article><article><span>Hires</span><strong>{summary.hires || 0}</strong></article></section>
    <section className="dashboard-split"><article className="surface"><div className="section-head"><div><h2>Recent applicants</h2><p>People who applied directly through JobPilot.</p></div><Link to="/applicants">View all</Link></div>{(overview?.applications || []).slice(0, 5).map(app => <div className="compact-row" key={app.id}><span className="avatar">{app.candidate?.name?.[0] || 'C'}</span><div><strong>{app.candidate?.name}</strong><small>{app.job?.title}</small></div><b>{app.status}</b></div>)}{!overview?.applications?.length && <Empty text="No applicants yet. Your verified roles will appear in the candidate job feed." />}</article>
    <article className="surface"><div className="section-head"><div><h2>Trust status</h2><p>What candidates can see about your company.</p></div></div><div className="trust-summary"><ShieldCheck size={28} /><strong>{company?.status === 'verified' ? 'Verified employer' : 'Verification pending'}</strong><p>{company?.status === 'verified' ? `Business domain ${company.domain} was reviewed by JobPilot.` : 'No verification badge appears until owner approval.'}</p></div></article></section>
  </div>
}

function Empty({ text }) { return <div className="empty"><FileText size={22} /><p>{text}</p></div> }

function Jobs() {
  const { overview, refresh, setError } = useWorkspace(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [form, setForm] = useState({ title: '', location: '', type: 'Full-time', salary: '', description: '', tags: '' })
  async function create(event) { event.preventDefault(); setBusy(true); try { await api.createJob({ ...form, tags: form.tags.split(',').map(item => item.trim()).filter(Boolean) }); setForm({ title: '', location: '', type: 'Full-time', salary: '', description: '', tags: '' }); setOpen(false); await refresh() } catch (error) { setError(error.message) } finally { setBusy(false) } }
  async function close(id) { try { await api.updateJob(id, { action: 'close' }); await refresh() } catch (error) { setError(error.message) } }
  return <div className="page-stack"><PageHeading title="JobPilot Direct roles" description="Publish roles that candidates can apply to without leaving JobPilot." action={<button className="primary-button" onClick={() => setOpen(!open)}><Plus size={17} />New role</button>} />
    {open && <form className="surface job-form" onSubmit={create}><div className="section-head"><div><h2>Draft a role</h2><p>Clear duties, realistic compensation, and no candidate fees.</p></div></div><div className="form-grid"><label>Job title<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>Location<input required value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} /></label><label>Work type<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Remote</option><option>Hybrid</option><option>Internship</option></select></label><label>Salary range<input value={form.salary} onChange={event => setForm({ ...form, salary: event.target.value })} placeholder="PKR 180,000–250,000 / month" /></label><label className="wide">Skills, comma separated<input value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} /></label><label className="wide">Description<textarea required minLength="80" rows="8" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label></div><div className="form-actions"><button type="button" className="quiet-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : overview?.company?.status === 'verified' ? 'Publish role' : 'Submit with access request'}</button></div></form>}
    <section className="surface"><div className="section-head"><div><h2>Your roles</h2><p>Direct listings stay distinct from open-market jobs.</p></div></div><div className="job-list">{(overview?.jobs || []).map(job => <article key={job.id}><div><span className={`status-dot ${job.publicationStatus}`} /> <strong>{job.title}</strong><p>{job.location} · {job.type} · {job.salary || 'Salary not listed'}</p></div><span className="job-source">{job.promoted ? 'Promoted' : 'JobPilot Direct'}</span><b>{job.publicationStatus?.replace('_', ' ')}</b>{!job.isExpired && <button className="quiet-button" onClick={() => close(job.id)}>Close</button>}</article>)}{!overview?.jobs?.length && <Empty text="Draft your first verified role." />}</div></section>
  </div>
}

function Applicants() {
  const { overview, refresh, setError } = useWorkspace(); const statuses = ['viewed', 'shortlisted', 'interview', 'offer', 'hired', 'rejected']
  async function update(id, status) { try { await api.updateApplication(id, status); await refresh() } catch (error) { setError(error.message) } }
  return <div className="page-stack"><PageHeading title="Applicants" description="Only people who deliberately applied to your company appear here." /><section className="surface applicant-list">{(overview?.applications || []).map(app => <article key={app.id}><span className="avatar large">{app.candidate?.name?.[0] || 'C'}</span><div><strong>{app.candidate?.name}</strong><p>{app.candidate?.headline} · {app.candidate?.location || 'Location private'}</p><small>{app.job?.title} · applied {new Date(app.createdAt).toLocaleDateString()}</small><div className="skill-row">{(app.candidate?.skills || []).slice(0, 6).map(skill => <span key={skill}>{skill}</span>)}</div></div><div className="applicant-actions"><select value={app.status} onChange={event => update(app.id, event.target.value)}><option value="applied">Applied</option>{statuses.map(status => <option key={status}>{status}</option>)}</select><Link className="quiet-button" to="/messages">Open conversation</Link></div></article>)}{!overview?.applications?.length && <Empty text="Applicants will appear after a candidate submits a verified CV to your role." />}</section></div>
}

function Messages({ user }) {
  const { overview, refresh, setError } = useWorkspace(); const [selected, setSelected] = useState(null); const [messages, setMessages] = useState([]); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false)
  const conversations = overview?.conversations || []
  const load = useCallback(async id => { try { const payload = await api.messages(id); setMessages(payload.messages); await api.markRead(id) } catch (error) { setError(error.message) } }, [])
  useEffect(() => { if (!selected && conversations[0]) setSelected(conversations[0]); if (selected) load(selected.id) }, [selected?.id, conversations.length])
  useEffect(() => { if (!selected) return; const socket = io(marketplaceSocketOrigin(), { path: '/socket.io', withCredentials: true }); socket.emit('conversation:join', selected.id); socket.on('message:new', message => { if (message.conversationId === selected.id) setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]) }); return () => socket.close() }, [selected?.id])
  async function send(event) { event.preventDefault(); if (!selected || !body.trim()) return; setBusy(true); try { const payload = await api.sendMessage(selected.id, body); setMessages(current => current.some(item => item.id === payload.message.id) ? current : [...current, payload.message]); setBody(''); await refresh() } catch (error) { setError(error.message) } finally { setBusy(false) } }
  return <div className="page-stack"><PageHeading title="Candidate conversations" description="Private, job-linked messages with applicants only." /><section className="messages-shell"><aside>{conversations.map(conversation => { const app = (overview?.applications || []).find(item => item.id === conversation.applicationId); return <button key={conversation.id} className={selected?.id === conversation.id ? 'active' : ''} onClick={() => setSelected(conversation)}><span className="avatar">{app?.candidate?.name?.[0] || 'C'}</span><span><strong>{app?.candidate?.name || 'Candidate'}</strong><small>{app?.job?.title}</small></span></button> })}{!conversations.length && <Empty text="Conversations start after a candidate applies." />}</aside><div className="thread">{selected ? <><div className="thread-head"><div><strong>{(overview?.applications || []).find(item => item.id === selected.applicationId)?.candidate?.name}</strong><small>JobPilot Direct conversation</small></div><span><ShieldCheck size={15} /> Protected</span></div><div className="message-list">{messages.map(message => <div key={message.id} className={message.userId === user.id ? 'message mine' : 'message'}><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>)}</div><form className="message-compose" onSubmit={send}><textarea aria-label="Message" value={body} onChange={event => setBody(event.target.value)} placeholder="Keep hiring communication here. Never request money or sensitive identity details." /><button className="primary-button" disabled={busy || !body.trim()}><Send size={17} />Send</button></form></> : <Empty text="Choose a conversation to begin." />}</div></section></div>
}

function Team() {
  const { overview, refresh, setError } = useWorkspace(); const [email, setEmail] = useState(''); const [notice, setNotice] = useState('')
  async function invite(event) { event.preventDefault(); try { const payload = await api.inviteMember(email); setNotice(payload.delivered ? `Invitation emailed to ${email}.` : `Invitation created for ${email}. Email delivery is not configured yet.`); setEmail(''); await refresh() } catch (error) { setError(error.message) } }
  return <div className="page-stack"><PageHeading title="Recruiting team" description="One administrator and up to four recruiters share this workspace." /><section className="team-grid"><article className="surface"><div className="section-head"><div><h2>Members</h2><p>Company-domain accounts only.</p></div></div>{(overview?.members || []).map(member => <div className="compact-row" key={member.email}><span className="avatar">{member.email[0].toUpperCase()}</span><div><strong>{member.user?.name || member.email}</strong><small>{member.email}</small></div><b>{member.role}</b></div>)}</article><form className="surface invite-form" onSubmit={invite}><UserRoundPlus size={26} /><h2>Invite recruiter</h2><p>Invitations must use @{overview?.company?.domain}.</p><label>Company email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>{notice && <div className="notice">{notice}</div>}<button className="primary-button">Prepare invitation</button></form></section></div>
}

function Billing() {
  const { overview, setError } = useWorkspace(); const [busy, setBusy] = useState(false); const plus = overview?.company?.plus?.status === 'active'
  async function act() { setBusy(true); try { const payload = plus ? await api.billingPortal() : await api.startPlus(); window.location.assign(payload.url) } catch (error) { setError(error.message); setBusy(false) } }
  return <div className="page-stack"><PageHeading title="Employer Plus" description="Promote verified roles without changing their trust status." /><section className="billing-hero"><div><span><Sparkles size={17} /> Monthly visibility plan</span><h2>Stay prominent with the right candidates.</h2><p>Eligible roles appear in a clearly labeled Promoted section after candidate filters are applied. Relevance still controls the order.</p><ul><li><Check size={17} /> Promoted placement for active roles</li><li><Check size={17} /> Applicant and role-performance metrics</li><li><Check size={17} /> Verification and moderation always remain required</li></ul><button className="primary-button" disabled={busy || (!overview?.billingConfigured && !plus)} onClick={act}>{busy ? 'Opening Stripe…' : plus ? 'Manage Employer Plus' : 'Start Employer Plus'}<ArrowRight size={17} /></button>{!overview?.billingConfigured && !plus && <small>Stripe Employer Plus pricing is not configured yet.</small>}</div><aside><ShieldCheck size={32} /><strong>Promotion is not verification</strong><p>“Promoted” shows paid placement. “Verified employer” shows JobPilot’s trust review. Candidates always see both accurately.</p></aside></section></div>
}

export default function App() {
  const [ready, setReady] = useState(false); const [user, setUser] = useState(null); const [overview, setOverview] = useState(null); const [error, setError] = useState('')
  useEffect(() => { api.me().then(payload => { if (payload.user?.role === 'employer') setUser(payload.user) }).catch(() => {}).finally(() => setReady(true)) }, [])
  const refresh = useCallback(async () => { const payload = await api.overview(); setOverview(payload); setError(''); return payload }, [])
  useEffect(() => { if (user) refresh().catch(error => setError(error.message)) }, [user, refresh])
  async function logout() { try { await api.logout() } catch {} setUser(null); setOverview(null) }
  if (!ready) return <Loading />
  return <Routes><Route path="/verify-email" element={<VerifyEmailPage />} /><Route path="/invite" element={user ? <Navigate to="/dashboard" replace /> : <InvitePage onAuthenticated={setUser} />} /><Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage onAuthenticated={setUser} />} /><Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} /><Route path="/*" element={user ? <EmployerLayout user={user} overview={overview} refresh={refresh} onLogout={logout} error={error} setError={setError} /> : <Navigate to="/login" replace />} /></Routes>
}
