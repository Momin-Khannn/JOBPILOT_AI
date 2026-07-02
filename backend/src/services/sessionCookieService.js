const sessionTtlMs = Number(process.env.SESSION_TTL_HOURS || 168) * 60 * 60 * 1000

const cookieNames = {
  client: 'jobpilot_client_session',
  employer: 'jobpilot_employer_session',
  owner: 'jobpilot_owner_session',
}

function roleName(role) {
  if (role === 'owner') return 'owner'
  if (role === 'employer') return 'employer'
  return 'client'
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTtlMs,
  }
}

function parseCookies(header = '') {
  return String(header)
    .split(';')
    .reduce((cookies, entry) => {
      const separator = entry.indexOf('=')
      if (separator < 1) return cookies
      const key = entry.slice(0, separator).trim()
      const rawValue = entry.slice(separator + 1).trim()
      try {
        cookies[key] = decodeURIComponent(rawValue)
      } catch {
        cookies[key] = rawValue
      }
      return cookies
    }, {})
}

export function sessionCookieName(role) {
  return cookieNames[roleName(role)]
}

export function requestedPortalRole(req) {
  return roleName(String(req.headers['x-jobpilot-portal'] || '').toLowerCase())
}

export function readSessionCredential(req) {
  const authHeader = String(req.headers.authorization || '')
  if (authHeader.startsWith('Bearer ')) {
    return { token: authHeader.slice(7).trim(), source: 'bearer' }
  }

  const legacyHeader = String(req.headers['x-session-token'] || '')
  if (legacyHeader) return { token: legacyHeader, source: 'legacy-header' }

  const role = requestedPortalRole(req)
  const token = parseCookies(req.headers.cookie)[sessionCookieName(role)] || ''
  return { token, source: token ? 'cookie' : 'none' }
}

export function setSessionCookie(res, token, role) {
  if (!token) return
  res.cookie(sessionCookieName(role), token, cookieOptions())
}

export function clearSessionCookie(res, role) {
  const options = cookieOptions()
  delete options.maxAge
  res.clearCookie(sessionCookieName(role), options)
}

export function browserSessionPayload(payload) {
  if (!payload?.token) return payload
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_BEARER_TOKEN_RESPONSE === 'true') {
    return payload
  }
  const { token, ...browserPayload } = payload
  return browserPayload
}
