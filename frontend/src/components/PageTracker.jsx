import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../utils/analytics.js'

export default function PageTracker() {
  const location = useLocation()
  const [consentVersion, setConsentVersion] = useState(0)

  useEffect(() => {
    function refresh() {
      setConsentVersion(value => value + 1)
    }
    window.addEventListener('jobpilot-consent-change', refresh)
    return () => window.removeEventListener('jobpilot-consent-change', refresh)
  }, [])

  useEffect(() => {
    trackPageView()
  }, [location.pathname, location.search, consentVersion])

  return null
}
