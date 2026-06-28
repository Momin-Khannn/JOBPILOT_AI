import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BriefcaseBusiness, CheckCircle2, ChevronDown, FileText, GraduationCap, Mail, ShieldAlert, Sparkles, Zap } from 'lucide-react'
import { api } from '../api/client.js'

export default function ApplicationInsight({ application }) {
  const report = application.decisionReport
  const tailoring = application.resumeTailoring
  const research = application.companyResearch
  const prep = application.interviewPrep

  const { user } = useOutletContext() || {}
  const [upgrading, setUpgrading] = useState(false)
  const [coverLetter, setCoverLetter] = useState(application.coverLetter || null)
  const [generatingCover, setGeneratingCover] = useState(false)
  const isPro = user?.tier === 'pro'

  if (!report && !tailoring && !research && !prep && !application.coverLetter) return null

  async function handleUpgrade() {
    setUpgrading(true)
    try {
      const { url } = await api.startProCheckout('monthly')
      window.location.assign(url)
    } catch (err) {
      alert(err.message)
      setUpgrading(false)
    }
  }

  async function generateCoverLetter() {
    setGeneratingCover(true)
    try {
      const data = await api.coverLetter(application.id)
      setCoverLetter(data.coverLetter)
    } catch (err) {
      alert(err.message)
    } finally {
      setGeneratingCover(false)
    }
  }

  if (!isPro) {
    return (
      <section className="pro-insight-teaser">
        <div className="pro-insight-heading"><span><Sparkles size={15} /></span><div><strong>Pro application intelligence</strong><small>One focused report, without the clutter.</small></div></div>
        <ul>
          <li><CheckCircle2 size={13} /> ATS optimization</li>
          <li><CheckCircle2 size={13} /> Risk and match reasoning</li>
          <li><CheckCircle2 size={13} /> Cover letter and interview plan</li>
        </ul>
        <button className="button button-primary" onClick={handleUpgrade} disabled={upgrading}>
          <Zap size={14} /> {upgrading ? 'Opening checkout...' : 'Unlock Pro analysis'}
        </button>
      </section>
    )
  }

  return (
    <details className="application-insight">
      <summary><span><Sparkles size={15} /> Open application intelligence</span><ChevronDown size={16} /></summary>
      <div className="insight-grid">
      {report && (
        <article className="mini-panel">
          <h3><ShieldAlert size={16} /> Decision</h3>
          <strong className={`recommendation recommendation-${report.recommendation?.toLowerCase()}`}>
            {report.recommendation}
          </strong>
          <p>{report.reasons?.[0]}</p>
          <div className="tag-row">
            <span>Risk {report.risk?.riskLevel}</span>
            <span>Match {report.match?.matchScore}%</span>
          </div>
        </article>
      )}

      {tailoring && (
        <article className="mini-panel">
          <h3><FileText size={16} /> Resume Tailoring</h3>
          <p>{tailoring.targetedSummary}</p>
          <div className="score-strip">
            <b>ATS {tailoring.atsScoreBefore}%</b>
            <b>Optimized {tailoring.atsScoreAfter}%</b>
          </div>
        </article>
      )}

      {research && (
        <article className="mini-panel">
          <h3><BriefcaseBusiness size={16} /> Company Research</h3>
          <p>{research.summary}</p>
          <ul className="plain-list">
            {(research.hiringSignals || []).slice(0, 2).map(signal => <li key={signal}>{signal}</li>)}
          </ul>
        </article>
      )}

      {prep && (
        <article className="mini-panel">
          <h3><GraduationCap size={16} /> Interview Prep</h3>
          <p>{prep.elevatorPitch}</p>
          <div className="tag-row">
            {(prep.technicalTopics || []).slice(0, 4).map(topic => <span key={topic}>{topic}</span>)}
          </div>
        </article>
      )}
      <article className="mini-panel cover-letter-panel">
        <h3><Mail size={16} /> Cover Letter</h3>
        {coverLetter ? (
          <>
            <strong>{coverLetter.subject}</strong>
            <p className="cover-letter-preview">{coverLetter.body}</p>
            {(coverLetter.cautions || []).length > 0 && <small>{coverLetter.cautions[0]}</small>}
            <button className="button button-secondary" onClick={generateCoverLetter} disabled={generatingCover}>
              <Sparkles size={14} /> {generatingCover ? 'Regenerating...' : 'Regenerate'}
            </button>
          </>
        ) : (
          <>
            <p>Generate a concise, evidence-grounded letter using only facts from your uploaded resume.</p>
            <button className="button button-secondary" onClick={generateCoverLetter} disabled={generatingCover || !isPro}>
              <Sparkles size={14} /> {generatingCover ? 'Generating...' : 'Generate letter'}
            </button>
          </>
        )}
      </article>
      </div>
    </details>
  )
}
