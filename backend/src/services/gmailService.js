import { google } from 'googleapis'

export function realSendEnabled() {
  return process.env.ENABLE_REAL_SEND === 'true'
}

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/gmail/callback'
  )
}

export function getAuthUrl() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    const error = new Error('Gmail OAuth credentials are not configured')
    error.status = 400
    throw error
  }

  return getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
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

function encodeMessage({ to, subject, body, attachmentBase64, attachmentName }) {
  const boundary = `jobpilot_${Date.now()}`
  const headers = [`To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0']
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
      `Content-Type: application/pdf; name="${attachmentName || 'resume.pdf'}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachmentName || 'resume.pdf'}"`,
      '',
      attachmentBase64,
      `--${boundary}--`,
    ].join('\n')
  } else {
    raw = [
      ...headers,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ].join('\n')
  }

  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function sendGmail(tokens, message) {
  if (!realSendEnabled()) {
    return { id: `demo-gmail-${Date.now()}`, demo: true, status: 'sent_demo' }
  }

  if (!tokens) {
    const error = new Error('Gmail is not connected')
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

  return { id: result.data.id, demo: false, status: 'applied' }
}
