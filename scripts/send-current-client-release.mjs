if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required')

const { currentClientRelease } = await import('../backend/src/releases/currentClientRelease.js')
const { runSoftwareChangeUpdateScan } = await import('../backend/src/services/softwareChangeUpdateAgentService.js')

const outcome = await runSoftwareChangeUpdateScan({ force: true })
const result = outcome.result || {}

console.log(JSON.stringify({
  releaseId: currentClientRelease.id,
  status: outcome.status,
  reason: outcome.reason || null,
  requested: result.requested || 0,
  sent: result.sent || 0,
  skipped: result.skipped || 0,
  failed: result.failed || [],
}, null, 2))

if (outcome.status !== 'sent' || result.failed?.length) process.exitCode = 1
