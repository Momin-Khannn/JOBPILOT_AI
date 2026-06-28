import { motion, useReducedMotion } from 'framer-motion'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, BriefcaseBusiness, LogOut, MailCheck, Shield, ShieldCheck, Users, Waypoints } from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Overview', icon: Waypoints },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { to: '/client-updates', label: 'Client Updates', icon: MailCheck },
  { to: '/activity', label: 'Activity', icon: Activity },
]

const pageLabels = {
  '/dashboard': ['Overview', 'Platform command center'],
  '/users': ['Users', 'Client operations'],
  '/applications': ['Applications', 'Pipeline oversight'],
  '/client-updates': ['Client updates', 'Communication agent'],
  '/activity': ['Activity', 'Audit intelligence'],
}

export default function AdminLayout({ user, onLogout, context }) {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const [pageName, pageContext] = pageLabels[location.pathname] || ['Operations', 'Owner workspace']

  return (
    <div className="admin-shell">
      <div className="admin-ambient" aria-hidden="true"><span /><span /></div>
      <motion.aside
        className="admin-sidebar"
        initial={reduceMotion ? false : { opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="admin-brand">
          <span className="admin-brand-mark"><Shield size={18} /></span>
          <div>
            <strong>JobPilot</strong>
            <small>Owner operations · v2.0.1</small>
          </div>
          <em>ADMIN</em>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
              {({ isActive }) => <><Icon size={17} /><span>{label}</span>{isActive && <motion.i layoutId="admin-active-nav" />}</>}
            </NavLink>
          ))}
        </nav>
        <div className="admin-security-note"><ShieldCheck size={16} /><span><strong>Private control plane</strong><small>Owner access only</small></span></div>
      </motion.aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <small>{pageContext}</small>
            <strong>{pageName}</strong>
          </div>
          <div className="admin-topbar-actions">
            <span className="owner-session"><span /> {user?.email || 'Owner session'}</span>
            <button className="button button-secondary" onClick={onLogout}><LogOut size={15} /> Logout</button>
          </div>
        </header>

        <motion.main
          className="admin-page"
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet context={context} />
        </motion.main>
      </div>
    </div>
  )
}
