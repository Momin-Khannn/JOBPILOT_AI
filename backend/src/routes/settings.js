import express from 'express'
import { addAuditLog, deleteSessionRecord, publicSummary, readStore, updateStore } from '../db/store.js'
import { requireAuth } from '../middleware/auth.js'
import { hashPassword, sanitizeUser, verifyPassword } from '../services/authService.js'
import { loginCaptchaEnabled, loginTwoFactorEnabled } from '../services/authSecurityService.js'
import { validateRequest } from '../middleware/validate.js'
import { changePasswordBodySchema, deleteAccountBodySchema, settingsBodySchema } from '../validation/schemas.js'

const router = express.Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const store = await readStore()
  const user = (store.users || []).find(item => item.id === req.auth.userId)
  const sessions = (store.sessions || [])
    .filter(item => item.userId === req.auth.userId)
    .sort((left, right) => new Date(right.lastSeenAt || right.createdAt || 0) - new Date(left.lastSeenAt || left.createdAt || 0))
    .map(item => ({
      id: item.id,
      current: item.id === req.auth.sessionId,
      createdAt: item.createdAt,
      lastSeenAt: item.lastSeenAt || item.createdAt,
    }))
  res.json({
    user: sanitizeUser(user),
    authentication: {
      provider: user?.authProvider || 'password',
      passwordChangeAvailable: user?.authProvider !== 'google',
      lastLoginAt: user?.lastLoginAt || null,
      captchaEnabled: loginCaptchaEnabled(),
      twoFactorEnabled: loginTwoFactorEnabled(),
    },
    sessions,
    integrations: {
      gmail: {
        connected: Boolean(user?.integrations?.gmail?.connected),
        connectedEmail: user?.integrations?.gmail?.connectedEmail || '',
      },
      whatsapp: user?.integrations?.whatsapp,
    },
    summary: publicSummary(store, req.auth.userId),
  })
})

router.put('/', validateRequest({ body: settingsBodySchema }), async (req, res) => {
  let user = null
  let conflict = false
  await updateStore((store) => {
    const existing = store.users.find(item => item.id === req.auth.userId)
    if (!existing) return
    const incoming = req.body.user || {}
    const requestedEmail = String(incoming.email || existing.email).trim().toLowerCase()
    if (requestedEmail !== existing.email) {
      conflict = 'Email changes require a separate verification flow.'
      return
    }
    if (requestedEmail !== existing.email && store.users.some(item => item.id !== existing.id && item.email === requestedEmail)) {
      conflict = true
      return
    }
    const profileFields = ['name', 'phone', 'location']
    for (const field of profileFields) {
      if (incoming[field] !== undefined) existing[field] = incoming[field]
    }
    existing.email = String(existing.email || '').trim().toLowerCase()
    existing.preferences = {
      ...existing.preferences,
      ...(incoming.preferences || {}),
    }
    existing.preferences.dailySendLimit = Math.min(100, Math.max(1, Number(existing.preferences.dailySendLimit || 15)))
    user = sanitizeUser(existing)
  })
  if (conflict) return res.status(409).json({ error: typeof conflict === 'string' ? conflict : 'Another account already uses this email address' })
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user })
})

router.post('/security/sign-out-others', async (req, res) => {
  const store = await readStore()
  const sessionIds = (store.sessions || [])
    .filter(item => item.userId === req.auth.userId && item.id !== req.auth.sessionId)
    .map(item => item.id)
  await Promise.all(sessionIds.map(deleteSessionRecord))
  await addAuditLog('auth.other_sessions_revoked', { userId: req.auth.userId, count: sessionIds.length })
  res.json({ success: true, revoked: sessionIds.length })
})

router.put('/security/password', validateRequest({ body: changePasswordBodySchema }), async (req, res) => {
  let result = 'not_found'
  await updateStore((store) => {
    const user = (store.users || []).find(item => item.id === req.auth.userId)
    if (!user) return
    if (user.authProvider === 'google') {
      result = 'google'
      return
    }
    if (!verifyPassword(req.body.currentPassword, user.passwordHash)) {
      result = 'invalid'
      return
    }
    user.passwordHash = hashPassword(req.body.newPassword)
    user.passwordChangedAt = new Date().toISOString()
    store.sessions = (store.sessions || []).filter(item => item.userId !== req.auth.userId || item.id === req.auth.sessionId)
    result = 'updated'
  })
  if (result === 'google') return res.status(409).json({ error: 'This account signs in with Google. Manage its password through Google.' })
  if (result === 'invalid') return res.status(403).json({ error: 'The current password is incorrect.' })
  if (result !== 'updated') return res.status(404).json({ error: 'User not found' })
  await addAuditLog('auth.password_changed', { userId: req.auth.userId })
  res.json({ success: true, message: 'Password changed. Other sessions were signed out.' })
})

router.get('/export', async (req, res) => {
  const store = await readStore()
  const userId = req.auth.userId
  const user = (store.users || []).find(item => item.id === userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({
    exportedAt: new Date().toISOString(),
    account: sanitizeUser(user),
    resumes: (store.resumes || []).filter(item => item.userId === userId).map((item) => {
      const resume = { ...item }
      delete resume.rawText
      delete resume.fileBase64
      return resume
    }),
    profiles: (store.profiles || []).filter(item => item.userId === userId),
    applications: (store.applications || []).filter(item => item.userId === userId),
    messages: (store.messages || []).filter(item => item.userId === userId),
    followUps: (store.followUps || []).filter(item => item.userId === userId),
    inboxEvents: (store.inboxEvents || []).filter(item => item.userId === userId),
    interviewSessions: (store.interviewSessions || []).filter(item => item.userId === userId),
  })
})

router.delete('/account', validateRequest({ body: deleteAccountBodySchema }), async (req, res) => {
  if (req.body.confirmation !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm permanent account deletion.' })
  const currentStore = await readStore()
  const currentUser = (currentStore.users || []).find(item => item.id === req.auth.userId)
  if (['active', 'trialing', 'past_due'].includes(currentUser?.billing?.status)) {
    return res.status(409).json({ error: 'Cancel the paid subscription from Manage Subscription before deleting this account.' })
  }
  let deleted = false
  await updateStore((store) => {
    const user = (store.users || []).find(item => item.id === req.auth.userId)
    if (!user || user.role === 'owner') return
    const userId = req.auth.userId
    store.users = store.users.filter(item => item.id !== userId)
    store.resumes = store.resumes.filter(item => item.userId !== userId)
    store.profiles = store.profiles.filter(item => item.userId !== userId)
    store.applications = store.applications.filter(item => item.userId !== userId)
    store.messages = store.messages.filter(item => item.userId !== userId)
    store.followUps = store.followUps.filter(item => item.userId !== userId)
    store.inboxEvents = store.inboxEvents.filter(item => item.userId !== userId)
    store.sessions = store.sessions.filter(item => item.userId !== userId)
    store.interviewSessions = store.interviewSessions.filter(item => item.userId !== userId)
    store.auditLogs = store.auditLogs.filter(item => item.details?.userId !== userId)
    for (const day of Object.values(store.dailyUsage || {})) delete day[userId]
    deleted = true
  })
  if (!deleted) return res.status(404).json({ error: 'Account not found.' })
  res.json({ success: true })
})

export default router
