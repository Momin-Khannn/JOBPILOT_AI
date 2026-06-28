import crypto from 'crypto'

function email(value = '') {
  return String(value).trim().toLowerCase()
}

function phone(value = '') {
  return String(value).replace(/\D/g, '').slice(-10)
}

function nameTokens(value = '') {
  return new Set(String(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(token => token.length > 1))
}

function namesMatch(left, right) {
  const a = nameTokens(left)
  const b = nameTokens(right)
  if (!a.size || !b.size) return false
  const overlap = [...a].filter(token => b.has(token)).length
  return overlap >= Math.min(2, a.size, b.size)
}

export function evaluateResumeIdentity(profile = {}, user = {}) {
  const resumeEmail = email(profile.email)
  const accountEmail = email(user.email)
  const emailMatch = Boolean(resumeEmail && accountEmail && resumeEmail === accountEmail)
  const nameMatch = namesMatch(profile.name, user.name)
  const resumePhone = phone(profile.phone)
  const accountPhone = phone(user.phone)
  const phoneMatch = Boolean(resumePhone && accountPhone && resumePhone === accountPhone)
  const verified = emailMatch || (nameMatch && phoneMatch)
  const hasIdentity = Boolean(resumeEmail || profile.name || resumePhone)

  return {
    status: verified ? 'verified' : hasIdentity ? 'verification_required' : 'unverified',
    verified,
    method: emailMatch ? 'account-email' : verified ? 'name-and-phone' : null,
    resumeEmail,
    checks: { emailMatch, nameMatch, phoneMatch },
    verifiedAt: verified ? new Date().toISOString() : null,
    challenge: null,
  }
}

function secret() {
  return process.env.ENCRYPTION_SECRET || 'jobpilot-resume-identity'
}

function hash(code, resumeId) {
  return crypto.createHmac('sha256', secret()).update(`${resumeId}:${code}`).digest('hex')
}

export function createResumeVerification(resumeId) {
  const code = String(crypto.randomInt(100000, 1000000))
  return {
    code,
    challenge: {
      codeHash: hash(code, resumeId),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      attempts: 0,
    },
  }
}

export function verifyResumeCode(resume, code) {
  const challenge = resume?.ownership?.challenge
  if (!challenge?.codeHash || !challenge.expiresAt || new Date(challenge.expiresAt).getTime() <= Date.now()) return false
  if (Number(challenge.attempts || 0) >= 5) return false
  const actual = Buffer.from(hash(String(code || ''), resume.id), 'hex')
  const expected = Buffer.from(challenge.codeHash, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}
