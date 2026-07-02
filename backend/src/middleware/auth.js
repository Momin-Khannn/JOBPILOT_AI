import { deleteSessionRecord, findAuthSession, touchSessionRecord } from '../db/store.js'
import { sanitizeUser } from '../services/authService.js'
import { readSessionCredential, setSessionCookie } from '../services/sessionCookieService.js'

const sessionTtlMs = Number(process.env.SESSION_TTL_HOURS || 168) * 60 * 60 * 1000
const sessionTouchIntervalMs = Math.max(1, Number(process.env.SESSION_TOUCH_INTERVAL_MINUTES || 5)) * 60 * 1000

export function shouldTouchSession(session = {}, now = Date.now()) {
  const lastSeenAt = new Date(session.lastSeenAt || session.createdAt || 0).getTime()
  return !lastSeenAt || now - lastSeenAt >= sessionTouchIntervalMs
}

export async function requireAuth(req, res, next) {
  try {
    const { token, source } = readSessionCredential(req)
    if (!token) return res.status(401).json({ error: 'Login required' })

    const auth = await findAuthSession(token)
    if (!auth?.session) return res.status(401).json({ error: 'Session expired. Please sign in again.' })
    const { session, user } = auth

    const sessionStartedAt = new Date(session.createdAt || session.lastSeenAt || 0).getTime()
    if (!sessionStartedAt || Date.now() - sessionStartedAt > sessionTtlMs) {
      await deleteSessionRecord(session.id)
      return res.status(401).json({ error: 'Session expired. Please sign in again.' })
    }

    if (user.status !== 'active') return res.status(403).json({ error: 'This account is not active' })

    req.auth = { session, sessionId: session.id, user: sanitizeUser(user), userId: user.id }

    if (source !== 'cookie') {
      setSessionCookie(res, token, user.role)
    }

    if (shouldTouchSession(session)) {
      await touchSessionRecord(session.id)
    }

    next()
  } catch (err) {
    next(err)
  }
}

export function requireOwner(req, res, next) {
  if (!req.auth?.user || req.auth.user.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' })
  }
  next()
}

export function requireEmployer(req, res, next) {
  if (!req.auth?.user || req.auth.user.role !== 'employer') {
    return res.status(403).json({ error: 'Employer access required' })
  }
  next()
}

export function requireClient(req, res, next) {
  if (!req.auth?.user || req.auth.user.role !== 'client') {
    return res.status(403).json({ error: 'Candidate access required' })
  }
  next()
}
