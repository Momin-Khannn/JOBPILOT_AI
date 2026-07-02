import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  FileText,
  Flag,
  History,
  Inbox,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  PanelsTopLeft,
  Repeat,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import UserAvatar from './UserAvatar.jsx'

const navGroups = [
  {
    label: 'Workspace',
    links: [
      { to: '/dashboard', label: 'Overview', icon: BarChart3 },
      { to: '/jobs', label: 'Discover jobs', icon: BriefcaseBusiness },
      { to: '/applications', label: 'Applications', icon: History },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
      { to: '/career-lab', label: 'Career Lab', icon: BrainCircuit, featured: true },
    ],
  },
  {
    label: 'Career assets',
    links: [
      { to: '/goal', label: 'Career goal', icon: Flag },
      { to: '/resume', label: 'Upload CV', icon: FileText },
      { to: '/profile', label: 'CV webpage', icon: PanelsTopLeft },
    ],
  },
  {
    label: 'Automation',
    links: [
      { to: '/followups', label: 'Follow-ups', icon: Repeat },
      { to: '/inbox', label: 'Inbox monitor', icon: Inbox },
      { to: '/gmail', label: 'Gmail', icon: Mail },
      { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    ],
  },
]

const drawerLinks = [
  { to: '/settings', label: 'Account settings', helper: 'Preferences, limits, and update emails', icon: UserRound },
  { to: '/resume', label: 'Upload or replace CV', helper: 'Choose a PDF, DOCX, or TXT from your device', icon: FileText },
  { to: '/gmail', label: 'Gmail delivery', helper: 'Google OAuth mailbox connection', icon: Mail },
  { to: '/whatsapp', label: 'WhatsApp delivery', helper: 'Twilio or Meta Cloud API', icon: MessageCircle },
  { to: '/profile', label: 'Public CV page', helper: 'Design, sections, and privacy controls', icon: PanelsTopLeft },
]

const pageMeta = {
  '/dashboard': { label: 'Overview', eyebrow: 'Command center' },
  '/goal': { label: 'Career goal', eyebrow: 'Direction' },
  '/jobs': { label: 'Discover jobs', eyebrow: 'Opportunity feed' },
  '/resume': { label: 'Upload CV', eyebrow: 'Career assets' },
  '/profile': { label: 'CV webpage', eyebrow: 'Personal brand' },
  '/applications': { label: 'Applications', eyebrow: 'Pipeline' },
  '/messages': { label: 'Messages', eyebrow: 'Direct hiring' },
  '/career-lab': { label: 'Career Lab', eyebrow: 'Intelligence' },
  '/followups': { label: 'Follow-ups', eyebrow: 'Automation' },
  '/inbox': { label: 'Inbox monitor', eyebrow: 'Signals' },
  '/gmail': { label: 'Gmail', eyebrow: 'Connections' },
  '/whatsapp': { label: 'WhatsApp', eyebrow: 'Connections' },
  '/settings': { label: 'Settings', eyebrow: 'Workspace' },
}

export default function Layout({ user, onUserUpdated, onLogout }) {
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const density = user?.preferences?.density || 'comfortable'
    document.documentElement.dataset.density = density
    document.documentElement.classList.toggle('user-reduced-motion', Boolean(user?.preferences?.reducedMotion))
  }, [user?.preferences?.density, user?.preferences?.reducedMotion])
  const currentPage = pageMeta[location.pathname] || { label: 'JobPilot AI', eyebrow: 'Workspace' }
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date()), [])

  function closeNavigation() {
    setOpen(false)
    setSettingsOpen(false)
  }

  function openWorkspaceControls() {
    setOpen(false)
    setSettingsOpen(true)
  }

  function toggleWorkspaceControls() {
    if (settingsOpen) {
      setSettingsOpen(false)
      return
    }

    openWorkspaceControls()
  }

  return (
    <div className="app-shell premium-shell">
      <div className="app-ambient" aria-hidden="true"><span /><span /></div>

      <motion.aside
        className={`sidebar ${open ? 'sidebar-open' : ''}`}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="sidebar-inner">
          <div>
            <Link className="brand" to="/dashboard" onClick={closeNavigation}>
              <span className="brand-mark"><Zap size={17} /></span>
              <div><strong>JobPilot</strong><small>AI career operating system</small></div>
              {user?.tier === 'pro' && <span className="brand-edition">PRO</span>}
            </Link>

            <nav className="nav-list" aria-label="Primary navigation">
              {navGroups.map((group, groupIndex) => (
                <motion.div
                  className="nav-group"
                  key={group.label}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + groupIndex * 0.05, duration: 0.28 }}
                >
                  <span className="nav-group-label">{group.label}</span>
                  {group.links.map(({ to, label, icon: Icon, featured }) => (
                    <NavLink key={to} to={to} onClick={closeNavigation} className={({ isActive }) => `nav-link ${featured ? 'nav-featured' : ''} ${isActive ? 'active' : ''}`}>
                      {({ isActive }) => (
                        <>
                          <span className="nav-icon"><Icon size={17} strokeWidth={1.8} /></span>
                          <span className="nav-label">{label}</span>
                          {featured && <Sparkles className="nav-spark" size={13} />}
                          {isActive && <motion.span className="nav-active-indicator" layoutId="active-navigation" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                        </>
                      )}
                    </NavLink>
                  ))}
                </motion.div>
              ))}
            </nav>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <UserAvatar user={user} />
              <div><strong>{user?.name || 'JobPilot user'}</strong><small>{user?.email || 'Signed in'}</small></div>
              <span className="online-dot" title="Workspace active" />
            </div>
            <button className={`nav-link sidebar-more ${settingsOpen ? 'active' : ''}`} onClick={toggleWorkspaceControls} aria-expanded={settingsOpen}>
              <span className="nav-icon"><SlidersHorizontal size={17} /></span>
              <span className="nav-label">Workspace controls</span>
              <ChevronRight className="sidebar-more-arrow" size={15} />
            </button>
          </div>
        </div>
      </motion.aside>

      <aside className={`secondary-sidebar ${settingsOpen ? 'secondary-sidebar-open' : ''}`} aria-hidden={!settingsOpen}>
        <div className="secondary-sidebar-head">
          <div><span className="eyebrow">Private workspace</span><h2>Controls</h2></div>
          <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings drawer"><X size={18} /></button>
        </div>

        <div className="drawer-account">
          <UserAvatar user={user} className="sidebar-avatar large" size={46} />
          <div><strong>{user?.name || 'JobPilot user'}</strong><small>{user?.email}</small><span className="verified-line"><BadgeCheck size={14} />{user?.emailVerified ? 'Google verified' : 'Verification pending'}</span></div>
        </div>

        <nav className="drawer-nav" aria-label="Settings navigation">
          {drawerLinks.map(({ to, label, helper, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={closeNavigation} className={({ isActive }) => `drawer-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /><span><strong>{label}</strong><small>{helper}</small></span>
            </NavLink>
          ))}
        </nav>

        <div className="drawer-status">
          <span><ShieldCheck size={16} /> Human approval protects every send</span>
          <span><CalendarDays size={16} /> {dateLabel}</span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-context">
            <button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div><span>{currentPage.eyebrow}</span><strong>{currentPage.label}</strong></div>
          </div>
          <div className="topbar-actions">
            <Link className="topbar-search" to="/jobs"><Search size={16} /><span>Search opportunities</span><kbd>⌘ K</kbd></Link>
            <span className="trust-pill"><ShieldCheck size={14} /> Review-first</span>
            <button className="icon-button topbar-settings" onClick={openWorkspaceControls} aria-label="Open workspace controls"><Settings size={18} /></button>
            <button className="icon-button topbar-logout" onClick={onLogout} aria-label="Logout"><LogOut size={17} /></button>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            className="page"
            key={location.pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet context={{ user, onUserUpdated }} />
          </motion.main>
        </AnimatePresence>
      </div>

      {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={24} /></button>}
      {settingsOpen && <button className="drawer-scrim" onClick={() => setSettingsOpen(false)} aria-label="Close settings drawer" />}
    </div>
  )
}
