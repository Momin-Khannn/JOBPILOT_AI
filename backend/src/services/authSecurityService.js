import crypto from 'crypto'

const captchaChallenges = new Map()
const twoFactorChallenges = new Map()
const captchaAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const captchaTtlMs = 5 * 60 * 1000
const twoFactorTtlMs = 10 * 60 * 1000
const maximumChallenges = 1000

function signingSecret() {
  return process.env.AUTH_STATE_SECRET || process.env.ENCRYPTION_SECRET || 'jobpilot-auth-security'
}

function digest(value = '') {
  return crypto.createHmac('sha256', signingSecret()).update(String(value)).digest('hex')
}

function timingSafeMatch(value, expectedDigest) {
  const actual = Buffer.from(digest(value), 'hex')
  const expected = Buffer.from(String(expectedDigest || ''), 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function randomId() {
  return crypto.randomBytes(24).toString('base64url')
}

function prune(map) {
  const now = Date.now()
  for (const [id, challenge] of map) {
    if (challenge.expiresAt <= now) map.delete(id)
  }
  while (map.size >= maximumChallenges) map.delete(map.keys().next().value)
}

function randomCaptchaAnswer() {
  return Array.from({ length: 5 }, () => captchaAlphabet[crypto.randomInt(0, captchaAlphabet.length)]).join('')
}

function captchaSvg(answer) {
  const backgroundLines = Array.from({ length: 7 }, () => {
    const x1 = crypto.randomInt(0, 220)
    const y1 = crypto.randomInt(0, 70)
    const x2 = crypto.randomInt(0, 220)
    const y2 = crypto.randomInt(0, 70)
    const color = crypto.randomInt(0, 2) ? '#d2ad50' : '#5f806f'
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" opacity="0.42" />`
  }).join('')

  const letters = [...answer].map((character, index) => {
    const x = 27 + index * 39
    const y = 47 + crypto.randomInt(-5, 6)
    const rotation = crypto.randomInt(-16, 17)
    return `<text x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})" fill="#102019" font-family="Arial, sans-serif" font-size="34" font-weight="800">${character}</text>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70" viewBox="0 0 220 70" role="img" aria-label="Bot-check code"><rect width="220" height="70" rx="12" fill="#f5f1e7" />${backgroundLines}${letters}</svg>`
}

function maskEmail(email = '') {
  const [local = '', domain = ''] = String(email).split('@')
  if (!domain) return 'your registered email'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

export function loginCaptchaEnabled() {
  return process.env.LOGIN_CAPTCHA_ENABLED === 'true'
}

export function loginTwoFactorEnabled() {
  return process.env.LOGIN_2FA_ENABLED === 'true'
}

export function createCaptchaChallenge() {
  prune(captchaChallenges)
  const answer = randomCaptchaAnswer()
  const challengeId = randomId()
  captchaChallenges.set(challengeId, {
    answerHash: digest(answer),
    expiresAt: Date.now() + captchaTtlMs,
  })

  return {
    enabled: true,
    challengeId,
    image: `data:image/svg+xml;base64,${Buffer.from(captchaSvg(answer)).toString('base64')}`,
    expiresInSeconds: captchaTtlMs / 1000,
  }
}

export function verifyCaptchaChallenge(challengeId, answer) {
  if (!loginCaptchaEnabled()) return true
  const challenge = captchaChallenges.get(String(challengeId || ''))
  captchaChallenges.delete(String(challengeId || ''))
  if (!challenge || challenge.expiresAt <= Date.now()) return false
  return timingSafeMatch(String(answer || '').trim().toUpperCase(), challenge.answerHash)
}

export function createTwoFactorChallenge({ userId, email, role }) {
  prune(twoFactorChallenges)
  const code = String(crypto.randomInt(100000, 1000000))
  const challengeId = randomId()
  twoFactorChallenges.set(challengeId, {
    userId,
    email,
    role,
    codeHash: digest(code),
    expiresAt: Date.now() + twoFactorTtlMs,
    attempts: 0,
  })

  return {
    challengeId,
    code,
    maskedEmail: maskEmail(email),
    expiresInSeconds: twoFactorTtlMs / 1000,
  }
}

export function cancelTwoFactorChallenge(challengeId) {
  twoFactorChallenges.delete(String(challengeId || ''))
}

export function verifyTwoFactorChallenge(challengeId, code) {
  const id = String(challengeId || '')
  const challenge = twoFactorChallenges.get(id)
  if (!challenge || challenge.expiresAt <= Date.now()) {
    twoFactorChallenges.delete(id)
    return null
  }

  challenge.attempts += 1
  const valid = timingSafeMatch(String(code || '').trim(), challenge.codeHash)
  if (!valid) {
    if (challenge.attempts >= 5) twoFactorChallenges.delete(id)
    return null
  }

  twoFactorChallenges.delete(id)
  return {
    userId: challenge.userId,
    email: challenge.email,
    role: challenge.role,
  }
}
