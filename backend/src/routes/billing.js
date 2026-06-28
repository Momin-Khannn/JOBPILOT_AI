import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { readStore } from '../db/store.js'
import {
  billingStatus,
  constructBillingEvent,
  createCheckout,
  createPortal,
  processBillingEvent,
} from '../services/billingService.js'

const router = express.Router()
router.use(requireAuth)

function currentUser(store, userId) {
  return (store.users || []).find(item => item.id === userId && item.status === 'active')
}

router.get('/status', async (req, res) => {
  res.json(await billingStatus(req.auth.userId))
})

router.post('/checkout', async (req, res) => {
  const store = await readStore()
  const user = currentUser(store, req.auth.userId)
  if (!user) return res.status(403).json({ error: 'Active user account required.' })
  const interval = req.body.interval === 'annual' ? 'annual' : 'monthly'
  res.json(await createCheckout(user, interval))
})

router.post('/portal', async (req, res) => {
  const store = await readStore()
  const user = currentUser(store, req.auth.userId)
  if (!user) return res.status(403).json({ error: 'Active user account required.' })
  res.json(await createPortal(user))
})

export async function billingWebhook(req, res) {
  try {
    const event = constructBillingEvent(req.body, req.headers['stripe-signature'])
    const result = await processBillingEvent(event)
    res.json({ received: true, ...result })
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || 'Invalid Stripe webhook.' })
  }
}

export default router
