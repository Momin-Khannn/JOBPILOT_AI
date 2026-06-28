import crypto from 'crypto'

const configuredSecret = process.env.ENCRYPTION_SECRET || process.env.SESSION_SECRET
if (process.env.NODE_ENV === 'production' && !configuredSecret) {
  throw new Error('ENCRYPTION_SECRET is required in production')
}

if (process.env.ENCRYPTION_SECRET && !/^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_SECRET)) {
  throw new Error('ENCRYPTION_SECRET must be a 64-character hex string')
}

const demoSecret = 'jobpilot-demo-secret-change-me'
const derivedKey = process.env.ENCRYPTION_SECRET
  ? Buffer.from(process.env.ENCRYPTION_SECRET, 'hex')
  : crypto.scryptSync(configuredSecret || demoSecret, 'jobpilot-ai-v1', 32)

export function encryptJson(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv)
  const text = JSON.stringify(value)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  }
}

export function decryptJson(payload) {
  if (!payload?.iv || !payload?.tag || !payload?.data) return null
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(payload.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64')),
      decipher.final(),
    ])
    return JSON.parse(decrypted.toString('utf8'))
  } catch {
    const error = new Error('Failed to decrypt saved tokens. Reconnect Gmail to refresh the encrypted credentials.')
    error.status = 400
    throw error
  }
}
