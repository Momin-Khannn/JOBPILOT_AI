import { BriefcaseBusiness, FileText, GraduationCap, ShieldAlert } from 'lucide-react'

export default function ApplicationInsight({ application }) {
  const report = application.decisionReport
  const tailoring = application.resumeTailoring
  const research = application.companyResearch
  const prep = application.interviewPrep

  if (!report && !tailoring && !research && !prep) return null

  return (
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
    </div>
  )
}
