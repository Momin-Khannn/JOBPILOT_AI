import crypto from 'crypto'
import { v4 as uuid } from 'uuid'
import { demoUser } from '../db/seed.js'

const ownerEmail = (process.env.OWNER_EMAIL || 'owner@jobpilot.ai').toLowerCase()
const ownerPassword = process.env.OWNER_PASSWORD || (
  process.env.NODE_ENV === 'production'
    ? crypto.randomBytes(32).toString('hex')
    : 'owner12345'
)
const demoEmail = (process.env.DEMO_USER_EMAIL || 'demo@jobpilot.ai').toLowerCase()
const demoPassword = process.env.DEMO_USER_PASSWORD || 'demo12345'
const seedCreatedAt = new Date().toISOString()
export const ownerPortalEnabled = process.env.ENABLE_OWNER_PORTAL === 'true' || process.env.NODE_ENV !== 'production'

if (process.env.NODE_ENV === 'production' && ownerPortalEnabled) {
  const googleOwnerLoginConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  const passwordOwnerLoginConfigured = Boolean(process.env.OWNER_PASSWORD && process.env.OWNER_PASSWORD.length >= 12)
  if (!process.env.OWNER_EMAIL || (!googleOwnerLoginConfigured && !passwordOwnerLoginConfigured)) {
    throw new Error('OWNER_EMAIL and either Google OAuth or an OWNER_PASSWORD of at least 12 characters are required in production')
  }
  if (process.env.OWNER_PASSWORD && process.env.OWNER_PASSWORD.length < 12) {
    throw new Error('OWNER_PASSWORD must be at least 12 characters in production')
  }
}

function derive(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  return `${salt}:${derive(password, salt)}`
}

const ownerPasswordHash = hashPassword(ownerPassword)
const demoPasswordHash = hashPassword(demoPassword)

export function verifyPassword(password, hash = '') {
  try {
    const [salt, digest] = String(hash).split(':')
    if (!salt || !digest) return false
    const actual = derive(password, salt)
    const actualBuffer = Buffer.from(actual, 'hex')
    const digestBuffer = Buffer.from(digest, 'hex')
    if (actualBuffer.length !== digestBuffer.length) return false
    return crypto.timingSafeEqual(actualBuffer, digestBuffer)
  } catch {
    return false
  }
}

export function hashPasswordResetToken(token = '') {
  return crypto
    .createHmac('sha256', process.env.ENCRYPTION_SECRET || 'jobpilot-password-reset')
    .update(String(token))
    .digest('hex')
}

export function hashEmailVerificationToken(token = '') {
  return crypto
    .createHmac('sha256', process.env.ENCRYPTION_SECRET || 'jobpilot-email-verification')
    .update(String(token))
    .digest('hex')
}

export function hashSessionToken(token = '') {
  return crypto
    .createHmac('sha256', process.env.ENCRYPTION_SECRET || 'jobpilot-session-token')
    .update(String(token))
    .digest('hex')
}

function safeTokenEqual(left = '', right = '') {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function sessionMatchesToken(session = {}, token = '') {
  if (!token) return false
  if (session.tokenHash) return safeTokenEqual(session.tokenHash, hashSessionToken(token))
  return Boolean(session.token) && safeTokenEqual(session.token, token)
}

export function normalizeStoredSession(session = {}) {
  const { token, ...stored } = session
  return {
    ...stored,
    tokenHash: session.tokenHash || (token ? hashSessionToken(token) : ''),
  }
}

export function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex')
  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    createdAt: new Date().toISOString(),
  }
}

export function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex')
  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    createdAt: new Date().toISOString(),
  }
}

export function defaultIntegrations() {
  return {
    gmail: { connected: false, encryptedTokens: null, connectedEmail: null, updatedAt: null },
    whatsapp: { provider: 'twilio', connected: false, updatedAt: null },
  }
}

export function createSeedUsers() {
  return [
    {
      id: 'owner-user',
      name: 'JobPilot Owner',
      email: ownerEmail,
      role: 'owner',
      status: 'active',
      tier: 'pro',
      location: 'Pakistan',
      phone: '',
      preferences: {
        roles: [],
        locations: [],
        jobTypes: [],
        minSalary: 0,
        experienceLevel: 'Owner',
        dailySendLimit: 100,
        blacklist: [],
      },
      integrations: defaultIntegrations(),
      passwordHash: ownerPasswordHash,
      createdAt: seedCreatedAt,
      lastLoginAt: null,
    },
    {
      ...demoUser,
      id: 'seed-demo-user',
      email: demoEmail,
      role: 'client',
      status: 'active',
      tier: 'basic',
      integrations: defaultIntegrations(),
      passwordHash: demoPasswordHash,
      createdAt: seedCreatedAt,
      lastLoginAt: null,
    },
  ]
}

export function ensureUserShape(user = {}) {
  const seedUsers = createSeedUsers()
  const matchedSeed = seedUsers.find(seed =>
    (user.id && seed.id === user.id) ||
    (user.email && seed.email === String(user.email).toLowerCase())
  )

  const role = user.role || matchedSeed?.role || 'client'
  const enforceProductionOwner = role === 'owner' && ownerPortalEnabled && process.env.NODE_ENV === 'production'

  return {
    id: user.id || uuid(),
    name: user.name || matchedSeed?.name || 'JobPilot User',
    email: String(enforceProductionOwner ? ownerEmail : (user.email || matchedSeed?.email || '')).toLowerCase(),
    phone: user.phone || '',
    location: user.location || 'Pakistan',
    role,
    status: user.status || 'active',
    tier: user.tier || matchedSeed?.tier || 'basic',
    authProvider: user.authProvider || matchedSeed?.authProvider || 'password',
    googleSub: user.googleSub || matchedSeed?.googleSub || '',
    avatarUrl: user.avatarUrl || matchedSeed?.avatarUrl || '',
    emailVerified: Boolean(user.emailVerified || matchedSeed?.emailVerified),
    preferences: {
      ...demoUser.preferences,
      ...(user.preferences || {}),
    },
    skillAchievements: user.skillAchievements && typeof user.skillAchievements === 'object' && !Array.isArray(user.skillAchievements)
      ? Object.fromEntries(Object.entries(user.skillAchievements).slice(0, 100))
      : {},
    integrations: {
      ...defaultIntegrations(),
      ...(user.integrations || {}),
      gmail: {
        ...defaultIntegrations().gmail,
        ...(user.integrations?.gmail || {}),
      },
      whatsapp: {
        ...defaultIntegrations().whatsapp,
        ...(user.integrations?.whatsapp || {}),
      },
    },
    passwordHash: enforceProductionOwner
      ? ownerPasswordHash
      : user.passwordHash || matchedSeed?.passwordHash || hashPassword('changeme123'),
    passwordReset: user.passwordReset && typeof user.passwordReset === 'object'
      ? {
          tokenHash: user.passwordReset.tokenHash || '',
          expiresAt: user.passwordReset.expiresAt || null,
          createdAt: user.passwordReset.createdAt || null,
        }
      : null,
    emailVerification: user.emailVerification && typeof user.emailVerification === 'object'
      ? {
          tokenHash: user.emailVerification.tokenHash || '',
          expiresAt: user.emailVerification.expiresAt || null,
          createdAt: user.emailVerification.createdAt || null,
          sentAt: user.emailVerification.sentAt || null,
        }
      : null,
    welcomeEmailSentAt: user.welcomeEmailSentAt || null,
    termsAcceptedAt: user.termsAcceptedAt || null,
    termsVersion: user.termsVersion || null,
    billing: user.billing && typeof user.billing === 'object'
      ? {
          customerId: user.billing.customerId || '',
          subscriptionId: user.billing.subscriptionId || '',
          priceId: user.billing.priceId || '',
          status: user.billing.status || 'inactive',
          currentPeriodEnd: user.billing.currentPeriodEnd || null,
          cancelAtPeriodEnd: Boolean(user.billing.cancelAtPeriodEnd),
          updatedAt: user.billing.updatedAt || null,
        }
      : null,
    createdAt: user.createdAt || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt || null,
  }
}

export function createClientUser({ name, email, password }) {
  return ensureUserShape({
    id: uuid(),
    name: name || 'Client User',
    email,
    role: 'client',
    status: 'active',
    tier: 'basic',
    authProvider: 'password',
    emailVerified: false,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  })
}

export function createGoogleClientUser({ name, email, googleSub, picture, emailVerified }) {
  return ensureUserShape({
    id: uuid(),
    name: name || 'Google User',
    email,
    role: 'client',
    status: 'active',
    tier: 'basic',
    authProvider: 'google',
    googleSub,
    avatarUrl: picture || '',
    emailVerified,
    passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
    createdAt: new Date().toISOString(),
  })
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const createdAt = new Date().toISOString()
  return {
    token,
    session: {
      id: uuid(),
      tokenHash: hashSessionToken(token),
      userId,
      createdAt,
      lastSeenAt: createdAt,
    },
  }
}

export function sanitizeUser(user = {}) {
  const { passwordHash, passwordReset, emailVerification, googleSub, integrations = {}, billing, ...safeUser } = user
  return {
    ...safeUser,
    billing: billing ? {
      status: billing.status || 'inactive',
      currentPeriodEnd: billing.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(billing.cancelAtPeriodEnd),
    } : null,
    integrations: {
      gmail: {
        connected: Boolean(integrations.gmail?.connected),
        connectedEmail: integrations.gmail?.connectedEmail || null,
        updatedAt: integrations.gmail?.updatedAt || null,
      },
      whatsapp: {
        provider: integrations.whatsapp?.provider || 'twilio',
        connected: Boolean(integrations.whatsapp?.connected),
        updatedAt: integrations.whatsapp?.updatedAt || null,
      },
    },
  }
}
