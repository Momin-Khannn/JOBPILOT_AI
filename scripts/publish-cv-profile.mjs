#!/usr/bin/env node
import crypto from 'crypto'
import { buildProfile, slugifyProfile } from '../backend/src/services/profileService.js'
import { readStore, updateStore } from '../backend/src/db/store.js'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const email = args.find(arg => !arg.startsWith('--'))?.trim().toLowerCase()
const slugArg = args.find(arg => arg.startsWith('--slug='))?.split('=').slice(1).join('=')
const desiredSlug = slugifyProfile(slugArg || 'momin-ahmad', 'momin-ahmad')

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/publish-cv-profile.mjs <email> [--slug=momin-ahmad] [--check]')
  process.exit(1)
}

function latestResume(store, userId) {
  return (store.resumes || [])
    .filter(item => item.userId === userId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
}

function nameFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function publicSnapshot(profile) {
  if (!profile) return null
  return {
    id: profile.id,
    userId: profile.userId,
    slug: profile.slug,
    published: Boolean(profile.published),
    displayName: profile.displayName,
    headline: profile.headline,
    updatedAt: profile.updatedAt,
  }
}

async function checkProfile() {
  const store = await readStore()
  const user = (store.users || []).find(item => String(item.email || '').toLowerCase() === email)
  const profile = (store.profiles || []).find(item => item.userId === user?.id)
  const bySlug = (store.profiles || []).find(item => item.slug === desiredSlug)
  console.log(JSON.stringify({
    user: user ? { id: user.id, email: user.email, name: user.name } : null,
    profile: publicSnapshot(profile),
    bySlug: publicSnapshot(bySlug),
  }, null, 2))
  if (!user) process.exit(2)
}

async function publishProfile() {
  let saved = null
  let conflict = null
  const now = new Date().toISOString()

  await updateStore((store) => {
    const user = (store.users || []).find(item => String(item.email || '').toLowerCase() === email)
    if (!user) return

    const existing = (store.profiles || []).find(item => item.userId === user.id)
    const slugOwner = (store.profiles || []).find(item => item.userId !== user.id && item.slug === desiredSlug)
    if (slugOwner) {
      conflict = { slug: desiredSlug, ownerUserId: slugOwner.userId }
      return
    }

    const resume = latestResume(store, user.id)
    const next = buildProfile({ user, resume, existing })
    next.slug = desiredSlug
    next.published = true
    next.displayName = next.displayName || user.name || nameFromSlug(desiredSlug)
    next.headline = next.headline || resume?.profile?.topMatches?.[0] || 'Open to new opportunities'
    next.about = next.about || resume?.profile?.summary || ''
    next.updatedAt = now

    const index = (store.profiles || []).findIndex(item => item.userId === user.id)
    if (index >= 0) store.profiles[index] = next
    else {
      store.profiles ||= []
      store.profiles.push(next)
    }

    store.auditLogs ||= []
    store.auditLogs.unshift({
      id: crypto.randomUUID(),
      action: 'admin.cv_profile_published',
      details: { userId: user.id, email: user.email, slug: next.slug },
      createdAt: now,
    })
    store.auditLogs = store.auditLogs.slice(0, 250)
    saved = next
  })

  if (conflict) {
    console.error(`Slug ${conflict.slug} is already owned by ${conflict.ownerUserId}`)
    process.exit(3)
  }
  if (!saved) {
    console.error(`No JobPilot user found for ${email}`)
    process.exit(2)
  }
  console.log(JSON.stringify(publicSnapshot(saved), null, 2))
}

if (checkOnly) {
  await checkProfile()
} else {
  await publishProfile()
}
