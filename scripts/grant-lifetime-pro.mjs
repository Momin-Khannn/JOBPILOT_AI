#!/usr/bin/env node
import crypto from 'crypto'
import { readStore, updateStore } from '../backend/src/db/store.js'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const email = args.find(arg => !arg.startsWith('--'))?.trim().toLowerCase()

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/grant-lifetime-pro.mjs <email> [--check]')
  process.exit(1)
}

function publicUserSnapshot(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    tier: user.tier || 'basic',
    billingStatus: user.billing?.status || null,
    currentPeriodEnd: user.billing?.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(user.billing?.cancelAtPeriodEnd),
    emailVerified: Boolean(user.emailVerified),
  }
}

async function checkUser() {
  const store = await readStore()
  const user = (store.users || []).find(item => String(item.email || '').toLowerCase() === email)
  if (!user) {
    console.error(`No JobPilot user found for ${email}`)
    process.exit(2)
  }
  console.log(JSON.stringify(publicUserSnapshot(user), null, 2))
}

async function grantLifetimePro() {
  let updatedUser = null
  const now = new Date().toISOString()

  await updateStore((store) => {
    const user = (store.users || []).find(item => String(item.email || '').toLowerCase() === email)
    if (!user) return

    user.status = 'active'
    user.tier = 'pro'
    user.billing = {
      customerId: user.billing?.customerId || '',
      subscriptionId: user.billing?.subscriptionId || '',
      priceId: user.billing?.priceId || 'manual_lifetime_pro',
      status: 'lifetime',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: now,
    }

    store.billingEvents ||= []
    store.billingEvents.unshift({
      id: `manual_lifetime_pro_${user.id}_${Date.now()}`,
      type: 'manual.lifetime_pro.granted',
      userId: user.id,
      processedAt: now,
    })
    store.billingEvents = store.billingEvents.slice(0, 1000)

    store.auditLogs ||= []
    store.auditLogs.unshift({
      id: crypto.randomUUID(),
      action: 'admin.lifetime_pro_granted',
      details: { userId: user.id, email: user.email },
      createdAt: now,
    })
    store.auditLogs = store.auditLogs.slice(0, 250)

    updatedUser = publicUserSnapshot(user)
  })

  if (!updatedUser) {
    console.error(`No JobPilot user found for ${email}`)
    process.exit(2)
  }

  console.log(JSON.stringify(updatedUser, null, 2))
}

if (checkOnly) {
  await checkUser()
} else {
  await grantLifetimePro()
}
