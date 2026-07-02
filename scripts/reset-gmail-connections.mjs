import '../backend/src/env.js'
import { backupPostgresSnapshot, persistenceMode, readStore, updateStore } from '../backend/src/db/store.js'
import { gmailConnectionResetPlan, resetGmailConnections } from '../backend/src/services/gmailConnectionResetService.js'

if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL

const targetEmail = String(process.env.GMAIL_CUTOVER_TARGET_EMAIL || '').trim().toLowerCase()
const apply = process.argv.includes('--apply')
const persistence = persistenceMode()
const store = await readStore()
const plan = gmailConnectionResetPlan(store)

if (!apply) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    persistence,
    affectedCount: plan.affectedCount,
    ownerAffected: plan.ownerAffected,
  }, null, 2))
  process.exit(0)
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required for an applied Gmail cutover')
}
if (persistence !== 'postgresql-row-store') {
  throw new Error('POSTGRES_ROW_STORE_ENABLED=true is required for an applied Gmail cutover')
}
if (targetEmail !== 'jobaipilot@gmail.com') {
  throw new Error('Set GMAIL_CUTOVER_TARGET_EMAIL=jobaipilot@gmail.com to confirm this Gmail cutover')
}

const backup = await backupPostgresSnapshot('gmail-oauth-cutover')
const result = await updateStore(nextStore => resetGmailConnections(nextStore, { targetEmail }))

console.log(JSON.stringify({
  mode: 'applied',
  backupId: backup.id,
  affectedCount: result.affectedCount,
  ownerAffected: result.ownerAffected,
}, null, 2))
