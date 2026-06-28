import { useEffect, useState } from 'react'
import { Cookie, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { readConsent, writeConsent } from '../utils/consent.js'
import { trackEvent } from '../utils/analytics.js'

export default function CookieConsent() {
  const [consent, setConsent] = useState(() => readConsent())

  useEffect(() => {
    function handleChange(event) {
      setConsent(event.detail || readConsent())
    }
    window.addEventListener('jobpilot-consent-change', handleChange)
    return () => window.removeEventListener('jobpilot-consent-change', handleChange)
  }, [])

  if (consent) return null

  function choose(analytics) {
    writeConsent({ analytics })
    if (analytics) trackEvent('cookie_consent_accepted', { analytics: true })
  }

  return (
    <aside className="cookie-consent" aria-label="Cookie and analytics preferences">
      <div>
        <span><Cookie size={17} /></span>
        <div>
          <strong>Privacy choices</strong>
          <p>JobPilot uses necessary browser storage for login. Optional analytics helps improve pages and features.</p>
          <Link to="/privacy">Privacy Notice</Link>
        </div>
      </div>
      <div className="cookie-actions">
        <button type="button" className="button button-ghost" onClick={() => choose(false)}>Necessary only</button>
        <button type="button" className="button button-primary" onClick={() => choose(true)}><ShieldCheck size={15} /> Allow analytics</button>
      </div>
    </aside>
  )
}
