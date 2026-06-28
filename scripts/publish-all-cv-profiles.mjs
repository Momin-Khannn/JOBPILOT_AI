#!/usr/bin/env node
import { ensureShareableProfile } from '../backend/src/services/profileService.js'
import { readStore, updateStore } from '../backend/src/db/store.js'

const checkOnly = process.argv.includes('--check')

function latestResume(store, userId) {
  return (store.resumes || [])
    .filter(item => item.userId === userId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
}

function snapshot(store) {
  const clients = realClients(store)
  return clients.map(user => {
    const profile = (store.profiles || []).find(item => item.userId === user.id)
    return {
      email: user.email,
      userId: user.id,
      slug: profile?.slug || null,
      published: Boolean(profile?.published),
    }
  })
}

function realClients(store) {
  return (store.users || []).filter(user =>
    user.role === 'client' &&
    user.status === 'active' &&
    user.email &&
    !['seed-demo-user', 'demo-user'].includes(user.id) &&
    !String(user.email).toLowerCase().endsWith('@jobpilot.ai')
  )
}

if (checkOnly) {
  const store = await readStore()
  console.log(JSON.stringify({ clients: snapshot(store) }, null, 2))
} else {
  let result = null
  await updateStore((store) => {
    const before = snapshot(store)
    const clients = realClients(store)
    for (const user of clients) {
      ensureShareableProfile(store, user, {
        resume: latestResume(store, user.id),
        publishNew: true,
        publishExisting: true,
      })
    }
    const after = snapshot(store)
    result = {
      totalClients: clients.length,
      publishedBefore: before.filter(item => item.published).length,
      publishedAfter: after.filter(item => item.published).length,
      clients: after,
    }
  })
  console.log(JSON.stringify(result, null, 2))
}
