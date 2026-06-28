import nodemailer from 'nodemailer'
import { publicFrontendUrl } from '../config/publicUrls.js'

let mailboxReadiness = { checkedAt: 0, ready: false }

export function smtpConfigured() {
  if (process.env.NODE_ENV === 'test') return false
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function smtpTransportConfig() {
  const port = Number(process.env.SMTP_PORT || 587)
  return {
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    family: Number(process.env.SMTP_FAMILY || 4),
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15_000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 15_000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30_000),
    auth: process.env.SMTP_USER || process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  }
}

async function connectedBusinessGmail() {
  try {
    const [{ readStore }, { decryptJson }] = await Promise.all([
      import('../db/store.js'),
      import('./cryptoService.js'),
    ])
    const store = await readStore()
    const owner = (store.users || []).find(user => user.role === 'owner')
    const integration = owner?.integrations?.gmail
    const tokens = decryptJson(integration?.encryptedTokens)
    if (!integration?.connected || !tokens) return null
    return { email: integration.connectedEmail || owner.email, tokens }
  } catch {
    return null
  }
}

function gmailGrantInvalid(error) {
  const text = [
    error?.message,
    error?.response?.data?.error,
    error?.response?.data?.error_description,
  ].filter(Boolean).join(' ')
  return /invalid_grant|token.*expired|token.*revoked|reauth/i.test(text)
}

async function disconnectBusinessGmail(reason = 'oauth_grant_invalid') {
  const [{ updateStore, addAuditLog }] = await Promise.all([
    import('../db/store.js'),
  ])
  const disconnectedAt = new Date().toISOString()
  let email = ''
  await updateStore((store) => {
    const owner = (store.users || []).find(user => user.role === 'owner')
    if (!owner?.integrations?.gmail) return
    email = owner.integrations.gmail.connectedEmail || owner.email || ''
    owner.integrations.gmail = {
      ...owner.integrations.gmail,
      connected: false,
      encryptedTokens: null,
      lastError: reason,
      updatedAt: disconnectedAt,
    }
  })
  await addAuditLog('business_gmail.disconnected', { email, reason })
}

function businessMailUnavailableError(cause) {
  const error = new Error('Business email delivery is temporarily unavailable. Reconnect business Gmail or configure SMTP.')
  error.status = 503
  error.cause = cause
  return error
}

export function assertEmailAccepted(result = {}, recipient = '') {
  const accepted = (result.accepted || []).map(value => String(value).toLowerCase())
  const rejected = (result.rejected || []).map(value => String(value).toLowerCase())
  const target = String(recipient || '').toLowerCase()
  if (!accepted.length || (target && rejected.includes(target))) {
    throw businessMailUnavailableError(new Error('The email provider rejected the recipient'))
  }
  return result
}

function appName() {
  return process.env.APP_NAME || 'JobPilot AI'
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function buildWelcomeEmail({ name = '' } = {}) {
  const product = appName()
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there'
  const safeFirstName = escapeHtml(firstName)
  const workspaceUrl = `${publicFrontendUrl()}/goal`

  return {
    subject: `Welcome to ${product}`,
    text: [
      `Hi ${firstName},`,
      '',
      `Welcome to ${product}. Your private career workspace is ready.`,
      '',
      'Start by setting your career goal, then add your CV so JobPilot can help you review suitable roles and prepare stronger applications.',
      '',
      `Open your workspace: ${workspaceUrl}`,
      '',
      'Every application and message stays review-first—you remain in control before anything is sent.',
    ].join('\n'),
    html: `
      <p>Hi ${safeFirstName},</p>
      <p>Welcome to <strong>${escapeHtml(product)}</strong>. Your private career workspace is ready.</p>
      <p>Start by setting your career goal, then add your CV so JobPilot can help you review suitable roles and prepare stronger applications.</p>
      <p><a href="${workspaceUrl}">Open your workspace</a></p>
      <p>Every application and message stays review-first—you remain in control before anything is sent.</p>
    `,
  }
}

export function buildEmailVerificationEmail({ name = '', verificationUrl = '' } = {}) {
  const product = appName()
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there'
  const safeFirstName = escapeHtml(firstName)
  const safeUrl = escapeHtml(verificationUrl)

  return {
    subject: `Verify your ${product} email`,
    text: [
      `Hi ${firstName},`,
      '',
      `Verify this email address to finish securing your ${product} account:`,
      verificationUrl,
      '',
      'This link expires in 24 hours. If you did not create this account, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>Hi ${safeFirstName},</p>
      <p>Verify this email address to finish securing your <strong>${escapeHtml(product)}</strong> account.</p>
      <p><a href="${safeUrl}">Verify email address</a></p>
      <p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
    `,
  }
}

export function businessMailConfigured() {
  return smtpConfigured()
}

export async function businessMailReady() {
  const now = Date.now()
  if (now - mailboxReadiness.checkedAt < 60_000) return mailboxReadiness.ready
  try {
    mailboxReadiness = { checkedAt: now, ready: await verifyBusinessMailbox() }
  } catch {
    mailboxReadiness = { checkedAt: now, ready: false }
  }
  return mailboxReadiness.ready
}

export async function businessMailStatus() {
  const gmail = await connectedBusinessGmail()
  return {
    configured: Boolean(gmail) || businessMailConfigured(),
    provider: gmail ? 'gmail_oauth' : 'smtp',
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    from: process.env.SMTP_FROM || '',
    user: gmail?.email || process.env.SMTP_USER || '',
    gmailConnected: Boolean(gmail),
  }
}

export async function verifyBusinessMailbox() {
  const gmail = await connectedBusinessGmail()
  if (gmail) {
    const { verifyGmailConnection } = await import('./gmailService.js')
    try {
      return await verifyGmailConnection(gmail.tokens)
    } catch (error) {
      if (gmailGrantInvalid(error)) await disconnectBusinessGmail('oauth_grant_invalid')
      if (!businessMailConfigured()) return false
    }
  }
  if (!businessMailConfigured()) return false
  const transporter = nodemailer.createTransport(smtpTransportConfig())
  await transporter.verify()
  return true
}

export async function sendBusinessEmail({ to, subject, text, html, replyTo }) {
  const gmail = await connectedBusinessGmail()
  if (gmail) {
    const { sendGmailDirect } = await import('./gmailService.js')
    try {
      return await sendGmailDirect(gmail.tokens, { to, subject, body: text || String(html || '').replace(/<[^>]+>/g, ' ') })
    } catch (error) {
      console.error('Business Gmail OAuth send error:', error.message)
      if (gmailGrantInvalid(error)) await disconnectBusinessGmail('oauth_grant_invalid')
      if (!businessMailConfigured()) throw businessMailUnavailableError(error)
    }
  }

  if (!businessMailConfigured()) {
    const error = new Error('Business Gmail SMTP is not configured')
    error.status = 400
    throw error
  }

  if (process.env.ENABLE_REAL_SEND === 'false') {
    return { id: 'mock-id', accepted: [to], rejected: [] }
  }

  const transporter = nodemailer.createTransport(smtpTransportConfig())
  try {
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
      html,
      replyTo: replyTo || process.env.SMTP_REPLY_TO || process.env.SMTP_FROM,
    })

    return assertEmailAccepted({
      id: result.messageId,
      accepted: result.accepted || [],
      rejected: result.rejected || [],
    }, to)
  } catch (error) {
    console.error('SMTP send error:', error.message)
    if (error.status === 503) throw error
    throw businessMailUnavailableError(error)
  }
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!(await businessMailReady())) return false

  const result = await sendBusinessEmail({
    to,
    subject: `${appName()} password reset`,
    text: [
      `You requested a password reset for ${appName()}.`,
      '',
      'Open this link within 30 minutes to choose a new password:',
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>You requested a password reset for <strong>${appName()}</strong>.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>
    `,
  })

  return !(result?.rejected || []).includes(to)
}

export async function sendWelcomeEmail({ to, name }) {
  if (!(await businessMailReady())) return false
  const message = buildWelcomeEmail({ name })

  const result = await sendBusinessEmail({
    to,
    ...message,
  })

  return !(result?.rejected || []).includes(to)
}

export async function sendEmailVerificationEmail({ to, name, verificationUrl }) {
  if (!(await businessMailReady())) return false
  const message = buildEmailVerificationEmail({ name, verificationUrl })

  const result = await sendBusinessEmail({
    to,
    ...message,
  })

  return !(result?.rejected || []).includes(to)
}

export async function sendLoginCodeEmail({ to, code }) {
  if (!(await businessMailReady())) return false

  const result = await sendBusinessEmail({
    to,
    subject: `${appName()} sign-in code`,
    text: [
      `Your ${appName()} sign-in code is: ${code}`,
      '',
      'This code expires in 10 minutes and can be used only once.',
      'If you did not try to sign in, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>Your <strong>${escapeHtml(appName())}</strong> sign-in code is:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:6px">${escapeHtml(code)}</p>
      <p>This code expires in 10 minutes and can be used only once.</p>
      <p>If you did not try to sign in, you can ignore this email.</p>
    `,
  })

  return !(result?.rejected || []).includes(to)
}
