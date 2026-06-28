import express from 'express'
import { v4 as uuid } from 'uuid'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { requireAuth } from '../middleware/auth.js'
import { classifyInboxMessage } from '../services/aiService.js'
import { extractOfferSignal } from '../services/careerMovesService.js'

const router = express.Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const store = await readStore()
  res.json({
    inboxEvents: (store.inboxEvents || [])
      .filter(item => item.userId === req.auth.userId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
  })
})

router.post('/classify', async (req, res) => {
  const classification = classifyInboxMessage(req.body)
  const event = {
    id: uuid(),
    userId: req.auth.userId,
    from: req.body.from || '',
    subject: req.body.subject || '',
    body: req.body.body || '',
    classification,
    createdAt: new Date().toISOString(),
  }

  await updateStore((store) => {
    store.inboxEvents.unshift(event)
    store.inboxEvents = store.inboxEvents.slice(0, 100)

    const company = classification.company?.toLowerCase()
    const matchingApplication = company
      ? store.applications.find(app => app.userId === req.auth.userId && app.job?.company?.toLowerCase().includes(company))
      : null
    if (matchingApplication && classification.recommendedStatus) {
      matchingApplication.status = classification.recommendedStatus
      matchingApplication.lastInboxEventId = event.id
      matchingApplication.lastRecruiterActivityAt = event.createdAt
      matchingApplication.statusChangedAt = event.createdAt
      if (classification.intent === 'interview') matchingApplication.interviewAt = event.createdAt
      if (classification.intent === 'offer') {
        matchingApplication.offerAt = event.createdAt
        matchingApplication.offerSignal = extractOfferSignal(req.body)
      }
      matchingApplication.updatedAt = new Date().toISOString()
    }
  })

  await addAuditLog('inbox.classified', { eventId: event.id, intent: classification.intent, userId: req.auth.userId })
  res.status(201).json({ event })
})

export default router
