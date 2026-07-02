import { useEffect } from 'react'
import { ArrowLeft, LifeBuoy, SearchX, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage({ authenticated = false }) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Page not found | JobPilot AI'
    return () => { document.title = previousTitle }
  }, [])

  const primaryTarget = authenticated ? '/dashboard' : '/'
  const primaryLabel = authenticated ? 'Back to workspace' : 'Back to JobPilot'

  return (
    <main className="not-found-shell" aria-labelledby="not-found-title">
      <Link className="not-found-brand" to={primaryTarget}>
        <span><Zap size={18} /></span>
        <strong>JobPilot</strong>
      </Link>

      <section className="not-found-content">
        <div className="not-found-code" aria-hidden="true">404</div>
        <span className="not-found-icon"><SearchX size={24} /></span>
        <h1 id="not-found-title">This page doesn’t exist.</h1>
        <p>The address may be incorrect, or the page may have moved.</p>
        <div className="not-found-actions">
          <Link className="button button-primary" to={primaryTarget}><ArrowLeft size={16} /> {primaryLabel}</Link>
          <Link className="button button-ghost" to="/support"><LifeBuoy size={16} /> Contact support</Link>
        </div>
      </section>
    </main>
  )
}
