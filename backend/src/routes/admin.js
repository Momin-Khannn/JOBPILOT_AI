import express from 'express'
import { addAuditLog, ownerSummary, readStore, updateStore } from '../db/store.js'
import { requireAuth, requireOwner } from '../middleware/auth.js'
import { refreshJobDeadlines } from '../services/jobProviderService.js'
import { sanitizeUser } from '../services/authService.js'

const router = express.Router()

router.use(requireAuth, requireOwner)

router.get('/overview', async (req, res) => {
  await updateStore((store) => refreshJobDeadlines(store))
  const store = await readStore()
  const users = (store.users || []).map(sanitizeUser)
  const applications = (store.applications || [])
    .map(app => ({
      ...app,
      user: users.find(user => user.id === app.userId) || null,
    }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 50)

  res.json({
    summary: ownerSummary(store),
    users,
    applications,
    jobs: (store.jobs || []).slice(0, 100),
    supportTickets: (store.supportTickets || []).slice(0, 50),
    analytics: {
      totalEvents: (store.analyticsEvents || []).length,
      recentPageViews: (store.analyticsEvents || []).filter(event => event.type === 'page').slice(0, 25),
      recentEvents: (store.analyticsEvents || []).filter(event => event.type === 'event').slice(0, 25),
    },
    portalUpdateState: store.portalUpdateState || null,
    providerStatus: store.providerStatus || {},
    jobSyncRuns: store.jobSyncRuns || [],
    auditLogs: (store.auditLogs || []).slice(0, 50),
    sessions: (store.sessions || []).slice(0, 50).map(session => ({
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
    })),
  })
})

router.patch('/users/:id', async (req, res) => {
  let updated = null
  await updateStore((store) => {
    const user = (store.users || []).find(item => item.id === req.params.id)
    if (!user || user.role === 'owner') return
    if (req.body.status && ['active', 'suspended'].includes(req.body.status)) {
      user.status = req.body.status
    }
    updated = sanitizeUser(user)
    if (user.status !== 'active') {
      store.sessions = (store.sessions || []).filter(item => item.userId !== user.id)
    }
  })

  if (!updated) return res.status(404).json({ error: 'User not found' })
  await addAuditLog('admin.user_updated', { userId: updated.id, status: updated.status, ownerId: req.auth.userId })
  res.json({ user: updated })
})

export default router
