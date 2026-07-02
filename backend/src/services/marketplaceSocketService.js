import { Server } from 'socket.io'
import { findAuthSession, readStore } from '../db/store.js'
import { readSessionCredential } from './sessionCookieService.js'
import { canAccessConversation } from './marketplaceService.js'

export function attachMarketplaceSockets(server, allowedOrigins = []) {
  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: allowedOrigins, credentials: true },
  })

  io.use(async (socket, next) => {
    try {
      const portal = ['client', 'employer'].includes(socket.handshake.auth?.role) ? socket.handshake.auth.role : 'client'
      const { token } = readSessionCredential({ headers: { cookie: socket.handshake.headers.cookie || '', 'x-jobpilot-portal': portal } })
      const auth = token ? await findAuthSession(token) : null
      if (!auth?.user || auth.user.status !== 'active') return next(new Error('Authentication required'))
      socket.data.user = auth.user
      next()
    } catch {
      next(new Error('Authentication required'))
    }
  })

  io.on('connection', (socket) => {
    socket.on('conversation:join', async (conversationId) => {
      const store = await readStore()
      const conversation = (store.conversations || []).find(item => item.id === String(conversationId))
      if (!canAccessConversation(store, conversation, socket.data.user)) return
      socket.join(`conversation:${conversation.id}`)
    })
  })

  return io
}
