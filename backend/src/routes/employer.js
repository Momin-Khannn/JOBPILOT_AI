import crypto from 'crypto'
import express from 'express'
import { v4 as uuid } from 'uuid'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { requireAuth, requireEmployer } from '../middleware/auth.js'
import { normalizeJob } from '../services/jobService.js'
import { companyForUser, companyMember, detectUnsafeMarketplaceText, publicCompany } from '../services/marketplaceService.js'
import { createEmployerCheckout, createEmployerPortal, employerBillingConfigured } from '../services/billingService.js'
import { sendBusinessEmail } from '../services/emailService.js'

const router = express.Router()
router.use(requireAuth, requireEmployer)

function text(value, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function html(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function overviewPayload(store, userId) {
  const company = companyForUser(store, userId)
  if (!company) return { company: null, member: null, jobs: [], applications: [], conversations: [], messages: [] }
  const jobs = (store.jobs || []).filter(job => job.companyId === company.id)
  const applications = (store.applications || []).filter(application => application.companyId === company.id)
  const conversations = (store.conversations || []).filter(conversation => conversation.companyId === company.id)
  const applicationIds = new Set(applications.map(application => application.id))
  const users = store.users || []
  return {
    company: publicCompany(company),
    member: companyMember(company, userId),
    members: (company.members || []).map(member => ({ ...member, user: users.find(user => user.id === member.userId) ? { id: member.userId, name: users.find(user => user.id === member.userId)?.name } : null })),
    jobs: jobs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    applications: applications.map(application => ({ ...application, candidate: application.candidateSnapshot })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    conversations,
    messages: (store.messages || []).filter(message => message.channel === 'jobpilot_chat' && applicationIds.has(message.applicationId)).slice(0, 500),
    summary: {
      activeJobs: jobs.filter(job => job.publicationStatus === 'published' && !job.isExpired).length,
      applicants: applications.length,
      unread: (store.messages || []).filter(message => message.channel === 'jobpilot_chat' && applicationIds.has(message.applicationId) && message.userId !== userId && !(message.readBy || []).includes(userId)).length,
      interviews: applications.filter(application => application.status === 'interview').length,
      hires: applications.filter(application => application.status === 'hired').length,
    },
  }
}

router.get('/overview', async (req, res) => {
  res.json({ ...overviewPayload(await readStore(), req.auth.userId), billingConfigured: employerBillingConfigured() })
})

router.get('/billing/status', async (req, res) => {
  const company = companyForUser(await readStore(), req.auth.userId)
  if (!company) return res.status(404).json({ error: 'Company workspace not found.' })
  res.json({ configured: employerBillingConfigured(), plus: { status: company.plus?.status || 'inactive', currentPeriodEnd: company.plus?.currentPeriodEnd || null, cancelAtPeriodEnd: Boolean(company.plus?.cancelAtPeriodEnd) } })
})

router.post('/billing/checkout', async (req, res) => {
  const store = await readStore()
  const company = companyForUser(store, req.auth.userId)
  if (!company || companyMember(company, req.auth.userId)?.role !== 'admin') return res.status(403).json({ error: 'Company administrator access required.' })
  res.json(await createEmployerCheckout(req.auth.user, company))
})

router.post('/billing/portal', async (req, res) => {
  const company = companyForUser(await readStore(), req.auth.userId)
  if (!company || companyMember(company, req.auth.userId)?.role !== 'admin') return res.status(403).json({ error: 'Company administrator access required.' })
  res.json(await createEmployerPortal(company))
})

router.post('/jobs', async (req, res) => {
  const unsafe = detectUnsafeMarketplaceText([req.body.title, req.body.description, req.body.salary].filter(Boolean).join(' '))
  if (unsafe) return res.status(422).json({ error: unsafe })
  let created = null
  let companyStatus = ''
  await updateStore((store) => {
    const company = companyForUser(store, req.auth.userId)
    if (!company) return
    companyStatus = company.status
    const normalized = normalizeJob({
      ...req.body,
      company: company.name,
      source: 'JobPilot Direct',
      provider: 'jobpilot',
      recruiterEmail: '',
      recruiterPhone: '',
      applyUrl: '',
      url: '',
    })
    created = {
      ...normalized,
      id: `jobpilot-${uuid()}`,
      externalId: `direct-${uuid()}`,
      companyId: company.id,
      createdBy: req.auth.userId,
      applicationMode: 'in_app',
      publicationStatus: company.status === 'verified' ? 'published' : 'pending_approval',
      verificationStatus: company.status === 'verified' ? 'verified_employer' : 'pending',
      postedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      lastVerifiedAt: company.verifiedAt || null,
      isExpired: false,
      deadlineStatus: 'open',
      promoted: company.plus?.status === 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.jobs.unshift(created)
    if (company.status !== 'verified') {
      const request = (store.employerAccessRequests || []).find(item => item.companyId === company.id && item.status === 'pending')
      if (request && !request.firstJobId) request.firstJobId = created.id
    }
  })
  if (!created) return res.status(404).json({ error: 'Company workspace not found.' })
  await addAuditLog('employer.job_created', { jobId: created.id, companyId: created.companyId, publicationStatus: created.publicationStatus })
  res.status(201).json({ job: created, pendingApproval: companyStatus !== 'verified' })
})

router.patch('/jobs/:id', async (req, res) => {
  const unsafe = detectUnsafeMarketplaceText([req.body.title, req.body.description, req.body.salary].filter(Boolean).join(' '))
  if (unsafe) return res.status(422).json({ error: unsafe })
  let updated = null
  await updateStore((store) => {
    const company = companyForUser(store, req.auth.userId)
    const job = (store.jobs || []).find(item => item.id === req.params.id && item.companyId === company?.id)
    if (!job) return
    for (const key of ['title', 'location', 'type', 'salary', 'description', 'expiresAt']) {
      if (req.body[key] !== undefined) job[key] = text(req.body[key], key === 'description' ? 12000 : 300)
    }
    if (Array.isArray(req.body.tags)) job.tags = req.body.tags.map(item => text(item, 80)).filter(Boolean).slice(0, 20)
    if (req.body.action === 'close') {
      job.publicationStatus = 'closed'
      job.deadlineStatus = 'closed'
      job.closedAt = new Date().toISOString()
      job.isExpired = true
    }
    if (req.body.action === 'publish' && company?.status === 'verified') {
      job.publicationStatus = 'published'
      job.deadlineStatus = 'open'
      job.closedAt = null
      job.isExpired = false
    }
    job.updatedAt = new Date().toISOString()
    updated = job
  })
  if (!updated) return res.status(404).json({ error: 'Job not found.' })
  await addAuditLog('employer.job_updated', { jobId: updated.id, companyId: updated.companyId, publicationStatus: updated.publicationStatus })
  res.json({ job: updated })
})

router.patch('/applications/:id', async (req, res) => {
  const allowed = new Set(['viewed', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'])
  if (!allowed.has(req.body.status)) return res.status(400).json({ error: 'Choose a valid applicant status.' })
  let updated = null
  await updateStore((store) => {
    const company = companyForUser(store, req.auth.userId)
    const application = (store.applications || []).find(item => item.id === req.params.id && item.companyId === company?.id)
    if (!application) return
    application.status = req.body.status
    application.statusChangedAt = new Date().toISOString()
    application.updatedAt = application.statusChangedAt
    updated = application
    store.notifications ||= []
    store.notifications.unshift({
      id: uuid(),
      userId: application.userId,
      type: 'application_status',
      title: `${application.job?.company || company.name} updated your application`,
      detail: `Your application is now ${req.body.status}.`,
      href: '/applications',
      readAt: null,
      createdAt: new Date().toISOString(),
    })
  })
  if (!updated) return res.status(404).json({ error: 'Application not found.' })
  await addAuditLog('employer.application_updated', { applicationId: updated.id, status: updated.status })
  res.json({ application: updated })
})

router.post('/members/invite', async (req, res) => {
  const email = text(req.body.email, 254).toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid business email.' })
  let invitation = null
  let inviteToken = ''
  let companyName = ''
  let error = ''
  await updateStore((store) => {
    const company = companyForUser(store, req.auth.userId)
    const member = companyMember(company, req.auth.userId)
    if (!company || member?.role !== 'admin') { error = 'Only the company administrator can invite recruiters.'; return }
    if ((company.members || []).length >= 5) { error = 'The pilot supports one administrator and four recruiters.'; return }
    if (email.split('@')[1] !== company.domain) { error = `Use an @${company.domain} company email.`; return }
    if ((company.members || []).some(item => item.email === email)) { error = 'This recruiter is already invited.'; return }
    const token = crypto.randomBytes(24).toString('hex')
    inviteToken = token
    companyName = company.name
    invitation = { email, role: 'recruiter', status: 'invited', tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date().toISOString() }
    company.members.push(invitation)
    invitation = { ...invitation, inviteToken: process.env.NODE_ENV === 'production' ? undefined : token }
  })
  if (error) return res.status(403).json({ error })
  if (!invitation) return res.status(404).json({ error: 'Company workspace not found.' })
  const root = String(process.env.EMPLOYER_URL || `${req.protocol}://${req.get('host')}/employer`).replace(/\/$/, '')
  const inviteUrl = `${root}/invite?token=${encodeURIComponent(inviteToken)}`
  let delivered = false
  try {
    await sendBusinessEmail({
      to: email,
      subject: `${companyName} invited you to JobPilot Employers`,
      text: `You have been invited to join ${companyName}'s recruiting team on JobPilot. Accept within seven days: ${inviteUrl}`,
      html: `<p>You have been invited to join <strong>${html(companyName)}</strong>'s recruiting team on JobPilot.</p><p><a href="${html(inviteUrl)}">Accept the recruiter invitation</a></p><p>This private link expires in seven days.</p>`,
    })
    delivered = true
  } catch {
    delivered = false
  }
  await addAuditLog('employer.member_invited', { email, employerId: req.auth.userId })
  res.status(201).json({ invitation, delivered, ...(process.env.NODE_ENV !== 'production' && { inviteUrl }) })
})

export default router
