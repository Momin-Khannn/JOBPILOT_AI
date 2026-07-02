import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { AlertCircle, BadgeCheck, Ban, Flag, MessageCircle, Send, ShieldCheck } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api/client.js'

function socketOrigin() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:4000'
  if (['localhost', '127.0.0.1'].includes(window.location.hostname) && ['3000', '5173'].includes(window.location.port)) return 'http://127.0.0.1:4000'
  return window.location.origin
}

function displayTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export default function MessagesPage() {
  const { user } = useOutletContext() || {}
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const socketRef = useRef(null)
  const endRef = useRef(null)
  const selected = useMemo(() => conversations.find(item => item.id === selectedId) || null, [conversations, selectedId])

  useEffect(() => {
    api.marketplaceConversations().then(({ conversations: items }) => {
      setConversations(items)
      setSelectedId(current => current || items[0]?.id || '')
    }).catch(err => setError(err.message))
  }, [])

  useEffect(() => {
    if (!selectedId) return undefined
    api.marketplaceMessages(selectedId).then(({ messages: items }) => {
      setMessages(items)
      api.readMarketplaceConversation(selectedId).catch(() => {})
    }).catch(err => setError(err.message))

    const socket = io(socketOrigin(), { path: '/socket.io', withCredentials: true })
    socketRef.current = socket
    socket.emit('conversation:join', selectedId)
    socket.on('message:new', message => {
      if (message.conversationId !== selectedId) return
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
      api.readMarketplaceConversation(selectedId).catch(() => {})
    })
    socket.on('connect_error', () => setError('Live messaging is reconnecting. You can still refresh this conversation.'))
    return () => socket.disconnect()
  }, [selectedId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages])

  async function sendMessage(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !selectedId) return
    setSending(true)
    try {
      const { message } = await api.sendMarketplaceMessage(selectedId, body)
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
      setDraft('')
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function reportConversation() {
    const detail = window.prompt('Tell JobPilot what looks suspicious. Do not include passwords or financial details.')
    if (detail === null) return
    try {
      await api.reportMarketplaceConversation(selectedId, { reason: 'suspicious_employer', detail })
      setError('')
      window.alert('Report sent to the JobPilot safety team.')
    } catch (err) { setError(err.message) }
  }

  async function blockConversation() {
    if (!window.confirm('Block this conversation? Neither side will be able to send new messages.')) return
    try {
      await api.blockMarketplaceConversation(selectedId)
      setConversations(current => current.map(item => item.id === selectedId ? { ...item, blockedBy: [...(item.blockedBy || []), user.id] } : item))
      setError('')
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div><span className="eyebrow">Private hiring conversations</span><h1>Messages</h1><p>Employers can contact you only after you apply to their JobPilot Direct role.</p></div>
        <span className="trust-pill"><ShieldCheck size={14} /> Text-only · monitored safety rules</span>
      </section>
      {error && <div className={error.startsWith('Live messaging') ? 'notice' : 'alert'}><AlertCircle size={18} />{error}</div>}

      <section className="marketplace-messages">
        <aside className="conversation-list" aria-label="Application conversations">
          <header><span>Applications</span><strong>{conversations.length}</strong></header>
          {conversations.map(conversation => (
            <button key={conversation.id} className={selectedId === conversation.id ? 'active' : ''} onClick={() => setSelectedId(conversation.id)}>
              <span className="conversation-logo">{conversation.company?.name?.slice(0, 1) || 'J'}</span>
              <span><strong>{conversation.company?.name || conversation.application?.job?.company}</strong><small>{conversation.application?.job?.title}</small></span>
              {conversation.lastMessageAt && <time>{displayTime(conversation.lastMessageAt)}</time>}
            </button>
          ))}
          {!conversations.length && <div className="conversation-empty"><MessageCircle size={22} /><p>Your JobPilot Direct conversations will appear here after you apply.</p></div>}
        </aside>

        <div className="conversation-room">
          {selected ? (
            <>
              <header className="conversation-room-head">
                <div><span className="conversation-logo">{selected.company?.name?.slice(0, 1) || 'J'}</span><span><strong>{selected.company?.name}</strong><small><BadgeCheck size={13} /> Verified employer · {selected.application?.job?.title}</small></span></div>
                <div><button className="icon-button" onClick={reportConversation} title="Report conversation"><Flag size={17} /></button><button className="icon-button" onClick={blockConversation} title="Block conversation"><Ban size={17} /></button></div>
              </header>
              <div className="message-safety-banner"><ShieldCheck size={16} /><span>Never send money, banking details, passwords, crypto, gift cards, or identity documents. JobPilot employers cannot charge candidates.</span></div>
              <div className="message-thread" aria-live="polite">
                {messages.map(message => (
                  <article key={message.id} className={message.userId === user?.id ? 'message-own' : 'message-other'}>
                    <p>{message.body}</p><time>{displayTime(message.createdAt)}</time>
                  </article>
                ))}
                {!messages.length && <div className="message-thread-empty"><MessageCircle size={23} /><p>This is a private conversation about your application. Say hello when you are ready.</p></div>}
                <div ref={endRef} />
              </div>
              <form className="message-composer" onSubmit={sendMessage}>
                <textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} placeholder="Write a message…" disabled={(selected.blockedBy || []).length > 0} />
                <button className="button button-primary" disabled={!draft.trim() || sending || (selected.blockedBy || []).length > 0}><Send size={16} />{sending ? 'Sending…' : 'Send'}</button>
              </form>
              {(selected.blockedBy || []).length > 0 && <p className="conversation-blocked"><Ban size={15} /> This conversation is blocked.</p>}
            </>
          ) : <div className="conversation-room-empty"><MessageCircle size={28} /><h2>Select a conversation</h2><p>Your messages stay connected to the job application.</p></div>}
        </div>
      </section>
    </div>
  )
}
