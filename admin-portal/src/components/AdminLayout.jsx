import { motion, useReducedMotion } from 'framer-motion'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, BriefcaseBusiness, Building2, Command, LogOut, MailCheck, ShieldCheck, Users, Waypoints } from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Overview', icon: Waypoints },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { to: '/employers', label: 'Employers', icon: Building2 },
  { to: '/client-updates', label: 'Client Updates', icon: MailCheck },
  { to: '/activity', label: 'Activity', icon: Activity },
]

const pageLabels = {
  '/dashboard': ['Overview', 'Platform command center'],
  '/users': ['Users', 'Client operations'],
  '/applications': ['Applications', 'Pipeline oversight'],
  '/employers': ['Employers', 'Trust and moderation'],
  '/client-updates': ['Client updates', 'Communication agent'],
  '/activity': ['Activity', 'Audit intelligence'],
}

export default function AdminLayout({ user, onLogout, context }) {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const [pageName, pageContext] = pageLabels[location.pathname] || ['Operations', 'Owner workspace']

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark"><Command size={18} /></span>
          <div>
            <strong>JobPilot Control</strong>
            <small>Owner workspace</small>
          </div>
          <em>OS</em>
        </div>
        <span className="nav-caption">Operations</span>
        <nav className="admin-nav" aria-label="Admin navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
              {({ isActive }) => <><Icon size={18} /><span>{label}</span>{isActive && <motion.i layoutId="admin-active-nav" transition={{ duration: reduceMotion ? 0 : 0.18 }} />}</>}
            </NavLink>
          ))}
        </nav>
        <div className="admin-security-note"><ShieldCheck size={17} /><span><strong>Restricted workspace</strong><small>Owner access is enforced</small></span></div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-location">
            <span>{pageContext}</span>
            <strong>{pageName}</strong>
          </div>
          <div className="admin-topbar-actions">
            <div className="owner-session">
              <span className="owner-avatar" aria-hidden="true">{(user?.name || user?.email || 'O').charAt(0).toUpperCase()}</span>
              <span><strong>{user?.name || 'Owner'}</strong><small>{user?.email || 'Private session'}</small></span>
            </div>
            <button className="button button-quiet" onClick={onLogout}><LogOut size={16} /> Sign out</button>
          </div>
        </header>

        <motion.main
          className="admin-page"
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet context={context} />
        </motion.main>
      </div>
    </div>
  )
}
