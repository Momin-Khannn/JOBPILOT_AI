import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  History,
  Inbox,
  Mail,
  Menu,
  MessageCircle,
  Repeat,
  Settings,
  X,
  Zap,
} from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/jobs', label: 'Job Feed', icon: BriefcaseBusiness },
  { to: '/resume', label: 'Resume', icon: FileText },
  { to: '/applications', label: 'Applications', icon: History },
  { to: '/followups', label: 'Follow-ups', icon: Repeat },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/gmail', label: 'Gmail', icon: Mail },
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Zap size={18} /></span>
          <div>
            <strong>JobPilot AI</strong>
            <small>Review-first agent</small>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div>
            <strong>Autonomous job search, human approval</strong>
            <small>Gmail and WhatsApp are locked behind review in V1</small>
          </div>
          <a className="topbar-action" href="/jobs">Find jobs</a>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>

      {open && (
        <button className="scrim" onClick={() => setOpen(false)} aria-label="Close navigation">
          <X size={24} />
        </button>
      )}
    </div>
  )
}
