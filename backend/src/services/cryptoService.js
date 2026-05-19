import crypto from 'crypto'

function key() {
  const secret = process.env.ENCRYPTION_SECRET || process.env.SESSION_SECRET || 'jobpilot-demo-secret-change-me'
  return crypto.scryptSync(secret, 'jobpilot-ai-v1', 32)
}

export function encryptJson(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
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
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString('utf8'))
}
