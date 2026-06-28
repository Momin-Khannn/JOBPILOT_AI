import { google } from 'googleapis'
import { publicBackendUrl } from '../config/publicUrls.js'

export function realSendEnabled() {
  return process.env.ENABLE_REAL_SEND === 'true'
}

export function dryRunSendEnabled() {
  return process.env.ENABLE_DRY_RUN_SEND === 'true'
}

export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${publicBackendUrl()}/api/gmail/callback`
  )
}

export function getAuthUrl(state = '') {
  if (!googleOAuthConfigured()) {
    const error = new Error('Gmail OAuth credentials are not configured')
    error.status = 400
    throw error
  }

  return getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    ...(state ? { state } : {}),
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  })
}

export async function exchangeCodeForTokens(code) {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ auth: client, version: 'v2' })
  const profile = await oauth2.userinfo.get()
  return { tokens, email: profile.data.email || '' }
}

function headerValue(value = '') {
  return String(value).replace(/[\r\n]+/g, ' ').trim()
}

function encodeMessage({ to, subject, body, attachmentBase64, attachmentName, attachmentMimeType }) {
  const boundary = `jobpilot_${Date.now()}`
  const safeTo = headerValue(to)
  const safeSubject = headerValue(subject)
  const safeName = headerValue(attachmentName || 'resume.pdf').replace(/["\\]/g, '_')
  const safeMimeType = /^[-\w.]+\/[-\w.+]+$/.test(attachmentMimeType || '') ? attachmentMimeType : 'application/octet-stream'
  const headers = [`To: ${safeTo}`, `Subject: ${safeSubject}`, 'MIME-Version: 1.0']
  let raw

  if (attachmentBase64) {
    raw = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
      '',
      `--${boundary}`,
      `Content-Type: ${safeMimeType}; name="${safeName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${safeName}"`,
      '',
      attachmentBase64,
      `--${boundary}--`,
    ].join('\r\n')
  } else {
    raw = [
      ...headers,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ].join('\r\n')
  }

  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function verifyGmailConnection(tokens) {
  if (!tokens) return false
  const client = getOAuthClient()
  client.setCredentials(tokens)
  await client.getAccessToken()
  return true
}

export async function sendGmailDirect(tokens, message) {
  if (!tokens) {
    const error = new Error('Business Gmail is not connected')
    error.status = 401
    throw error
  }

  const client = getOAuthClient()
  client.setCredentials(tokens)
  const gmail = google.gmail({ version: 'v1', auth: client })
  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeMessage(message) },
  })
  return { id: result.data.id, demo: false, status: 'sent' }
}

export async function sendGmail(tokens, message) {
  if (dryRunSendEnabled()) {
    return { id: `dry-run-gmail-${Date.now()}`, demo: true, dryRun: true, status: 'sent_demo' }
  }

  if (!realSendEnabled()) {
    const error = new Error('Real Gmail sending is disabled. Set ENABLE_REAL_SEND=true after configuring Google OAuth credentials.')
    error.status = 400
    throw error
  }

  if (!tokens) {
    const error = new Error('Gmail is not connected')
    error.status = 401
    throw error
  }

  const result = await sendGmailDirect(tokens, message)
  return { ...result, status: 'applied' }
}
