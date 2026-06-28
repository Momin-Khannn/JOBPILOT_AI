if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required')

const { currentClientRelease } = await import('../backend/src/releases/currentClientRelease.js')
const { updateStore } = await import('../backend/src/db/store.js')

let updated = 0
await updateStore((store) => {
  for (const message of store.messages || []) {
    if (message.channel !== 'client_update') continue
    if (message.metadata?.releaseId !== currentClientRelease.id) continue
    if (message.status !== 'sent') continue
    message.status = 'failed'
    message.failureReason = 'smtp_credentials_rejected'
    message.failedAt = new Date().toISOString()
    updated += 1
  }
})

console.log(JSON.stringify({ releaseId: currentClientRelease.id, markedFailed: updated }, null, 2))
