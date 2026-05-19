import { useEffect, useState } from 'react'
import { AlertCircle, FileUp, Upload } from 'lucide-react'
import { api } from '../api/client.js'

export default function ResumeManager() {
  const [resume, setResume] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const data = await api.latestResume()
    setResume(data.resume)
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
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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
          <input type="file" accept=".pdf,.doc,.docx,.txt,text/plain,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button className="button button-primary" disabled={!file || loading}>
            <Upload size={16} /> {loading ? 'Parsing...' : 'Parse resume'}
          </button>
        </form>

        <article className="panel">
          <h2>Parsed profile</h2>
          {resume ? (
            <div className="resume-summary">
              <strong>{resume.profile.name || 'Applicant'}</strong>
              <span>{resume.profile.email || 'No email found'} · {resume.profile.phone || 'No phone found'}</span>
              <p>{resume.profile.summary}</p>
              <div className="score-strip">
                <b>ATS {resume.profile.atsScore}%</b>
                <b>{resume.profile.topMatches?.[0] || 'Role fit pending'}</b>
              </div>
              <div className="tag-row">
                {(resume.profile.skills || []).map(skill => <span key={skill}>{skill}</span>)}
              </div>
              <h3>Improvements</h3>
              <ul className="plain-list">
                {(resume.profile.gaps || []).map(gap => <li key={gap}>{gap}</li>)}
              </ul>
            </div>
          ) : (
            <p className="muted">No resume parsed yet.</p>
          )}
        </article>
      </section>
    </div>
  )
}
