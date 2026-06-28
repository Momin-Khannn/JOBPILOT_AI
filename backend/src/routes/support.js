import express from 'express'
import { v4 as uuid } from 'uuid'
import { addAuditLog, appendSupportTicket } from '../db/store.js'
import { sendBusinessEmail } from '../services/emailService.js'
import { validateRequest } from '../middleware/validate.js'
import { supportBodySchema } from '../validation/schemas.js'

const router = express.Router()

function text(value = '', limit = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit)
}

function multiline(value = '', limit = 5000) {
  return String(value || '').trim().replace(/\r\n/g, '\n').slice(0, limit)
}

function validEmail(email = '') {
  return !email || /^\S+@\S+\.\S+$/.test(email)
}

function ticketType(value = '') {
  return ['support', 'bug', 'billing', 'privacy'].includes(value) ? value : 'support'
}

function supportRecipient() {
  return process.env.SUPPORT_EMAIL || process.env.SMTP_REPLY_TO || process.env.SMTP_USER || 'ai.jobpilot@gmail.com'
}

router.post('/contact', validateRequest({ body: supportBodySchema }), async (req, res) => {
  const type = ticketType(req.body.type)
  const name = text(req.body.name, 120)
  const email = text(req.body.email, 180).toLowerCase()
  const subject = text(req.body.subject, 180) || (type === 'bug' ? 'Bug report' : 'Support request')
  const message = multiline(req.body.message)
  const pageUrl = text(req.body.pageUrl, 500)

  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid contact email address.' })
  if (message.length < 10) return res.status(400).json({ error: 'Please include at least 10 characters so support has enough context.' })

  const ticket = {
    id: uuid(),
    type,
    status: 'new',
    name,
    email,
    subject,
    message,
    pageUrl,
    userAgent: text(req.get('user-agent'), 240),
    createdAt: new Date().toISOString(),
  }

  await appendSupportTicket(ticket)

  let emailSent = false
  try {
    await sendBusinessEmail({
      to: supportRecipient(),
      replyTo: email || undefined,
      subject: `[JobPilot ${type}] ${subject}`,
      text: [
        `Type: ${type}`,
        `Name: ${name || 'Not provided'}`,
        `Email: ${email || 'Not provided'}`,
        `Page: ${pageUrl || 'Not provided'}`,
        '',
        message,
      ].join('\n'),
    })
    emailSent = true
  } catch (error) {
    await addAuditLog('support.email_skipped', { ticketId: ticket.id, reason: error.message })
  }

  await addAuditLog('support.ticket_created', { ticketId: ticket.id, type, emailProvided: Boolean(email), emailSent })
  res.status(202).json({
    success: true,
    ticketId: ticket.id,
    message: 'Thanks. Your message has been recorded and support will review it.',
    emailSent,
  })
})

export default router
