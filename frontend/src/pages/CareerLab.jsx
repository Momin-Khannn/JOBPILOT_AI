import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Circle,
  ExternalLink,
  Lightbulb,
  Lock,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Volume2,
  Zap,
} from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api/client.js'
import { startWavRecording } from '../utils/wavRecorder.js'

const tabs = [
  { id: 'analytics', label: 'Funnel', icon: BarChart3 },
  { id: 'skills', label: 'Skill plan', icon: BookOpenCheck },
  { id: 'interview', label: 'Interview', icon: Mic },
]

function EmptyState({ title, children }) {
  return (
    <div className="career-empty">
      <Sparkles size={22} />
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  )
}

function AnalyticsView({ analytics }) {
  const totals = analytics?.totals || {}
  const stages = analytics?.stages || []
  return (
    <div className="career-section-grid">
      <section className="career-kpis" aria-label="Application performance">
        <article><span>Response rate</span><strong>{totals.responseRate || 0}%</strong><small>{totals.responded || 0} of {totals.sent || 0} sent</small></article>
        <article><span>Interview rate</span><strong>{totals.interviewRate || 0}%</strong><small>{totals.interviews || 0} interview-stage</small></article>
        <article><span>Offer conversion</span><strong>{totals.offerRate || 0}%</strong><small>from interview to offer</small></article>
        <article><span>Typical response</span><strong>{totals.medianResponseDays == null ? '—' : `${totals.medianResponseDays}d`}</strong><small>median where timestamps exist</small></article>
      </section>

      <section className="panel funnel-panel">
        <div className="career-panel-head">
          <div><span className="eyebrow">Stage conversion</span><h2>Your application funnel</h2></div>
          <span className="data-badge">Observed data</span>
        </div>
        {totals.tracked ? (
          <div className="funnel-chart">
            {stages.map((stage, index) => (
              <div className="funnel-row" key={stage.id}>
                <div className="funnel-label"><strong>{stage.label}</strong><span>{stage.count}</span></div>
                <div className="funnel-track" aria-label={`${stage.label}: ${stage.count}, ${stage.share}% of tracked`}>
                  <span style={{ width: `${Math.max(stage.share, stage.count ? 5 : 0)}%` }} />
                </div>
                <small>{index ? `${stage.conversion}% from prior stage` : 'baseline'}</small>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No funnel yet">Queue and track applications to replace guesswork with a real baseline.</EmptyState>}
        <p className="career-data-note">{analytics?.dataNote}</p>
      </section>

      <section className="panel insight-panel">
        <div className="career-panel-head"><div><span className="eyebrow">Coach readout</span><h2>What the numbers suggest</h2></div><TrendingUp size={20} /></div>
        <div className="career-insights">
          {(analytics?.insights || []).map((insight, index) => (
            <div key={insight}><span>{index + 1}</span><p>{insight}</p></div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SkillsView({ skillGap, onToggleSkill, busySkill }) {
  const gaps = skillGap?.gaps || []
  const path = skillGap?.learningPath || []
  const ownedSkills = skillGap?.ownedSkills || []
  return (
    <div className="career-section-grid">
      <section className="skill-hero panel">
        <div>
          <span className="eyebrow">Role readiness</span>
          <h2>{skillGap?.readiness || 'Early'} fit</h2>
          <p>{skillGap?.dataNote}</p>
        </div>
        <div className="coverage-ring" style={{ '--coverage': `${skillGap?.coverage || 0}%` }}>
          <strong>{skillGap?.coverage || 0}%</strong><span>skill coverage</span>
        </div>
      </section>

      <section className="skill-inventory panel" aria-label="CV skill comparison">
        <div className="career-panel-head">
          <div><span className="eyebrow">CV comparison</span><h2>What you have versus what roles need</h2></div>
          <span className="data-badge">{ownedSkills.length} CV skills · {gaps.filter(gap => !gap.achieved).length} gaps</span>
        </div>
        <div className="skill-inventory-grid">
          <div><strong>Already evidenced in your CV</strong><p>JobPilot will not recommend courses for these unless a target role needs a deeper level.</p><div className="tag-row">{ownedSkills.slice(0, 16).map(skill => <span key={skill}>{skill}</span>)}</div></div>
          <div><strong>Recommended next</strong><p>These are missing from the CV and ranked by demand in your target jobs.</p><div className="tag-row skill-gap-tags">{gaps.filter(gap => !gap.achieved).slice(0, 8).map(gap => <span key={gap.skill}>{gap.skill}</span>)}</div></div>
        </div>
      </section>

      <section className="panel">
        <div className="career-panel-head">
          <div><span className="eyebrow">Demand map</span><h2>Skills worth closing</h2></div>
          <span className="data-badge">Inferred guidance</span>
        </div>
        {gaps.length ? (
          <div className="gap-grid">
            {gaps.map(gap => (
              <article className={`gap-card ${gap.achieved ? 'is-achieved' : ''}`} key={gap.skill}>
                <div className="gap-card-heading"><strong>{gap.skill}</strong><span className={`priority priority-${gap.priority.toLowerCase()}`}>{gap.priority}</span></div>
                <span className="missing-skill-label">Missing from CV · {gap.demand} target signal{gap.demand === 1 ? '' : 's'}</span>
                <p>{gap.reason}</p>
                <div className="study-plan-block"><strong>What to study</strong><p>{gap.goal}</p></div>
                <div className="study-plan-block"><strong>How to prove it</strong><p>{gap.project}</p></div>
                <div className="skill-resource-list" aria-label={`${gap.skill} learning resources`}>
                  {(gap.resources || []).map(resource => (
                    <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">
                      <span>{resource.provider}<small>{resource.title}</small></span><ExternalLink size={14} />
                    </a>
                  ))}
                </div>
                <button
                  className={`skill-achievement-button ${gap.achieved ? 'achieved' : ''}`}
                  disabled={busySkill === gap.skill}
                  onClick={() => onToggleSkill(gap.skill, !gap.achieved)}
                >
                  {gap.achieved ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                  {busySkill === gap.skill ? 'Saving…' : gap.achieved ? 'Achieved' : 'Mark achieved'}
                </button>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No clear gaps detected">Add a resume and a few relevant jobs to create a demand-weighted plan.</EmptyState>}
      </section>

      <section className="panel">
          <div className="career-panel-head"><div><span className="eyebrow">Four-week sprint</span><h2>Turn courses into CV evidence</h2></div><Target size={20} /></div>
        {path.length ? (
          <div className="learning-path">
            {path.map((step, index) => (
              <article className={step.achieved ? 'is-achieved' : ''} key={`${step.skill}-${step.phase}`}>
                <span className="path-index">{step.achieved ? <CheckCircle2 size={16} /> : index + 1}</span>
                <div><small>{step.week} · {step.phase}</small><strong>{step.skill}</strong><p>{step.action}</p></div>
                {step.achieved ? <CheckCircle2 className="path-status-icon" size={18} /> : <ArrowRight size={18} />}
              </article>
            ))}
          </div>
        ) : <EmptyState title="Your path needs evidence">Upload your resume and set a target role to generate a focused learning sprint.</EmptyState>}
      </section>
    </div>
  )
}

function ScorePill({ label, value }) {
  return <div className="score-pill"><span>{label}</span><strong>{value}</strong></div>
}

function InterviewView({ applications, sessions, onRefresh, user }) {
  const [selectedApplication, setSelectedApplication] = useState('')
  const [session, setSession] = useState(() => sessions.find(item => item.status === 'in_progress') || null)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  const recorderRef = useRef(null)
  const recordingTimeoutRef = useRef(null)
  const currentQuestion = session?.questions?.[session.currentIndex]
  const isPro = user?.tier === 'pro'

  useEffect(() => {
    if (!session) setSession(sessions.find(item => item.status === 'in_progress') || null)
  }, [sessions, session])

  const speechSupported = useMemo(() => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition), [])
  const recordingSupported = useMemo(() => typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext)), [])

  useEffect(() => () => {
    clearTimeout(recordingTimeoutRef.current)
    recorderRef.current?.cancel().catch(() => {})
  }, [])

  async function startInterview() {
    setBusy(true)
    try {
      const data = await api.startInterview(selectedApplication || undefined)
      setSession(data.session)
      setAnswer('')
      setFeedback(null)
      setError('')
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleUpgrade() {
    setBusy(true)
    try {
      const { url } = await api.startProCheckout('monthly')
      window.location.assign(url)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function submitAnswer(event) {
    event.preventDefault()
    if (!session) return
    setBusy(true)
    try {
      const data = await api.answerInterview(session.id, answer)
      setSession(data.session)
      setFeedback(data.feedback)
      setAnswer('')
      setError('')
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function speakQuestion() {
    if (!currentQuestion || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(currentQuestion.prompt))
  }

  function toggleDictation() {
    if (!speechSupported) return
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    let committed = answer
    recognition.onresult = (event) => {
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript
        if (event.results[index].isFinal) committed = `${committed} ${transcript}`.trim()
        else interim += transcript
      }
      setAnswer(`${committed} ${interim}`.trim())
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => {
      setListening(false)
      setError('Voice dictation could not start. You can type your answer instead.')
    }
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  async function finishRecording() {
    if (!recorderRef.current) return
    clearTimeout(recordingTimeoutRef.current)
    const recorder = recorderRef.current
    recorderRef.current = null
    setRecording(false)
    setBusy(true)
    try {
      const audio = await recorder.stop()
      if (!audio || audio.size < 2000) throw new Error('The recording was too short. Please try again with a fuller answer.')
      const data = await api.answerInterviewAudio(session.id, audio)
      setSession(data.session)
      setFeedback(data.feedback)
      setAnswer('')
      setError('')
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleRecording() {
    if (recording) {
      await finishRecording()
      return
    }
    recognitionRef.current?.stop()
    setListening(false)
    try {
      recorderRef.current = await startWavRecording()
      setRecording(true)
      setError('')
      recordingTimeoutRef.current = setTimeout(() => finishRecording(), 90_000)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!session) {
    return (
      <div className="interview-start-grid">
        <section className="panel interview-brief">
          <span className="eyebrow">Practice room</span>
          <h2>Turn interview prep into reps</h2>
          <p>Choose a role, answer five tailored questions, and get scored on clarity, evidence, relevance, and structure.</p>
          <label>Practice for
            <select value={selectedApplication} onChange={event => setSelectedApplication(event.target.value)}>
              <option value="">My primary target role</option>
              {applications.map(app => <option key={app.id} value={app.id}>{app.role} · {app.company}</option>)}
            </select>
          </label>
          {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
          {!isPro ? (
            <div className="upgrade-prompt" style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={16} /> Mock Interviews are a Pro feature</strong>
              <button className="button button-primary" disabled={busy} onClick={handleUpgrade}>
                <Zap size={16} /> {busy ? 'Opening checkout...' : 'Upgrade to Pro'}
              </button>
            </div>
          ) : (
            <button className="button button-primary" disabled={busy} onClick={startInterview}><Play size={16} /> Start five-question interview</button>
          )}
          <small className="career-data-note">Your answers stay in your private JobPilot workspace.</small>
        </section>
        <section className="panel interview-history">
          <div className="career-panel-head"><div><span className="eyebrow">Recent practice</span><h2>Session history</h2></div><BrainCircuit size={20} /></div>
          {sessions.length ? sessions.map(item => (
            <button key={item.id} onClick={() => { setSession(item); setFeedback(item.responses?.at(-1)?.feedback || null) }}>
              <span><strong>{item.role}</strong><small>{item.company} · {item.responses.length}/{item.questions.length} answered</small></span>
              <b>{item.averageScore || '—'}</b>
            </button>
          )) : <p className="muted">Your completed interviews will appear here.</p>}
        </section>
      </div>
    )
  }

  if (session.status === 'completed') {
    return (
      <div className="career-section-grid">
        <section className="panel interview-complete">
          <CheckCircle2 size={32} />
          <span className="eyebrow">Session complete</span>
          <h2>{session.role} · {session.company}</h2>
          <strong className="final-score">{session.averageScore}<small>/100</small></strong>
          <p>Your score is a coaching signal based on answer structure and evidence—not a hiring prediction.</p>
          <button className="button button-primary" onClick={() => { setSession(null); setFeedback(null) }}><RotateCcw size={16} /> Practice another role</button>
        </section>
        <section className="panel response-review">
          <div className="career-panel-head"><div><span className="eyebrow">Answer review</span><h2>Your coaching notes</h2></div></div>
          {session.responses.map((response, index) => (
            <details key={response.questionId} open={index === session.responses.length - 1}>
              <summary><span>Question {index + 1}</span>{response.question}<b>{response.feedback.overall}</b></summary>
              <p>{response.answer}</p>
              <small>{response.feedback.coachNote}</small>
            </details>
          ))}
        </section>
      </div>
    )
  }

  return (
    <div className="interview-room">
      <section className="interview-stage panel">
        <div className="interview-progress"><span style={{ width: `${(session.currentIndex / session.questions.length) * 100}%` }} /></div>
        <div className="interview-meta"><span>Question {session.currentIndex + 1} of {session.questions.length}</span><b>{currentQuestion?.type}</b></div>
        <div className="interviewer-mark"><BrainCircuit size={26} /></div>
        <h2>{currentQuestion?.prompt}</h2>
        <button className="listen-button" onClick={speakQuestion}><Volume2 size={16} /> Read question aloud</button>
        <form onSubmit={submitAnswer}>
          <label htmlFor="interview-answer">Your answer</label>
          <textarea id="interview-answer" value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Use a real example. Explain your action and the result…" />
          <div className="answer-actions">
            <button type="button" className={`button button-secondary ${recording ? 'is-listening' : ''}`} disabled={!recordingSupported || busy} onClick={toggleRecording}>
              {recording ? <MicOff size={16} /> : <Mic size={16} />} {recording ? 'Stop and analyze' : recordingSupported ? 'Record answer' : 'Recording unavailable'}
            </button>
            <button type="button" className={`button button-secondary ${listening ? 'is-listening' : ''}`} disabled={!speechSupported} onClick={toggleDictation}>
              {listening ? <MicOff size={16} /> : <Mic size={16} />} {listening ? 'Stop dictation' : speechSupported ? 'Dictate' : 'Voice unavailable'}
            </button>
            <span>{answer.trim() ? answer.trim().split(/\s+/).length : 0} words</span>
            <button className="button button-primary" disabled={busy || answer.trim().length < 20}>Submit answer <ArrowRight size={16} /></button>
          </div>
          <small className="career-data-note">Recorded answers are processed by Gemini for transcription and coaching. JobPilot stores the transcript and scores, not the audio recording.</small>
        </form>
        {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
      </section>

      <aside className="panel coach-panel">
        <div className="career-panel-head"><div><span className="eyebrow">Live coach</span><h2>{feedback ? 'Latest feedback' : 'Answer target'}</h2></div><Lightbulb size={20} /></div>
        {feedback ? (
          <>
            <div className="score-grid">
              <ScorePill label="Overall" value={feedback.overall} />
              {Object.entries(feedback.scores).map(([label, value]) => <ScorePill key={label} label={label} value={value} />)}
            </div>
            <strong className="coach-note">{feedback.coachNote}</strong>
            <div className="feedback-list">
              <span>{feedback.improvements.length ? 'Improve next' : 'What worked'}</span>
              {(feedback.improvements.length ? feedback.improvements : feedback.strengths).map(item => <p key={item}>{item}</p>)}
            </div>
          </>
        ) : (
          <div className="answer-target">
            <p>Ground the answer in one real event.</p>
            <p>Make your personal action explicit.</p>
            <p>Close with an outcome or lesson.</p>
          </div>
        )}
      </aside>
    </div>
  )
}

export default function CareerLab() {
  const [activeTab, setActiveTab] = useState('analytics')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busySkill, setBusySkill] = useState('')
  const { user } = useOutletContext() || {}

  async function load() {
    try {
      const next = await api.careerOverview()
      setData(next)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  async function toggleSkill(skill, achieved) {
    setBusySkill(skill)
    try {
      const next = await api.markSkillAchieved(skill, achieved)
      setData(current => ({ ...current, skillGap: next.skillGap }))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusySkill('')
    }
  }

  return (
    <div className="stack career-lab">
      <section className="page-heading career-heading">
        <div><span className="eyebrow">Career intelligence</span><h1>Career Lab</h1><p>Practice deliberately, measure what converts, and close the skills that matter.</p></div>
        <div className="lab-status"><BrainCircuit size={18} /><span><strong>Evidence-first coaching</strong><small>Observed data is labeled separately from inference</small></span></div>
      </section>

      <nav className="career-tabs" aria-label="Career Lab sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}><Icon size={17} />{label}</button>
        ))}
      </nav>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
      {!data && !error && <section className="panel"><p className="muted">Building your career intelligence…</p></section>}
      {data && activeTab === 'analytics' && <AnalyticsView analytics={data.analytics} />}
      {data && activeTab === 'skills' && <SkillsView skillGap={data.skillGap} onToggleSkill={toggleSkill} busySkill={busySkill} />}
      {data && activeTab === 'interview' && <InterviewView applications={data.applications} sessions={data.sessions} onRefresh={load} user={user} />}
    </div>
  )
}
