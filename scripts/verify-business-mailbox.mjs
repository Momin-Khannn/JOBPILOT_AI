if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL

const { businessMailStatus, verifyBusinessMailbox } = await import('../backend/src/services/emailService.js')

const verified = await verifyBusinessMailbox()
const status = await businessMailStatus()
console.log(JSON.stringify({
  verified: verified === true,
  provider: status.provider,
  gmailConnected: status.gmailConnected,
  configured: status.configured,
}, null, 2))

if (verified !== true) process.exitCode = 1
