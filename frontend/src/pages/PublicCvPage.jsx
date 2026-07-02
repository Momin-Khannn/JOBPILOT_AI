import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { api } from '../api/client.js'
import CvProfileView from '../components/CvProfileView.jsx'

export default function PublicCvPage() {
  const { slug } = useParams()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.publicProfile(slug)
      .then(data => setProfile(data.profile))
      .catch(err => setError(err.message))
  }, [slug])

  return (
    <main className="public-cv-shell">
      <nav className="public-cv-nav">
        <Link to="/"><ArrowLeft size={16} /> JobPilot AI</Link>
        <span>Professional CV webpage</span>
      </nav>
      {error && <div className="panel public-cv-error"><AlertCircle size={22} /><h1>CV page unavailable</h1><p>{error}</p></div>}
      {!error && !profile && <div className="panel public-cv-error"><p>Loading CV...</p></div>}
      {profile && <CvProfileView profile={profile} />}
    </main>
  )
}
