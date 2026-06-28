import { useEffect, useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  Check,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Mail,
  MessageSquareText,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { api } from '../api/client.js'

function money(value, currency = 'USD') {
  const amount = Number(value || 0)
  if (!amount) return '--'
  return `${currency} ${amount.toLocaleString()}`
}

function stageIndex(status) {
  if (['sent', 'sent_demo'].includes(status)) return 3
  if (status === 'approved') return 2
  if (status === 'draft') return 1
  return 0
}

function WorkflowProgress({ status }) {
  const current = stageIndex(status)
  return (
    <ol className="career-move-progress" aria-label="Career move progress">
      {['Prepared', 'Approved', 'Sent'].map((label, index) => (
        <li className={current >= index + 1 ? 'complete' : current === index ? 'current' : ''} key={label}>
          <span>{current >= index + 1 ? <Check size={13} /> : index + 1}</span>{label}
        </li>
      ))}
    </ol>
  )
}

function DraftEditor({ draft, setDraft, readOnly = false }) {
  return (
    <div className="career-move-editor">
      <label>
        Subject
        <input value={draft.subject} maxLength={180} readOnly={readOnly} onChange={event => setDraft(current => ({ ...current, subject: event.target.value }))} />
      </label>
      <label>
        Message
        <textarea value={draft.body} rows={11} maxLength={6000} readOnly={readOnly} onChange={event => setDraft(current => ({ ...current, body: event.target.value }))} />
      </label>
    </div>
  )
}

function SourceLink({ href }) {
  if (!href) return null
  return <a href={href} target="_blank" rel="noreferrer">Review source <ExternalLink size={13} /></a>
}

export default function CareerMoveWorkspace({ application, mode, isPro, preferences = {}, onClose, onRefresh }) {
  const workflow = mode === 'ghosting' ? application.ghostingResolution : application.negotiation
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ subject: '', body: '' })
  const [companySignal, setCompanySignal] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [offer, setOffer] = useState({
    currency: 'USD',
    payPeriod: 'annual',
    baseSalary: '',
    annualBonus: '',
    signOnBonus: '',
    equity: '',
    benefits: '',
    deadline: '',
    notes: '',
    marketMin: '',
    marketMedian: '',
    marketMax: '',
    sourceUrl: '',
  })

  useEffect(() => {
    setError('')
    setDraft(workflow?.draft || { subject: '', body: '' })
    if (mode === 'ghosting') {
      setCompanySignal(workflow?.research?.companySignal || '')
      setSourceUrl(workflow?.research?.sourceUrl || '')
    } else {
      const saved = workflow?.offer || {}
      const market = workflow?.market || {}
      const detected = application.offerSignal?.values || []
      setOffer({
        currency: saved.currency || (/PKR/i.test(application.job?.salary || '') ? 'PKR' : preferences.salaryCurrency || 'USD'),
        payPeriod: saved.payPeriod || (/month/i.test(application.job?.salary || '') ? 'monthly' : 'annual'),
        baseSalary: saved.baseSalary || detected[0] || '',
        annualBonus: saved.annualBonus || '',
        signOnBonus: saved.signOnBonus || detected[1] || '',
        equity: saved.equity || '',
        benefits: saved.benefits || '',
        deadline: saved.deadline || application.offerSignal?.deadline || '',
        notes: saved.notes || '',
        marketMin: market.minimum || application.job?.salaryMin || '',
        marketMedian: market.median || '',
        marketMax: market.maximum || application.job?.salaryMax || '',
        sourceUrl: market.sourceUrl || '',
      })
    }
  }, [application.id, mode, preferences.salaryCurrency, workflow?.generatedAt])

  const title = mode === 'ghosting' ? 'Resolve the silence' : 'Negotiation Mode'
  const recipientReady = Boolean(application.job?.recruiterEmail)
  const sent = ['sent', 'sent_demo'].includes(workflow?.status)
  const draftLocked = workflow?.status === 'approved' || sent
  const numericOffer = useMemo(() => Object.fromEntries(
    Object.entries(offer).map(([key, value]) => [
      key,
      ['baseSalary', 'annualBonus', 'signOnBonus', 'marketMin', 'marketMedian', 'marketMax'].includes(key)
        ? Number(value || 0)
        : value,
    ]),
  ), [offer])

  async function run(action, operation) {
    setBusy(action)
    setError('')
    try {
      await operation()
      await onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  function prepare() {
    return run('prepare', () => mode === 'ghosting'
      ? api.prepareGhostingResolution(application.id, { companySignal, sourceUrl })
      : api.prepareNegotiation(application.id, numericOffer))
  }

  function saveDraft() {
    return run('save', () => mode === 'ghosting'
      ? api.updateGhostingDraft(application.id, draft)
      : api.updateNegotiationDraft(application.id, draft))
  }

  function approve() {
    return run('approve', async () => {
      if (mode === 'ghosting') {
        await api.updateGhostingDraft(application.id, draft)
        await api.approveGhostingResolution(application.id)
      } else {
        await api.updateNegotiationDraft(application.id, draft)
        await api.approveNegotiation(application.id)
      }
    })
  }

  function send() {
    return run('send', () => api.sendCareerMove(application.id, mode))
  }

  async function upgrade() {
    setBusy('upgrade')
    try {
      const { url } = await api.startProCheckout('monthly')
      window.location.assign(url)
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  return (
    <section className={`career-move-workspace career-move-${mode}`} aria-labelledby="career-move-title">
      <header className="career-move-header">
        <div className="career-move-title">
          <span>{mode === 'ghosting' ? <MessageSquareText size={19} /> : <BadgeDollarSign size={19} />}</span>
          <div>
            <h2 id="career-move-title">{title}</h2>
            <p>{application.job?.title} at {application.job?.company}</p>
          </div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close career move"><X size={18} /></button>
      </header>

      {!isPro ? (
        <div className="career-move-locked">
          <Sparkles size={22} />
          <div><strong>Available with JobPilot Pro</strong><p>Research, strategy, drafting and approval stay together in one accountable workflow.</p></div>
          <button className="button button-primary" disabled={busy === 'upgrade'} onClick={upgrade}>{busy === 'upgrade' ? 'Opening checkout...' : 'Unlock career moves'}</button>
        </div>
      ) : (
        <>
          <WorkflowProgress status={workflow?.status} />
          {error && <div className="alert" role="alert">{error}</div>}

          {mode === 'ghosting' && !workflow && (
            <div className="career-move-prepare">
              <div className="career-move-context">
                <strong>{application.agentSignals?.ghosting?.daysWaiting || 0} quiet days</strong>
                <p>{application.agentSignals?.ghosting?.reason}</p>
                <span><ShieldCheck size={15} /> JobPilot uses only your verified CV and evidence you provide.</span>
              </div>
              <div className="career-move-form">
                <label>
                  Optional company update
                  <input value={companySignal} maxLength={320} onChange={event => setCompanySignal(event.target.value)} placeholder="Example: The company launched a new developer platform" />
                </label>
                <label>
                  Source link
                  <input value={sourceUrl} type="url" maxLength={500} onChange={event => setSourceUrl(event.target.value)} placeholder="https://..." />
                </label>
                <button className="button button-primary" onClick={prepare} disabled={busy === 'prepare'}><Sparkles size={15} />{busy === 'prepare' ? 'Preparing...' : 'Prepare value-add follow-up'}</button>
              </div>
            </div>
          )}

          {mode === 'negotiation' && !workflow && (
            <div className="negotiation-inputs">
              <div className="career-move-context">
                <strong>Enter the written offer</strong>
                <p>JobPilot will separate confirmed numbers from assumptions and show exactly what supports the counter.</p>
                <span><FileCheck2 size={15} /> No salary claim is invented.</span>
              </div>
              <div className="offer-form-grid">
                <label>Currency<input value={offer.currency} maxLength={5} onChange={event => setOffer(current => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label>
                <label>Pay period<select value={offer.payPeriod} onChange={event => setOffer(current => ({ ...current, payPeriod: event.target.value }))}><option value="annual">Annual</option><option value="monthly">Monthly</option><option value="hourly">Hourly</option></select></label>
                <label>Base salary<input type="number" min="0" value={offer.baseSalary} onChange={event => setOffer(current => ({ ...current, baseSalary: event.target.value }))} /></label>
                <label>Annual bonus<input type="number" min="0" value={offer.annualBonus} onChange={event => setOffer(current => ({ ...current, annualBonus: event.target.value }))} /></label>
                <label>Sign-on bonus<input type="number" min="0" value={offer.signOnBonus} onChange={event => setOffer(current => ({ ...current, signOnBonus: event.target.value }))} /></label>
                <label>Response deadline<input value={offer.deadline} maxLength={120} onChange={event => setOffer(current => ({ ...current, deadline: event.target.value }))} /></label>
                <label>Market minimum<input type="number" min="0" value={offer.marketMin} onChange={event => setOffer(current => ({ ...current, marketMin: event.target.value }))} /></label>
                <label>Market midpoint<input type="number" min="0" value={offer.marketMedian} onChange={event => setOffer(current => ({ ...current, marketMedian: event.target.value }))} /></label>
                <label>Market maximum<input type="number" min="0" value={offer.marketMax} onChange={event => setOffer(current => ({ ...current, marketMax: event.target.value }))} /></label>
                <label className="wide">Market source<input type="url" value={offer.sourceUrl} maxLength={500} onChange={event => setOffer(current => ({ ...current, sourceUrl: event.target.value }))} placeholder="Salary report or role listing URL" /></label>
                <label className="wide">Equity<textarea rows="2" value={offer.equity} maxLength={300} onChange={event => setOffer(current => ({ ...current, equity: event.target.value }))} /></label>
                <label className="wide">Benefits and package notes<textarea rows="3" value={offer.benefits} maxLength={800} onChange={event => setOffer(current => ({ ...current, benefits: event.target.value }))} /></label>
              </div>
              <button className="button button-primary" onClick={prepare} disabled={busy === 'prepare' || !Number(offer.baseSalary)}><Sparkles size={15} />{busy === 'prepare' ? 'Building strategy...' : 'Build negotiation strategy'}</button>
            </div>
          )}

          {workflow && (
            <div className="career-move-review">
              <aside className="career-move-evidence">
                {mode === 'ghosting' ? (
                  <>
                    <h3>Why this message</h3>
                    <strong>{workflow.signal?.daysWaiting} days without a newer response</strong>
                    <p>{workflow.evidence?.achievement || workflow.evidence?.skills?.join(', ') || 'Application evidence only'}</p>
                    <span className="evidence-source"><ShieldCheck size={14} /> {workflow.evidence?.source === 'verified_resume' ? 'Verified CV evidence' : 'Application record'}</span>
                    <SourceLink href={workflow.research?.sourceUrl} />
                    <small>{workflow.research?.note}</small>
                  </>
                ) : (
                  <>
                    <h3>Counter position</h3>
                    <div className="negotiation-numbers">
                      <span><small>Offer</small><strong>{money(workflow.offer?.baseSalary, workflow.offer?.currency)}</strong></span>
                      <span><small>Target</small><strong>{money(workflow.recommendation?.targetBase, workflow.offer?.currency)}</strong></span>
                      <span><small>Change</small><strong>{workflow.recommendation?.increasePercent}%</strong></span>
                    </div>
                    <p>{workflow.recommendation?.rationale}</p>
                    <SourceLink href={workflow.market?.sourceUrl} />
                    <h3>Fallback asks</h3>
                    <ul>{(workflow.recommendation?.alternatives || []).slice(0, 3).map(item => <li key={item}>{item}</li>)}</ul>
                    <details><summary>Conversation script</summary><ol>{(workflow.conversationScript || []).map(item => <li key={item}>{item}</li>)}</ol></details>
                  </>
                )}
              </aside>
              <div className="career-move-draft">
                <div className="career-move-draft-heading"><div><h3>Review the message</h3><p>Editing requires approval again.</p></div><span><Mail size={15} />{application.job?.recruiterEmail || 'Recipient missing'}</span></div>
                <DraftEditor draft={draft} setDraft={setDraft} readOnly={draftLocked} />
                {mode === 'negotiation' && (workflow.recommendation?.cautions || []).map(item => <p className="career-move-caution" key={item}>{item}</p>)}
                <div className="career-move-actions">
                  {!sent && workflow.status !== 'approved' && <button className="button button-secondary" onClick={saveDraft} disabled={Boolean(busy)}><Save size={15} />{busy === 'save' ? 'Saving...' : 'Save draft'}</button>}
                  {!sent && workflow.status !== 'approved' && <button className="button button-primary" onClick={approve} disabled={Boolean(busy)}><CheckCircle2 size={15} />{busy === 'approve' ? 'Approving...' : 'Approve message'}</button>}
                  {workflow.status === 'approved' && <button className="button button-primary" onClick={send} disabled={Boolean(busy) || !recipientReady}><Send size={15} />{busy === 'send' ? 'Sending...' : 'Send with Gmail'}</button>}
                  {sent && <span className="career-move-sent"><CheckCircle2 size={16} /> Sent with approval</span>}
                </div>
                {!recipientReady && <p className="career-move-caution">Add a recruiter email to this application before sending.</p>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
