import express from 'express'
import { publicSummary, readStore, updateStore } from '../db/store.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const store = await readStore()
  res.json({
    user: store.users?.[0],
    integrations: {
      gmail: {
        connected: Boolean(store.integrations?.gmail?.connected),
        connectedEmail: store.integrations?.gmail?.connectedEmail || '',
      },
      whatsapp: store.integrations?.whatsapp,
    },
    summary: publicSummary(store),
  })
})

router.put('/', async (req, res) => {
  let user = null
  await updateStore((store) => {
    store.users[0] = {
      ...store.users[0],
      ...req.body.user,
      preferences: {
        ...store.users[0].preferences,
        ...(req.body.user?.preferences || {}),
      },
    }
    user = store.users[0]
  })
  res.json({ user })
})

export default router
