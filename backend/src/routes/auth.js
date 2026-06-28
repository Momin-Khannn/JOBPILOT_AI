import express from 'express'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { requireAuth } from '../middleware/auth.js'
import { businessMailReady, sendEmailVerificationEmail, sendLoginCodeEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../services/emailService.js'
import {
  cancelTwoFactorChallenge,
  createCaptchaChallenge,
  createTwoFactorChallenge,
  loginCaptchaEnabled,
  loginTwoFactorEnabled,
  verifyCaptchaChallenge,
  verifyTwoFactorChallenge,
} from '../services/authSecurityService.js'
import {
  createGoogleClientUser,
  createClientUser,
  createEmailVerificationToken,
  createPasswordResetToken,
  createSession,
  hashEmailVerificationToken,
  hashPassword,
  hashPasswordResetToken,
  ownerPortalEnabled,
  sanitizeUser,
  verifyPassword,
} from '../services/authService.js'
import {
  createOAuthState,
  exchangeGoogleSignInCode,
  cacheGoogleProfilePicture,
  getGoogleSignInUrl,
  googleCallbackUrl,
  verifyOAuthState,
} from '../services/googleAuthService.js'
import { ensureShareableProfile } from '../services/profileService.js'
import { publicFrontendUrl } from '../config/publicUrls.js'
import { validateRequest } from '../middleware/validate.js'
import {
  emailBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  tokenBodySchema,
  twoFactorBodySchema,
} from '../validation/schemas.js'

const router = express.Router()

function genericResetMessage() {
  return 'If that email belongs to a client account, a password reset link has been prepared.'
}

function emailVerificationRequired() {
  if (process.env.REQUIRE_EMAIL_VERIFICATION === 'false') return false
  if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true') return true
  return process.env.NODE_ENV === 'production'
}

function genericVerificationMessage() {
  return 'If that email belongs to an unverified client account, a new verification link has been prepared.'
}

function canReturnResetToken() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_PASSWORD_RESET_TOKEN_RESPONSE === 'true'
}

function canReturnEmailVerificationToken() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_EMAIL_VERIFICATION_TOKEN_RESPONSE === 'true'
}

function resetBaseUrl(req) {
  const configured = process.env.PASSWORD_RESET_BASE_URL || publicFrontendUrl()
  if (configured) return configured.replace(/\/$/, '')
  const origin = req.get('origin')
  if (origin) return origin.replace(/\/$/, '')
  return `${req.protocol}://${req.get('host')}`
}

function verificationBaseUrl(req) {
  const configured = process.env.EMAIL_VERIFICATION_BASE_URL || publicFrontendUrl()
  if (configured) return configured.replace(/\/$/, '')
  const origin = req.get('origin')
  if (origin) return origin.replace(/\/$/, '')
  return `${req.protocol}://${req.get('host')}`
}

function verificationUrl(req, token) {
  return `${verificationBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}`
}

async function completePasswordLogin(userId) {
  let payload = null
  await updateStore((nextStore) => {
    const targetUser = (nextStore.users || []).find(item => item.id === userId)
    if (!targetUser || targetUser.status !== 'active') return
    const { token, session } = createSession(targetUser.id)
    const otherSessions = (nextStore.sessions || []).filter(item => item.userId !== targetUser.id).slice(0, 200)
    const userSessions = (nextStore.sessions || []).filter(item => item.userId === targetUser.id).slice(0, 4)
    nextStore.sessions = [session, ...userSessions, ...otherSessions]
    targetUser.lastLoginAt = new Date().toISOString()
    payload = { token, user: sanitizeUser(targetUser) }
  })
  return payload
}

async function sendWelcomeEmailOnce(user, source) {
  if (!user?.id || !user.email || user.welcomeEmailSentAt) return

  if (!(await businessMailReady())) {
    await addAuditLog('auth.welcome_email_skipped', { userId: user.id, source, reason: 'business_mail_not_configured' })
    return
  }

  try {
    const sent = await sendWelcomeEmail({ to: user.email, name: user.name })
    if (!sent) return

    const sentAt = new Date().toISOString()
    await updateStore((store) => {
      const target = (store.users || []).find(item => item.id === user.id)
      if (target && !target.welcomeEmailSentAt) target.welcomeEmailSentAt = sentAt
    })
    await addAuditLog('auth.welcome_email_sent', { userId: user.id, source })
  } catch (error) {
    console.error('[JobPilot welcome email]', error.message)
    await addAuditLog('auth.welcome_email_failed', { userId: user.id, source })
  }
}

async function sendVerificationEmail({ req, user, token, source }) {
  if (!user?.id || !user.email || !token) return false

  if (!(await businessMailReady())) {
    await addAuditLog('auth.email_verification_skipped', { userId: user.id, source, reason: 'business_mail_not_configured' })
    return false
  }

  try {
    const sent = await sendEmailVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl: verificationUrl(req, token),
    })
    if (sent) await addAuditLog('auth.email_verification_sent', { userId: user.id, source })
    return Boolean(sent)
  } catch (error) {
    console.error('[JobPilot email verification]', error.message)
    await addAuditLog('auth.email_verification_failed', { userId: user.id, source })
    return false
  }
}

router.get('/google/auth-url', (req, res) => {
  const role = req.query.role === 'owner' ? 'owner' : 'client'
  if (role === 'owner' && !ownerPortalEnabled) {
    return res.status(404).json({ error: 'Route not found' })
  }
  const state = createOAuthState({
    role,
    intent: req.query.intent === 'signup' ? 'signup' : 'login',
    acceptedTerms: req.query.acceptedTerms === 'true',
  })
  res.json({ url: getGoogleSignInUrl(state) })
})

router.get('/security-config', (req, res) => {
  res.json({
    captchaEnabled: loginCaptchaEnabled(),
    twoFactorEnabled: loginTwoFactorEnabled(),
  })
})

router.get('/captcha', (req, res) => {
  if (!loginCaptchaEnabled()) return res.json({ enabled: false })
  res.set('Cache-Control', 'no-store')
  res.json(createCaptchaChallenge())
})

router.get('/google/callback', async (req, res, next) => {
  let callbackRole = 'client'
  try {
    if (!req.query.code) return res.redirect(googleCallbackUrl({ error: 'Google did not return an authorization code.' }))
    if (!req.query.state) return res.redirect(googleCallbackUrl({ error: 'Google sign-in state is missing.' }))

    const oauthState = verifyOAuthState(req.query.state)
    callbackRole = oauthState.role === 'owner' ? 'owner' : 'client'
    const googleProfile = await exchangeGoogleSignInCode(req.query.code)
    if (!googleProfile.emailVerified) {
      return res.redirect(googleCallbackUrl({ error: 'Google did not verify this account email.', role: callbackRole }))
    }

    if (callbackRole === 'owner') {
      if (!ownerPortalEnabled) {
        return res.redirect(googleCallbackUrl({ error: 'Owner access is not enabled.', role: 'owner' }))
      }
      if (googleProfile.email !== String(process.env.OWNER_EMAIL || '').toLowerCase()) {
        await addAuditLog('auth.owner_google_denied', { email: googleProfile.email })
        return res.redirect(googleCallbackUrl({ error: 'This Google account is not authorised for the owner portal.', role: 'owner' }))
      }

      let ownerPayload = null
      await updateStore((nextStore) => {
        const owner = (nextStore.users || []).find(item => item.role === 'owner')
        if (!owner || owner.status !== 'active') return
        owner.email = googleProfile.email
        owner.googleSub = googleProfile.googleSub
        owner.authProvider = 'google'
        owner.emailVerified = true
        owner.avatarUrl = googleProfile.picture || owner.avatarUrl || ''
        if (googleProfile.name) owner.name = googleProfile.name
        owner.lastLoginAt = new Date().toISOString()

        const { token, session } = createSession(owner.id)
        const otherSessions = (nextStore.sessions || []).filter(item => item.userId !== owner.id).slice(0, 200)
        const ownerSessions = (nextStore.sessions || []).filter(item => item.userId === owner.id).slice(0, 4)
        nextStore.sessions = [session, ...ownerSessions, ...otherSessions]
        ownerPayload = { token, user: sanitizeUser(owner) }
      })

      if (!ownerPayload) {
        return res.redirect(googleCallbackUrl({ error: 'The owner account is not active.', role: 'owner' }))
      }
      await addAuditLog('auth.owner_google_logged_in', { email: googleProfile.email })
      return res.redirect(googleCallbackUrl({ token: ownerPayload.token, role: 'owner' }))
    }
    let payload = null
    let blocked = false
    let termsRequired = false
    let action = 'auth.google_logged_in'
    let isNewClient = false

    await updateStore((nextStore) => {
      let user = (nextStore.users || []).find(item =>
        item.role === 'client' &&
        (
          (googleProfile.googleSub && item.googleSub === googleProfile.googleSub) ||
          item.email === googleProfile.email
        )
      )

      if (user && user.status !== 'active') {
        blocked = true
        return
      }

      if (!user) {
        if (!oauthState.acceptedTerms) {
          blocked = true
          termsRequired = true
          return
        }
        user = createGoogleClientUser(googleProfile)
        user.termsAcceptedAt = new Date().toISOString()
        user.termsVersion = process.env.APP_VERSION || '2.0.1'
        nextStore.users.push(user)
        action = 'auth.google_registered'
        isNewClient = true
      } else {
        user.googleSub ||= googleProfile.googleSub
        user.authProvider = 'google'
        user.emailVerified = googleProfile.emailVerified
        user.avatarUrl = googleProfile.picture || user.avatarUrl || ''
        if (googleProfile.name && (!user.name || user.name === 'JobPilot User')) user.name = googleProfile.name
      }

      user.preferences ||= {}
      if (user.preferences.productUpdatesOptIn === undefined) user.preferences.productUpdatesOptIn = true
      user.lastLoginAt = new Date().toISOString()
      ensureShareableProfile(nextStore, user, { publishNew: true })

      const { token, session } = createSession(user.id)
      const otherSessions = (nextStore.sessions || []).filter(item => item.userId !== user.id).slice(0, 200)
      const userSessions = (nextStore.sessions || []).filter(item => item.userId === user.id).slice(0, 4)
      nextStore.sessions = [session, ...userSessions, ...otherSessions]
      payload = { token, user: sanitizeUser(user) }
    })

    if (blocked || !payload) {
      return res.redirect(googleCallbackUrl({ error: termsRequired ? 'Accept the Terms and Privacy Notice on the sign-up page first.' : 'This Google account is not active in JobPilot AI.', role: callbackRole }))
    }

    await addAuditLog(action, { email: googleProfile.email, provider: 'google' })
    if (isNewClient) await sendWelcomeEmailOnce(payload.user, 'google')
    res.redirect(googleCallbackUrl({ token: payload.token, role: callbackRole }))
  } catch (err) {
    if (err.status && err.status < 500) {
      return res.redirect(googleCallbackUrl({ error: err.message, role: callbackRole }))
    }
    next(err)
  }
})

router.post('/register', validateRequest({ body: registerBodySchema }), async (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' })
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  if (req.body.acceptedTerms !== true) return res.status(400).json({ error: 'Accept the Terms and Privacy Notice to create an account.' })
  if (emailVerificationRequired() && !(await businessMailReady()) && !canReturnEmailVerificationToken()) {
    return res.status(503).json({ error: 'Email verification is not configured. Please try again later.' })
  }

  let payload = null
  let createdUser = null
  let duplicateError = false
  let verificationToken = ''
  await updateStore((nextStore) => {
    if ((nextStore.users || []).some(u => u.email === email)) {
      duplicateError = true
      return
    }
    const user = createClientUser({ name, email, password })
    user.termsAcceptedAt = new Date().toISOString()
    user.termsVersion = process.env.APP_VERSION || '2.0.1'
    const verification = createEmailVerificationToken()
    verificationToken = verification.token
    user.emailVerification = {
      tokenHash: verification.tokenHash,
      expiresAt: verification.expiresAt,
      createdAt: verification.createdAt,
      sentAt: null,
    }
    nextStore.users.push(user)
    ensureShareableProfile(nextStore, user, { publishNew: true })
    createdUser = { id: user.id, email: user.email, name: user.name }
    if (!emailVerificationRequired()) {
      const { token, session } = createSession(user.id)
      nextStore.sessions = [session, ...(nextStore.sessions || [])]
      payload = { token, user: sanitizeUser(user) }
      return
    }
    payload = { emailVerificationRequired: true, user: sanitizeUser(user) }
  })
  if (duplicateError) {
    return res.status(409).json({ error: 'An account with this email already exists. Please login instead.' })
  }

  await addAuditLog('auth.registered', { email })
  const verificationSent = await sendVerificationEmail({ req, user: createdUser, token: verificationToken, source: 'registration' })
  if (verificationSent) {
    await updateStore((store) => {
      const target = (store.users || []).find(item => item.id === createdUser.id)
      if (target?.emailVerification) target.emailVerification.sentAt = new Date().toISOString()
    })
  }
  if (!emailVerificationRequired()) await sendWelcomeEmailOnce(payload.user, 'password')

  payload.emailVerification = {
    required: emailVerificationRequired(),
    sent: verificationSent,
    message: emailVerificationRequired()
      ? 'Check your email to verify this account before logging in.'
      : 'Email verification link prepared.',
  }
  if (verificationToken && canReturnEmailVerificationToken()) {
    payload.emailVerification.verificationToken = verificationToken
    payload.emailVerification.verificationUrl = verificationUrl(req, verificationToken)
  }
  res.status(201).json(payload)
})

router.post('/login', validateRequest({ body: loginBodySchema }), async (req, res) => {
  const { email, password, role } = req.body

  if (!verifyCaptchaChallenge(req.body.captchaChallengeId, req.body.captchaAnswer)) {
    return res.status(400).json({ error: 'The bot-check code is incorrect or expired. Please try a new code.' })
  }

  if (role === 'owner' && !ownerPortalEnabled) {
    return res.status(404).json({ error: 'Route not found' })
  }
  if (role === 'owner' && !process.env.OWNER_PASSWORD) {
    return res.status(400).json({ error: 'Owner password login is not configured. Continue with Google instead.' })
  }

  const store = await readStore()
  const user = (store.users || []).find(item => item.email === email && item.role === role)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'This account is not active' })
  }
  if (role === 'client' && emailVerificationRequired() && !user.emailVerified) {
    return res.status(403).json({ error: 'Verify your email address before logging in. Use the latest verification link or request a new one.' })
  }

  if (loginTwoFactorEnabled()) {
    if (!(await businessMailReady())) {
      return res.status(503).json({ error: 'Email verification is temporarily unavailable. Please continue with Google instead.' })
    }

    const challenge = createTwoFactorChallenge({ userId: user.id, email: user.email, role })
    try {
      await sendLoginCodeEmail({ to: user.email, code: challenge.code })
    } catch (error) {
      cancelTwoFactorChallenge(challenge.challengeId)
      console.error('[JobPilot 2FA email]', error.message)
      await addAuditLog('auth.two_factor_email_failed', { userId: user.id, role })
      return res.status(503).json({ error: 'We could not send the verification code. Please try again or continue with Google.' })
    }

    await addAuditLog('auth.two_factor_requested', { userId: user.id, role })
    return res.status(202).json({
      requiresTwoFactor: true,
      challengeId: challenge.challengeId,
      maskedEmail: challenge.maskedEmail,
      expiresInSeconds: challenge.expiresInSeconds,
    })
  }

  const payload = await completePasswordLogin(user.id)
  if (!payload) return res.status(403).json({ error: 'This account is not active' })

  await addAuditLog('auth.logged_in', { email, role })
  res.json(payload)
})

router.post('/login/verify-2fa', validateRequest({ body: twoFactorBodySchema }), async (req, res) => {
  const verified = verifyTwoFactorChallenge(req.body.challengeId, req.body.code)
  if (!verified) {
    return res.status(401).json({ error: 'The verification code is incorrect or expired.' })
  }

  const store = await readStore()
  const user = (store.users || []).find(item => item.id === verified.userId && item.role === verified.role)
  if (!user || user.status !== 'active') {
    return res.status(403).json({ error: 'This account is not active' })
  }

  const payload = await completePasswordLogin(user.id)
  if (!payload) return res.status(403).json({ error: 'This account is not active' })

  await addAuditLog('auth.logged_in', { email: verified.email, role: verified.role, twoFactor: true })
  res.json(payload)
})

router.post('/verify-email', validateRequest({ body: tokenBodySchema }), async (req, res) => {
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Email verification token is required' })

  const tokenHash = hashEmailVerificationToken(token)
  let verifiedUser = null
  let expired = false

  await updateStore((nextStore) => {
    const user = (nextStore.users || []).find(item =>
      item.role === 'client' &&
      item.emailVerification?.tokenHash === tokenHash
    )
    if (!user) return
    const expiresAt = Date.parse(user.emailVerification?.expiresAt || '')
    if (!expiresAt || expiresAt <= Date.now()) {
      user.emailVerification = null
      expired = true
      return
    }
    user.emailVerified = true
    user.emailVerification = null
    verifiedUser = sanitizeUser(user)
  })

  if (!verifiedUser) {
    return res.status(400).json({ error: expired ? 'This verification link has expired. Request a new one from the login page.' : 'This verification link is invalid or has already been used.' })
  }

  await addAuditLog('auth.email_verified', { email: verifiedUser.email })
  await sendWelcomeEmailOnce(verifiedUser, 'email-verification')
  res.json({ success: true, message: 'Email verified. You can now log in.', user: verifiedUser })
})

router.post('/resend-verification', validateRequest({ body: emailBodySchema }), async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required' })
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })

  let targetUser = null
  let verificationToken = ''
  await updateStore((nextStore) => {
    const user = (nextStore.users || []).find(item => item.email === email && item.role === 'client' && item.status === 'active' && !item.emailVerified)
    if (!user) return
    const verification = createEmailVerificationToken()
    verificationToken = verification.token
    user.emailVerification = {
      tokenHash: verification.tokenHash,
      expiresAt: verification.expiresAt,
      createdAt: verification.createdAt,
      sentAt: null,
    }
    targetUser = { id: user.id, email: user.email, name: user.name }
  })

  const verificationSent = targetUser
    ? await sendVerificationEmail({ req, user: targetUser, token: verificationToken, source: 'resend' })
    : false
  if (verificationSent) {
    await updateStore((store) => {
      const target = (store.users || []).find(item => item.id === targetUser.id)
      if (target?.emailVerification) target.emailVerification.sentAt = new Date().toISOString()
    })
  }

  await addAuditLog('auth.email_verification_requested', { email })
  const payload = { success: true, message: genericVerificationMessage() }
  if (verificationToken && canReturnEmailVerificationToken()) {
    payload.emailVerification = {
      sent: verificationSent,
      verificationToken,
      verificationUrl: verificationUrl(req, verificationToken),
    }
  }
  res.json(payload)
})

router.post('/forgot-password', validateRequest({ body: emailBodySchema }), async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required' })
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })

  let resetToken = ''
  let resetUrl = ''
  await updateStore((nextStore) => {
    const user = (nextStore.users || []).find(item => item.email === email && item.role === 'client')
    if (!user || user.status !== 'active') return
    const reset = createPasswordResetToken()
    resetToken = reset.token
    user.passwordReset = {
      tokenHash: reset.tokenHash,
      expiresAt: reset.expiresAt,
      createdAt: reset.createdAt,
    }
  })

  if (resetToken) {
    resetUrl = `${resetBaseUrl(req)}/reset-password?token=${encodeURIComponent(resetToken)}`
    if (await businessMailReady()) {
      try {
        const sent = await sendPasswordResetEmail({ to: email, resetUrl })
        if (sent) await addAuditLog('auth.password_reset_email_sent', { email })
        else await addAuditLog('auth.password_reset_email_skipped', { email, reason: 'business_mail_not_configured' })
      } catch (error) {
        console.error('[JobPilot password reset email]', error.message)
        await addAuditLog('auth.password_reset_email_failed', { email })
      }
    } else {
      await addAuditLog('auth.password_reset_email_skipped', { email, reason: 'business_mail_not_configured' })
    }
  }

  await addAuditLog('auth.password_reset_requested', { email })
  const payload = { success: true, message: genericResetMessage() }
  if (resetToken && canReturnResetToken()) {
    payload.resetToken = resetToken
    payload.resetUrl = resetUrl
  }
  res.json(payload)
})

router.post('/reset-password', validateRequest({ body: resetPasswordBodySchema }), async (req, res) => {
  const { token, password } = req.body

  if (!token || !password) return res.status(400).json({ error: 'Reset token and new password are required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const tokenHash = hashPasswordResetToken(token)
  let targetUser = null

  await updateStore((nextStore) => {
    const user = (nextStore.users || []).find(item =>
      item.role === 'client' &&
      item.passwordReset?.tokenHash === tokenHash
    )
    if (!user) return
    const expiresAt = Date.parse(user.passwordReset?.expiresAt || '')
    if (!expiresAt || expiresAt <= Date.now()) {
      user.passwordReset = null
      return
    }
    user.passwordHash = hashPassword(password)
    user.emailVerified = true
    user.emailVerification = null
    user.passwordReset = null
    nextStore.sessions = (nextStore.sessions || []).filter(session => session.userId !== user.id)
    targetUser = user
  })

  if (!targetUser) {
    return res.status(400).json({ error: 'This password reset link is invalid or has expired' })
  }

  await addAuditLog('auth.password_reset_completed', { email: targetUser.email })
  res.json({ success: true, message: 'Password updated. You can now log in with your new password.' })
})

router.get('/me', requireAuth, async (req, res) => {
  let store = await readStore()
  let user = (store.users || []).find(item => item.id === req.auth.userId)
  if (user?.avatarUrl?.startsWith('https://')) {
    const cachedAvatar = await cacheGoogleProfilePicture(user.avatarUrl)
    await updateStore((nextStore) => {
      const target = (nextStore.users || []).find(item => item.id === req.auth.userId)
      if (target) target.avatarUrl = cachedAvatar
    })
    store = await readStore()
    user = (store.users || []).find(item => item.id === req.auth.userId)
  }
  res.json({ user: sanitizeUser(user) })
})

router.post('/logout', requireAuth, async (req, res) => {
  await updateStore((store) => {
    store.sessions = (store.sessions || []).filter(item => item.id !== req.auth.sessionId)
  })
  await addAuditLog('auth.logged_out', { userId: req.auth.userId })
  res.json({ success: true })
})

router.post('/upgrade', requireAuth, async (req, res) => {
  if (process.env.BILLING_TEST_MODE !== 'true') {
    return res.status(410).json({ error: 'Direct upgrades are disabled. Start a verified Stripe Checkout from Settings.' })
  }
  let updatedUser = null
  await updateStore((store) => {
    const user = (store.users || []).find(item => item.id === req.auth.userId)
    if (user && user.status === 'active') {
      user.tier = 'pro'
      updatedUser = sanitizeUser(user)
    }
  })

  if (!updatedUser) {
    return res.status(403).json({ error: 'User not found or inactive.' })
  }

  await addAuditLog('auth.upgraded_to_pro', { userId: req.auth.userId })
  res.json({ success: true, user: updatedUser })
})

export default router
