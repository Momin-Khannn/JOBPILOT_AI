import express from 'express'
import { v4 as uuid } from 'uuid'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { classifyInboxMessage } from '../services/aiService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const store = await readStore()
  res.json({ inboxEvents: store.inboxEvents || [] })
})

router.post('/classify', async (req, res) => {
  const classification = classifyInboxMessage(req.body)
  const event = {
    id: uuid(),
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
      ? store.applications.find(app => app.job.company.toLowerCase().includes(company))
      : null
    if (matchingApplication && classification.recommendedStatus) {
      matchingApplication.status = classification.recommendedStatus
      matchingApplication.lastInboxEventId = event.id
      matchingApplication.updatedAt = new Date().toISOString()
    }
  })

  await addAuditLog('inbox.classified', { eventId: event.id, intent: classification.intent })
  res.status(201).json({ event })
})

export default router
