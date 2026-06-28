import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, BadgeCheck, CheckCircle2, Circle, ExternalLink, FileUp, ShieldAlert, Sparkles, Upload } from 'lucide-react'
import { api } from '../api/client.js'

export default function ResumeManager() {
  const [resume, setResume] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [skillGap, setSkillGap] = useState(null)
  const [busySkill, setBusySkill] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')

  async function load() {
    const [resumeData, careerData] = await Promise.all([api.latestResume(), api.careerOverview()])
    setResume(resumeData.resume)
    setSkillGap(careerData.skillGap)
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

  async function upload(event) {
    event.preventDefault()
    if (!file) return
    setLoading(true)
    try {
      const data = await api.uploadResume(file)
      setResume(data.resume)
      const careerData = await api.careerOverview()
      setSkillGap(careerData.skillGap)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleSkill(skill, achieved) {
    setBusySkill(skill)
    try {
      const data = await api.markSkillAchieved(skill, achieved)
      setSkillGap(data.skillGap)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusySkill('')
    }
  }

  async function startVerification() {
    setVerificationBusy(true)
    try {
      const data = await api.startResumeVerification(resume.id)
      setVerificationSent(true)
      setVerificationMessage(`Verification code sent to ${data.emailHint}.`)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setVerificationBusy(false)
    }
  }

  async function verifyOwnership() {
    setVerificationBusy(true)
    try {
      const data = await api.verifyResumeOwnership(resume.id, verificationCode)
      setResume(data.resume)
      setVerificationMessage('CV ownership verified. Applications are now enabled for this CV.')
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setVerificationBusy(false)
    }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">CV intelligence</span>
          <h1>Resume Manager</h1>
          <p>Upload a PDF, DOCX, or text resume so the agent can score jobs and draft better applications.</p>
        </div>
      </section>

      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}

      <section className="two-column">
        <form className="panel upload-panel" onSubmit={upload}>
          <FileUp size={34} />
          <h2>Upload resume</h2>
          <p>Text-based resumes work best for parsing. Scanned image-only PDFs are rejected.</p>
          <input type="file" accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button className="button button-primary" disabled={!file || loading}>
            <Upload size={16} /> {loading ? 'Parsing...' : 'Parse resume'}
          </button>
        </form>

        <article className="panel">
          <h2>Parsed profile</h2>
          {resume ? (
            <div className="resume-summary">
              <strong>{resume.profile?.name || 'Applicant'}</strong>
              <span>{resume.profile?.email || 'No email found'} · {resume.profile?.phone || 'No phone found'}</span>
              {resume.ownership?.verified ? (
                <div className="success resume-identity-status"><BadgeCheck size={17} /> CV identity verified</div>
              ) : (
                <div className="resume-verification">
                  <div className="alert"><ShieldAlert size={17} /> Verify that this CV belongs to you before using it for applications.</div>
                  {!verificationSent ? (
                    <button type="button" className="button button-secondary" disabled={verificationBusy} onClick={startVerification}>Send code to CV email</button>
                  ) : (
                    <div className="resume-verification-code">
                      <input inputMode="numeric" maxLength="6" placeholder="6-digit code" value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                      <button type="button" className="button button-secondary" disabled={verificationBusy || verificationCode.length !== 6} onClick={verifyOwnership}>Verify CV</button>
                    </div>
                  )}
                  {verificationMessage && <small>{verificationMessage}</small>}
                </div>
              )}
              <p>{resume.profile?.summary || 'Resume profile saved.'}</p>
              <div className="score-strip">
                <b>ATS {resume.profile?.atsScore ?? '--'}%</b>
                <b>{resume.profile?.topMatches?.[0] || 'Role fit pending'}</b>
              </div>
              <div className="tag-row">
                {(resume.profile?.skills || []).map(skill => <span key={skill}>{skill}</span>)}
              </div>
              <h3>Improvements</h3>
              <ul className="plain-list">
                {(resume.profile?.gaps || []).map(gap => <li key={gap}>{gap}</li>)}
              </ul>
              <Link className="button button-secondary" to="/profile">Customize CV webpage</Link>
            </div>
          ) : (
            <p className="muted">No resume parsed yet.</p>
          )}
        </article>
      </section>

      {resume && (
        <section className="panel resume-learning-panel">
          <div className="career-panel-head">
            <div>
              <span className="eyebrow">Suggested from your CV</span>
              <h2>Your next skills</h2>
              <p>These suggestions compare the skills found in your CV with your target roles and saved jobs.</p>
            </div>
            <div className="resume-readiness"><Sparkles size={17} /><strong>{skillGap?.coverage || 0}%</strong><span>role coverage</span></div>
          </div>

          {skillGap?.gaps?.length ? (
            <div className="resume-skill-grid">
              {skillGap.gaps.slice(0, 6).map(gap => (
                <article className={`resume-skill-card ${gap.achieved ? 'is-achieved' : ''}`} key={gap.skill}>
                  <div className="resume-skill-heading">
                    <strong>{gap.skill}</strong>
                    <span className={`priority priority-${gap.priority.toLowerCase()}`}>{gap.priority}</span>
                  </div>
                  <p>{gap.evidence.length ? `Suggested from ${gap.evidence.join(', ')}` : 'Suggested for your target role'}</p>
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
                    onClick={() => toggleSkill(gap.skill, !gap.achieved)}
                  >
                    {gap.achieved ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                    {busySkill === gap.skill ? 'Saving…' : gap.achieved ? 'Achieved' : 'Mark achieved'}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="resume-learning-empty">
              <CheckCircle2 size={22} />
              <div><strong>No clear skill gaps yet</strong><p>Add a target role or save relevant jobs to generate focused suggestions.</p></div>
              <Link className="button button-secondary" to="/goal">Set career goal</Link>
            </div>
          )}
          {skillGap?.gaps?.length > 0 && <Link className="text-link resume-learning-more" to="/career-lab">Open the full four-week learning plan</Link>}
        </section>
      )}
    </div>
  )
}
