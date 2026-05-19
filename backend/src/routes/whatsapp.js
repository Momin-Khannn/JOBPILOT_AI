import express from 'express'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { createFollowUpPlan } from '../services/aiService.js'
import { assertApprovedApplication, assertDailyLimit, incrementDailyUsage } from '../services/sendPolicy.js'
import { sendWhatsApp } from '../services/whatsappService.js'

const router = express.Router()

router.get('/status', async (req, res) => {
  const store = await readStore()
  res.json({
    connected: Boolean(store.integrations?.whatsapp?.connected),
    provider: store.integrations?.whatsapp?.provider || 'twilio',
    demoSend: process.env.ENABLE_REAL_SEND !== 'true',
  })
})

router.post('/configure', async (req, res) => {
  const provider = req.body.provider === 'meta' ? 'meta' : 'twilio'
  await updateStore((store) => {
    store.integrations.whatsapp = {
      provider,
      connected: true,
      updatedAt: new Date().toISOString(),
    }
  })
  await addAuditLog('whatsapp.configured', { provider })
  res.json({ connected: true, provider })
})

router.post('/send', async (req, res, next) => {
  try {
    const store = await readStore()
    const application = store.applications.find(item => item.id === req.body.applicationId)
    assertApprovedApplication(application)
    assertDailyLimit(store, 'whatsapp')

    const provider = req.body.provider || store.integrations?.whatsapp?.provider || 'twilio'
    const to = req.body.to || application.job.recruiterPhone
    const body = req.body.body || application.draft?.body
    if (!to) return res.status(400).json({ error: 'Recipient WhatsApp number is required' })
    if (!body) return res.status(400).json({ error: 'Message body is required' })

    const result = await sendWhatsApp({ provider, to, body })
    let updated = null
    await updateStore((nextStore) => {
      const target = nextStore.applications.find(item => item.id === application.id)
      target.status = result.demo ? 'sent_demo' : 'applied'
      target.sentAt = new Date().toISOString()
      target.updatedAt = new Date().toISOString()
      incrementDailyUsage(nextStore, 'whatsapp')
      nextStore.messages.unshift({
        id: result.id,
        applicationId: target.id,
        channel: 'whatsapp',
        to,
        body,
        demo: result.demo,
        status: target.status,
        createdAt: new Date().toISOString(),
      })
      const existingFollowUp = nextStore.followUps.some(item => item.applicationId === target.id && item.status !== 'completed')
      if (!existingFollowUp) {
        const followUp = {
          id: `followup-${Date.now()}`,
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

    await addAuditLog('whatsapp.sent', { applicationId: application.id, provider, demo: result.demo })
    res.json({ success: true, result, application: updated })
  } catch (err) {
    next(err)
  }
})

export default router
