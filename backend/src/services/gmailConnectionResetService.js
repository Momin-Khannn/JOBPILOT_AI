import { v4 as uuid } from 'uuid'

export function gmailConnectionResetPlan(store = {}) {
  const users = store.users || []
  const affectedUsers = users.filter(user => {
    const gmail = user.integrations?.gmail
    return Boolean(gmail?.connected || gmail?.encryptedTokens || gmail?.connectedEmail)
  })
  return {
    affectedCount: affectedUsers.length,
    ownerAffected: affectedUsers.some(user => user.role === 'owner'),
  }
}

export function resetGmailConnections(store = {}, { targetEmail, changedAt = new Date().toISOString() } = {}) {
  const plan = gmailConnectionResetPlan(store)
  for (const user of store.users || []) {
    const gmail = user.integrations?.gmail
    if (!gmail?.connected && !gmail?.encryptedTokens && !gmail?.connectedEmail) continue
    user.integrations ||= {}
    user.integrations.gmail = {
      connected: false,
      connectedEmail: null,
      encryptedTokens: null,
      updatedAt: changedAt,
    }
  }

  if (plan.affectedCount > 0) {
    store.auditLogs ||= []
    store.auditLogs.unshift({
      id: uuid(),
      action: 'gmail.oauth_client_rotated',
      details: {
        affectedCount: plan.affectedCount,
        targetEmailConfigured: Boolean(targetEmail),
      },
      createdAt: changedAt,
    })
    store.auditLogs = store.auditLogs.slice(0, 250)
  }
  return plan
}
