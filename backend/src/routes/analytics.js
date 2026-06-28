import express from 'express'
import { v4 as uuid } from 'uuid'
import { appendAnalyticsEvent } from '../db/store.js'

const router = express.Router()

function text(value = '', limit = 300) {
  return String(value || '').trim().slice(0, limit)
}

function cleanProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
      .slice(0, 20)
      .map(([key, item]) => [text(key, 60), typeof item === 'string' ? text(item, 300) : item])
  )
}

async function recordAnalyticsEvent(payload) {
  const event = {
    id: uuid(),
    type: payload.type,
    name: payload.name,
    path: text(payload.path, 500),
    title: text(payload.title, 180),
    referrer: text(payload.referrer, 500),
    sessionId: text(payload.sessionId, 120),
    properties: cleanProperties(payload.properties),
    userAgent: text(payload.userAgent, 240),
    createdAt: new Date().toISOString(),
  }

  await appendAnalyticsEvent(event)
  return event
}

router.post('/page', async (req, res) => {
  if (req.body.consent !== true) return res.json({ recorded: false })
  const event = await recordAnalyticsEvent({
    type: 'page',
    name: 'page_view',
    path: req.body.path,
    title: req.body.title,
    referrer: req.body.referrer,
    sessionId: req.body.sessionId,
    userAgent: req.get('user-agent'),
  })
  res.status(202).json({ recorded: true, id: event.id })
})

router.post('/event', async (req, res) => {
  if (req.body.consent !== true) return res.json({ recorded: false })
  const name = text(req.body.name, 80)
  if (!name) return res.status(400).json({ error: 'Event name is required.' })
  const event = await recordAnalyticsEvent({
    type: 'event',
    name,
    path: req.body.path,
    title: req.body.title,
    referrer: req.body.referrer,
    sessionId: req.body.sessionId,
    properties: req.body.properties,
    userAgent: req.get('user-agent'),
  })
  res.status(202).json({ recorded: true, id: event.id })
})

export default router
