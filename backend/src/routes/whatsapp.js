import express from 'express'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { requireAuth } from '../middleware/auth.js'
import { createFollowUpPlan } from '../services/aiService.js'
import { evaluateResumeIdentity } from '../services/resumeIdentityService.js'
import { isJobClosed, refreshJobDeadlines } from '../services/jobProviderService.js'
import { assertApprovedApplication, assertDailyLimit, assertWhatsappRecipientConsent, incrementDailyUsage } from '../services/sendPolicy.js'
import { dryRunSendEnabled, realSendEnabled, sendWhatsApp, whatsappProviderConfigured } from '../services/whatsappService.js'

const router = express.Router()
router.use(requireAuth)

router.get('/status', async (req, res) => {
  const store = await readStore()
  const user = (store.users || []).find(item => item.id === req.auth.userId)
  const provider = user?.integrations?.whatsapp?.provider || 'twilio'
  res.json({
    connected: Boolean(user?.integrations?.whatsapp?.connected),
    provider,
    realSendEnabled: realSendEnabled(),
    credentialReady: whatsappProviderConfigured(provider),
  })
})

router.post('/configure', async (req, res) => {
  const provider = req.body.provider === 'meta' ? 'meta' : 'twilio'
  const credentialReady = whatsappProviderConfigured(provider)
  if (!dryRunSendEnabled() && (!realSendEnabled() || !credentialReady)) {
    return res.status(400).json({
      error: realSendEnabled()
        ? `${provider === 'meta' ? 'Meta Cloud API' : 'Twilio WhatsApp'} credentials are not configured`
        : 'Real WhatsApp sending is disabled. Set ENABLE_REAL_SEND=true after configuring an official provider.',
    })
  }

  await updateStore((store) => {
    const user = store.users.find(item => item.id === req.auth.userId)
    if (!user) return
    user.integrations.whatsapp = {
      provider,
      connected: true,
      updatedAt: new Date().toISOString(),
    }
  })
  await addAuditLog('whatsapp.configured', { provider, userId: req.auth.userId })
  res.json({ connected: true, provider, realSendEnabled: realSendEnabled(), credentialReady })
})

router.post('/disconnect', async (req, res) => {
  await updateStore((store) => {
    const user = (store.users || []).find(item => item.id === req.auth.userId)
    if (!user) return
    user.integrations.whatsapp = {
      provider: user.integrations?.whatsapp?.provider || 'twilio',
      connected: false,
      updatedAt: new Date().toISOString(),
    }
  })
  await addAuditLog('whatsapp.disconnected', { userId: req.auth.userId })
  res.json({ success: true })
})

router.post('/send', async (req, res, next) => {
  try {
    const store = await readStore()
    const application = store.applications.find(item => item.id === req.body.applicationId && item.userId === req.auth.userId)
    if (isJobClosed(application?.job)) return res.status(409).json({ error: 'This job is closed or expired and cannot be sent' })
    assertApprovedApplication(application)
    assertWhatsappRecipientConsent(application)
    assertDailyLimit(store, req.auth.userId, 'whatsapp')

    const user = (store.users || []).find(item => item.id === req.auth.userId)
    const resume = (store.resumes || []).find(item => item.id === application.resumeId && item.userId === req.auth.userId)
    if (!resume || !(resume.ownership || evaluateResumeIdentity(resume.profile, user)).verified) {
      return res.status(403).json({ error: 'Verify the CV attached to this application before sending.' })
    }
    const provider = user?.integrations?.whatsapp?.provider || 'twilio'
    const to = application.approvalSnapshot?.recipient || application.approvalSnapshot?.job?.recruiterPhone
    const body = application.approvalSnapshot?.body
    if (!to) return res.status(400).json({ error: 'Recipient WhatsApp number is required' })
    if (!body) return res.status(400).json({ error: 'Message body is required' })

    const result = await sendWhatsApp({ provider, to, body })
    let updated = null
    await updateStore((nextStore) => {
      refreshJobDeadlines(nextStore)
      const target = nextStore.applications.find(item => item.id === application.id && item.userId === req.auth.userId)
      if (!target) return
      if (isJobClosed(target.job)) {
        target.status = 'job_closed'
        target.updatedAt = new Date().toISOString()
        updated = target
        return
      }
      target.status = result.demo ? 'sent_demo' : 'applied'
      target.sentAt = new Date().toISOString()
      target.updatedAt = new Date().toISOString()
      incrementDailyUsage(nextStore, req.auth.userId, 'whatsapp')
      nextStore.messages.unshift({
        id: result.id,
        userId: req.auth.userId,
        applicationId: target.id,
        channel: 'whatsapp',
        to,
        body,
        demo: result.demo,
        status: target.status,
        createdAt: new Date().toISOString(),
      })
      const existingFollowUp = nextStore.followUps.some(item => item.userId === req.auth.userId && item.applicationId === target.id && item.status !== 'completed')
      if (!existingFollowUp) {
        const followUp = {
          id: `followup-${Date.now()}`,
          userId: req.auth.userId,
          applicationId: target.id,
          company: target.job.company,
          role: target.job.title,
          ...createFollowUpPlan(target, 5),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        nextStore.followUps.unshift(followUp)
        target.followUp = followUp
      }
      updated = target
    })

    await addAuditLog('whatsapp.sent', { applicationId: application.id, provider, demo: result.demo, userId: req.auth.userId })
    res.json({ success: true, result, application: updated })
  } catch (err) {
    next(err)
  }
})

export default router
