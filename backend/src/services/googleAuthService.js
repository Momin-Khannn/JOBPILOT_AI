import crypto from 'crypto'
import { google } from 'googleapis'
import { publicAdminUrl, publicBackendUrl, publicFrontendUrl } from '../config/publicUrls.js'

const stateTtlMs = 10 * 60 * 1000

function authStateSecret() {
  return process.env.AUTH_STATE_SECRET || process.env.ENCRYPTION_SECRET || 'jobpilot-google-auth-state'
}

function frontendUrl() {
  return publicFrontendUrl()
}

function googleAuthRedirectUri() {
  return process.env.GOOGLE_AUTH_REDIRECT_URI || `${publicBackendUrl()}/api/auth/google/callback`
}

function sign(value) {
  return crypto
    .createHmac('sha256', authStateSecret())
    .update(value)
    .digest('base64url')
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    googleAuthRedirectUri()
  )
}

export function googleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function googleCallbackUrl({ error, role = 'client' } = {}) {
  const url = role === 'owner'
    ? new URL('/owner/auth/google/callback', publicAdminUrl())
    : new URL('/auth/google/callback', frontendUrl())
  const fragment = new globalThis.URLSearchParams()
  if (error) fragment.set('error', error)
  url.hash = fragment.toString()
  return url.toString()
}

export function createOAuthState(payload = {}) {
  const body = Buffer.from(JSON.stringify({
    ...payload,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: Date.now(),
  })).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyOAuthState(state = '') {
  const [body, signature] = String(state).split('.')
  if (!body || !signature) {
    const error = new Error('Invalid Google sign-in state')
    error.status = 400
    throw error
  }

  const expected = sign(body)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    const error = new Error('Invalid Google sign-in state')
    error.status = 400
    throw error
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (!payload.iat || Date.now() - Number(payload.iat) > stateTtlMs) {
    const error = new Error('Google sign-in session expired')
    error.status = 400
    throw error
  }
  return payload
}

export function getGoogleSignInUrl(state = '') {
  if (!googleAuthConfigured()) {
    const error = new Error('Google sign-in credentials are not configured')
    error.status = 400
    throw error
  }

  return getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    state,
    scope: ['openid', 'email', 'profile'],
  })
}

export async function exchangeGoogleSignInCode(code) {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ auth: client, version: 'v2' })
  const profile = await oauth2.userinfo.get()
  const data = profile.data || {}
  if (!data.email) {
    const error = new Error('Google account did not return an email address')
    error.status = 400
    throw error
  }

  return {
    googleSub: data.id || '',
    email: String(data.email).toLowerCase(),
    emailVerified: Boolean(data.verified_email),
    name: data.name || '',
    picture: await cacheGoogleProfilePicture(data.picture),
  }
}

export async function cacheGoogleProfilePicture(picture = '') {
  if (!picture || String(picture).startsWith('data:image/')) return picture || ''
  try {
    const url = new URL(picture)
    if (url.protocol !== 'https:' || !/(^|\.)googleusercontent\.com$/i.test(url.hostname)) return ''
    const response = await fetch(url, { signal: globalThis.AbortSignal.timeout(6000), redirect: 'follow' })
    if (!response.ok) return ''
    const contentType = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return ''
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length || bytes.length > 1_000_000) return ''
    return `data:${contentType};base64,${bytes.toString('base64')}`
  } catch {
    return ''
  }
}
