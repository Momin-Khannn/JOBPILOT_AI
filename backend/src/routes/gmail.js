import express from 'express'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { decryptJson, encryptJson } from '../services/cryptoService.js'
import { createFollowUpPlan } from '../services/aiService.js'
import { exchangeCodeForTokens, getAuthUrl, sendGmail } from '../services/gmailService.js'
import { assertApprovedApplication, assertDailyLimit, incrementDailyUsage } from '../services/sendPolicy.js'

const router = express.Router()

router.get('/status', async (req, res) => {
  const store = await readStore()
  res.json({
    connected: Boolean(store.integrations?.gmail?.connected),
    email: store.integrations?.gmail?.connectedEmail || null,
    demoSend: process.env.ENABLE_REAL_SEND !== 'true',
  })
})

router.get('/auth-url', (req, res, next) => {
  try {
    res.json({ url: getAuthUrl() })
  } catch (err) {
    next(err)
  }
})

router.get('/callback', async (req, res, next) => {
  try {
    if (!req.query.code) return res.status(400).json({ error: 'Missing OAuth code' })
    const { tokens, email } = await exchangeCodeForTokens(req.query.code)
    await updateStore((store) => {
      store.integrations.gmail = {
        connected: true,
        connectedEmail: email,
        encryptedTokens: encryptJson(tokens),
        updatedAt: new Date().toISOString(),
      }
    })
    await addAuditLog('gmail.connected', { email })
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000'
    res.redirect(`${frontend}/gmail?connected=true`)
  } catch (err) {
    next(err)
  }
})

router.post('/send', async (req, res, next) => {
  try {
    const store = await readStore()
    const application = store.applications.find(item => item.id === req.body.applicationId)
    assertApprovedApplication(application)
    assertDailyLimit(store, 'gmail')

    const tokens = decryptJson(store.integrations?.gmail?.encryptedTokens)
    const draft = req.body.draft || application.draft
    const to = req.body.to || application.job.recruiterEmail
    if (!to) return res.status(400).json({ error: 'Recipient email is required' })

    const result = await sendGmail(tokens, {
      to,
      subject: draft.subject,
      body: draft.body,
      attachmentBase64: req.body.resumeBase64 || null,
      attachmentName: req.body.attachmentName || 'resume.pdf',
    })

    let updated = null
    await updateStore((nextStore) => {
      const target = nextStore.applications.find(item => item.id === application.id)
      target.status = result.demo ? 'sent_demo' : 'applied'
      target.sentAt = new Date().toISOString()
      target.updatedAt = new Date().toISOString()
      incrementDailyUsage(nextStore, 'gmail')
      nextStore.messages.unshift({
        id: result.id,
        applicationId: target.id,
        channel: 'gmail',
        to,
        subject: draft.subject,
        body: draft.body,
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

    await addAuditLog('gmail.sent', { applicationId: application.id, demo: result.demo })
    res.json({ success: true, result, application: updated })
  } catch (err) {
    next(err)
  }
})

export default router
