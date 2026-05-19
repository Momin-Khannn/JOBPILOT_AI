import twilio from 'twilio'
import fetch from 'node-fetch'

export function realSendEnabled() {
  return process.env.ENABLE_REAL_SEND === 'true'
}

export async function sendWhatsApp({ provider = 'twilio', to, body }) {
  if (!realSendEnabled()) {
    return { id: `demo-wa-${Date.now()}`, demo: true, status: 'sent_demo' }
  }

  if (provider === 'meta') {
    return sendViaMeta(to, body)
  }
  return sendViaTwilio(to, body)
}

async function sendViaTwilio(to, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_NUMBER) {
    const error = new Error('Twilio WhatsApp credentials are not configured')
    error.status = 400
    throw error
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  const result = await client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    body,
  })
  return { id: result.sid, demo: false, status: 'applied' }
}

async function sendViaMeta(to, body) {
  if (!process.env.META_WA_TOKEN || !process.env.META_PHONE_NUMBER_ID) {
    const error = new Error('Meta WhatsApp Cloud API credentials are not configured')
    error.status = 400
    throw error
  }

  const response = await fetch(`https://graph.facebook.com/v19.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.META_WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: String(to).replace(/\D/g, ''),
      type: 'text',
      text: { body },
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Meta WhatsApp send failed')
    error.status = response.status
    throw error
  }

  return { id: payload.messages?.[0]?.id, demo: false, status: 'applied' }
}
