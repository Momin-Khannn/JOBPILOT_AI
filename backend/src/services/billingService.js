import Stripe from 'stripe'
import { publicFrontendUrl } from '../config/publicUrls.js'
import { readStore, updateStore } from '../db/store.js'

let stripeClient = null

export function billingConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID
  )
}

export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error('Paid plans are not configured yet.')
    error.status = 503
    throw error
  }
  stripeClient ||= new Stripe(process.env.STRIPE_SECRET_KEY)
  return stripeClient
}

export function priceIdForInterval(interval = 'monthly') {
  const priceId = interval === 'annual'
    ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID
    : process.env.STRIPE_PRO_MONTHLY_PRICE_ID
  if (!priceId) {
    const error = new Error(`${interval === 'annual' ? 'Annual' : 'Monthly'} Pro billing is not configured.`)
    error.status = 503
    throw error
  }
  return priceId
}

function activeStatus(status) {
  return status === 'active' || status === 'trialing'
}

function timestamp(value) {
  return Number(value) > 0 ? new Date(Number(value) * 1000).toISOString() : null
}

export function billingSnapshot(subscription = {}, fallback = {}) {
  return {
    customerId: typeof subscription.customer === 'string' ? subscription.customer : fallback.customerId || '',
    subscriptionId: subscription.id || fallback.subscriptionId || '',
    priceId: subscription.items?.data?.[0]?.price?.id || fallback.priceId || '',
    status: subscription.status || fallback.status || 'inactive',
    currentPeriodEnd: timestamp(subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end) || fallback.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    updatedAt: new Date().toISOString(),
  }
}

export async function createCheckout(user, interval = 'monthly') {
  if (!billingConfigured()) {
    const error = new Error('Pro checkout is not available until Stripe live billing is configured.')
    error.status = 503
    throw error
  }
  const trialDays = Math.max(0, Number(process.env.STRIPE_TRIAL_DAYS || 0))
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceIdForInterval(interval), quantity: 1 }],
    client_reference_id: user.id,
    metadata: { userId: user.id, plan: 'pro', interval },
    subscription_data: {
      metadata: { userId: user.id, plan: 'pro' },
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
    ...(user.billing?.customerId ? { customer: user.billing.customerId } : { customer_email: user.email }),
    allow_promotion_codes: true,
    success_url: `${publicFrontendUrl()}/settings?billing=success`,
    cancel_url: `${publicFrontendUrl()}/settings?billing=cancelled`,
  })
  return { url: session.url }
}

export async function createPortal(user) {
  if (!user.billing?.customerId) {
    const error = new Error('No Stripe customer is attached to this account yet.')
    error.status = 400
    throw error
  }
  const session = await stripe().billingPortal.sessions.create({
    customer: user.billing.customerId,
    return_url: `${publicFrontendUrl()}/settings`,
  })
  return { url: session.url }
}

function eventIdentifiers(event) {
  const object = event.data?.object || {}
  const subscriptionId = typeof object.subscription === 'string'
    ? object.subscription
    : object.parent?.subscription_details?.subscription || object.id || ''
  return {
    userId: object.client_reference_id || object.metadata?.userId || '',
    customerId: typeof object.customer === 'string' ? object.customer : '',
    subscriptionId,
  }
}

async function subscriptionForEvent(event) {
  const object = event.data?.object || {}
  if (event.type.startsWith('customer.subscription.')) return object
  const { subscriptionId } = eventIdentifiers(event)
  if (!subscriptionId || !String(subscriptionId).startsWith('sub_')) return null
  return stripe().subscriptions.retrieve(subscriptionId)
}

export async function processBillingEvent(event) {
  const identifiers = eventIdentifiers(event)
  const relevant = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
  ].includes(event.type)
  const subscription = relevant ? await subscriptionForEvent(event) : null

  return updateStore((store) => {
    store.billingEvents ||= []
    if (store.billingEvents.some(item => item.id === event.id)) return { duplicate: true }

    const user = (store.users || []).find(item =>
      (identifiers.userId && item.id === identifiers.userId) ||
      (identifiers.customerId && item.billing?.customerId === identifiers.customerId) ||
      (identifiers.subscriptionId && item.billing?.subscriptionId === identifiers.subscriptionId)
    )

    if (user && subscription) {
      user.billing = billingSnapshot(subscription, user.billing)
      if (event.type === 'invoice.payment_failed') user.billing.status = 'past_due'
      user.tier = activeStatus(user.billing.status) ? 'pro' : 'basic'
    }

    store.billingEvents.unshift({
      id: event.id,
      type: event.type,
      userId: user?.id || identifiers.userId || null,
      processedAt: new Date().toISOString(),
    })
    store.billingEvents = store.billingEvents.slice(0, 1000)
    return { duplicate: false, matched: Boolean(user), userId: user?.id || null }
  })
}

export function constructBillingEvent(rawBody, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    const error = new Error('Stripe webhook verification is not configured.')
    error.status = 503
    throw error
  }
  return stripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
}

export async function billingStatus(userId) {
  const store = await readStore()
  const user = (store.users || []).find(item => item.id === userId)
  return {
    configured: billingConfigured(),
    tier: user?.tier || 'basic',
    billing: user?.billing ? {
      status: user.billing.status || 'inactive',
      currentPeriodEnd: user.billing.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(user.billing.cancelAtPeriodEnd),
    } : null,
    annualAvailable: Boolean(process.env.STRIPE_PRO_ANNUAL_PRICE_ID),
  }
}
