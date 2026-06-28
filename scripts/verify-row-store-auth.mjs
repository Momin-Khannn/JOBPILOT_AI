if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required')

const { createSession } = await import('../backend/src/services/authService.js')
const { deleteSessionRecord, persistenceMode, readStore, updateStore } = await import('../backend/src/db/store.js')

const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN
const baseUrl = process.env.APP_BASE_URL || (publicDomain ? `https://${publicDomain}` : '')
if (!baseUrl) throw new Error('APP_BASE_URL or RAILWAY_PUBLIC_DOMAIN is required')

const store = await readStore()
const user = (store.users || []).find(item => item.role === 'client' && item.status === 'active')
if (!user) throw new Error('No active client is available for the authenticated smoke test')

const { token, session } = createSession(user.id)
try {
  await updateStore((nextStore) => {
    nextStore.sessions = [session, ...(nextStore.sessions || [])]
  })

  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Authenticated smoke test failed with status ${response.status}`)
  if (payload.user?.id !== user.id) throw new Error('Authenticated smoke test returned the wrong user')

  console.log(JSON.stringify({
    authenticated: true,
    status: response.status,
    persistence: persistenceMode(),
    userMatched: true,
  }, null, 2))
} finally {
  await deleteSessionRecord(session.id)
}
