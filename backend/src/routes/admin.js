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
    companies: (store.companies || []).slice(0, 100),
    employerAccessRequests: (store.employerAccessRequests || []).slice(0, 100),
    marketplaceReports: (store.marketplaceReports || []).slice(0, 100),
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

router.patch('/employers/:id', async (req, res) => {
  const status = String(req.body.status || '')
  if (!['verified', 'rejected', 'suspended'].includes(status)) return res.status(400).json({ error: 'Choose verified, rejected, or suspended.' })
  let company = null
  await updateStore((store) => {
    const request = (store.employerAccessRequests || []).find(item => item.id === req.params.id)
    if (!request) return
    company = (store.companies || []).find(item => item.id === request.companyId)
    if (!company) return
    const now = new Date().toISOString()
    request.status = status
    request.reviewedAt = now
    request.reviewedBy = req.auth.userId
    request.reviewNote = String(req.body.note || '').slice(0, 800)
    request.updatedAt = now
    company.status = status
    company.updatedAt = now
    if (status === 'verified') {
      company.verifiedAt = now
      company.verifiedBy = req.auth.userId
      for (const job of store.jobs || []) {
        if (job.companyId !== company.id || job.publicationStatus !== 'pending_approval') continue
        job.publicationStatus = 'published'
        job.verificationStatus = 'verified_employer'
        job.lastVerifiedAt = now
        job.updatedAt = now
      }
    } else {
      for (const job of store.jobs || []) {
        if (job.companyId !== company.id) continue
        job.publicationStatus = 'suspended'
      }
    }
    for (const user of store.users || []) {
      if (user.companyId !== company.id) continue
      if (status === 'verified') {
        user.status = 'active'
        store.notifications ||= []
        store.notifications.unshift({
          id: `notification-${Date.now()}-${user.id}`,
          userId: user.id,
          type: 'employer_verified',
          title: 'Your employer workspace is verified',
          detail: 'Your approved JobPilot Direct roles are now visible to candidates.',
          href: '/employer/jobs',
          readAt: null,
          createdAt: now,
        })
      } else if (status === 'suspended' || status === 'rejected') {
        user.status = 'suspended'
        store.sessions = (store.sessions || []).filter(session => session.userId !== user.id)
      }
    }
  })
  if (!company) return res.status(404).json({ error: 'Employer request not found.' })
  await addAuditLog('admin.employer_reviewed', { companyId: company.id, status, ownerId: req.auth.userId })
  res.json({ company })
})

router.patch('/marketplace-reports/:id', async (req, res) => {
  let report = null
  await updateStore((store) => {
    report = (store.marketplaceReports || []).find(item => item.id === req.params.id)
    if (!report) return
    report.status = ['resolved', 'dismissed'].includes(req.body.status) ? req.body.status : 'reviewing'
    report.ownerNote = String(req.body.note || '').slice(0, 1000)
    report.reviewedAt = new Date().toISOString()
    report.reviewedBy = req.auth.userId
  })
  if (!report) return res.status(404).json({ error: 'Report not found.' })
  await addAuditLog('admin.marketplace_report_updated', { reportId: report.id, status: report.status })
  res.json({ report })
})

export default router
