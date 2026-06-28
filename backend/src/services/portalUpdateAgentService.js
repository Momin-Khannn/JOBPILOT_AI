import { publicAdminUrl, publicBackendUrl, publicFrontendUrl } from '../config/publicUrls.js'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { ownerPortalEnabled } from './authService.js'

const agentName = process.env.PORTAL_UPDATE_AGENT_NAME || 'JobPilot Portal Update Agent'

const state = {
  started: false,
  timer: null,
  lastRefreshAt: null,
  lastError: null,
}

function envFlag(name, fallback = true) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

function envNumber(name, fallback, min = 0) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? Math.max(min, value) : fallback
}

function appVersion() {
  return process.env.APP_VERSION || '2.0.1'
}

function buildPortalUpdateState(source = 'agent') {
  const clientBaseUrl = publicFrontendUrl()
  const backendBaseUrl = publicBackendUrl()
  const adminBaseUrl = publicAdminUrl()
  const ownerUrl = ownerPortalEnabled ? `${adminBaseUrl}/owner` : ''
  const updatedAt = new Date().toISOString()

  return {
    agentName,
    source,
    version: appVersion(),
    updatedAt,
    publicUrl: clientBaseUrl,
    clientPortal: {
      name: 'Client portal',
      status: 'live',
      url: clientBaseUrl,
      loginUrl: `${clientBaseUrl}/login`,
      supportUrl: `${clientBaseUrl}/support`,
      icon: `${clientBaseUrl}/icon.svg`,
    },
    ownerPortal: {
      name: 'Owner portal',
      status: ownerPortalEnabled ? 'live' : 'private-disabled',
      url: ownerUrl,
      loginUrl: ownerUrl ? `${ownerUrl}/login` : '',
      icon: ownerUrl ? `${ownerUrl}/jobpilot-owner.ico` : '',
    },
    links: {
      support: `${clientBaseUrl}/support`,
      privacy: `${clientBaseUrl}/privacy`,
      terms: `${clientBaseUrl}/terms`,
      sitemap: `${clientBaseUrl}/sitemap.xml`,
      robots: `${clientBaseUrl}/robots.txt`,
    },
    oauthCallbacks: {
      googleLogin: `${backendBaseUrl}/api/auth/google/callback`,
      gmail: `${backendBaseUrl}/api/gmail/callback`,
    },
  }
}

export function portalUpdateAgentConfigured() {
  return {
    agentName,
    enabled: envFlag('PORTAL_UPDATE_AGENT_ENABLED', true),
    refreshIntervalMs: envNumber('PORTAL_UPDATE_AGENT_INTERVAL_MS', 30 * 60_000, 60_000),
  }
}

export async function refreshPortalUpdateState({ source = 'manual' } = {}) {
  const portalUpdateState = buildPortalUpdateState(source)
  await updateStore((store) => {
    store.portalUpdateState = portalUpdateState
  })
  state.lastRefreshAt = portalUpdateState.updatedAt
  state.lastError = null
  await addAuditLog('portal_update_agent.refreshed', {
    source,
    publicUrl: portalUpdateState.publicUrl,
    ownerPortal: portalUpdateState.ownerPortal.status,
  })
  return portalUpdateState
}

export async function portalUpdateAgentStatus() {
  const store = await readStore()
  return {
    ...portalUpdateAgentConfigured(),
    started: state.started,
    lastRefreshAt: state.lastRefreshAt,
    lastError: state.lastError,
    portalUpdateState: store.portalUpdateState || buildPortalUpdateState('status'),
  }
}

export function startPortalUpdateAgent() {
  const config = portalUpdateAgentConfigured()
  if (state.started || !config.enabled || process.env.NODE_ENV === 'test') return config

  state.started = true
  const refresh = () => {
    refreshPortalUpdateState({ source: 'agent' }).catch((error) => {
      state.lastError = error.message
    })
  }

  setTimeout(refresh, 3_000)
  state.timer = setInterval(refresh, config.refreshIntervalMs)
  state.timer.unref?.()
  return { ...config, started: true }
}
