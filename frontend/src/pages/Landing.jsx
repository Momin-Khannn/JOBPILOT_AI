import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Check,
  FileCheck2,
  FileText,
  Globe2,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'

const ease = [0.22, 1, 0.36, 1]

const capabilities = [
  ['Career intelligence', 'Turn your profile and application history into a focused next-step plan.', BarChart3],
  ['CV intelligence', 'Extract skills, reveal ATS gaps, and tailor every version with intent.', FileText],
  ['Curated discovery', 'Surface suitable remote, hybrid, office, and internship roles.', Search],
  ['Application studio', 'Prepare role-specific material without losing your own voice.', Sparkles],
  ['Public CV', 'Publish a polished career profile with precise privacy controls.', Globe2],
  ['Human approval', 'Every external action waits for your review before it can send.', ShieldCheck],
]

const workflow = [
  ['01', 'Define the target', 'Set the role, location, working style, and salary signals that matter.', Target],
  ['02', 'Build the evidence', 'Shape your CV and profile around credible, role-relevant proof.', FileCheck2],
  ['03', 'Review every move', 'Compare, approve, and track each application from one quiet workspace.', BadgeCheck],
]

function Reveal({ children, className = '', delay = 0, reduceMotion }) {
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.55, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export default function Landing() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="landing marketing-shell">
      <div className="marketing-ambient" aria-hidden="true"><span /><span /></div>

      <motion.nav
        className="landing-nav"
        initial={reduceMotion ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
      >
        <Link className="marketing-brand" to="/">
          <span className="brand-mark"><Zap size={17} /></span>
          <span><strong>JobPilot</strong><small>AI career operating system</small></span>
          <em>PRO</em>
        </Link>
        <div className="landing-nav-links">
          <a href="#platform">Platform</a>
          <a href="#workflow">How it works</a>
          <Link to="/support">Support</Link>
          <a href="/employer/">For employers</a>
          <Link to="/login">Sign in</Link>
          <Link className="button button-primary" to="/signup">Start your workspace <ArrowRight size={16} /></Link>
        </div>
      </motion.nav>

      <main>
        <section className="marketing-hero">
          <motion.div
            className="marketing-hero-copy"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, delay: 0.08, ease }}
          >
            <span className="marketing-kicker"><span /> Intelligence for a more intentional career</span>
            <h1>Make your next move <em>count.</em></h1>
            <p>One focused workspace for stronger applications, thoughtful outreach, and career decisions backed by evidence—not guesswork.</p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/signup">Build your career workspace <ArrowRight size={17} /></Link>
              <Link className="button button-ghost" to="/login">Open an existing workspace</Link>
            </div>
            <div className="hero-assurance">
              <span><ShieldCheck size={15} /> Review-first by design</span>
              <span><Check size={15} /> No automatic sending</span>
              <span><Check size={15} /> Private career data</span>
            </div>
          </motion.div>

          <motion.div
            className="workspace-preview"
            initial={reduceMotion ? false : { opacity: 0, x: 26, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.72, delay: 0.16, ease }}
            whileHover={reduceMotion ? undefined : { y: -4 }}
          >
            <div className="preview-topbar">
              <div><span className="preview-logo"><Zap size={14} /></span><strong>JobPilot</strong></div>
              <span className="preview-secure"><ShieldCheck size={13} /> Review-first</span>
            </div>
            <div className="preview-body">
              <aside aria-hidden="true">
                {[BarChart3, BriefcaseBusiness, FileText, Mail].map((Icon, index) => <span className={index === 0 ? 'active' : ''} key={index}><Icon size={15} /></span>)}
              </aside>
              <div className="preview-content">
                <div className="preview-heading"><div><small>COMMAND CENTER</small><h2>Good morning, Alex.</h2></div><span><Sparkles size={13} /> Live</span></div>
                <div className="preview-focus">
                  <small>TODAY'S FOCUS</small>
                  <strong>Your review queue is ready.</strong>
                  <p>Three high-fit opportunities need your attention.</p>
                  <div><span style={{ width: '72%' }} /></div>
                </div>
                <div className="preview-metrics">
                  <article><span>Best match</span><strong>94%</strong><small>Platform Engineer</small></article>
                  <article><span>In review</span><strong>03</strong><small>Approval required</small></article>
                  <article><span>Profile</span><strong>88%</strong><small>Evidence strength</small></article>
                </div>
                <div className="preview-role">
                  <span className="role-icon"><BriefcaseBusiness size={16} /></span>
                  <div><strong>Senior Backend Engineer</strong><small>Northstar Systems · Remote</small></div>
                  <b>94% fit</b>
                </div>
              </div>
            </div>
            <motion.div className="preview-orbit orbit-one" animate={reduceMotion ? undefined : { y: [0, -7, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}>
              <BadgeCheck size={17} /><span><small>Profile signal</small><strong>Evidence verified</strong></span>
            </motion.div>
            <motion.div className="preview-orbit orbit-two" animate={reduceMotion ? undefined : { y: [0, 6, 0] }} transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}>
              <Target size={17} /><span><small>New match</small><strong>94% aligned</strong></span>
            </motion.div>
          </motion.div>
        </section>

        <section className="signal-strip" aria-label="Platform principles">
          <span>Built for thoughtful applicants</span>
          <div><ShieldCheck size={15} /> Human approval</div>
          <div><FileCheck2 size={15} /> ATS-aware</div>
          <div><Mail size={15} /> Gmail ready</div>
          <div><MessageCircle size={15} /> WhatsApp ready</div>
        </section>

        <section className="platform-section" id="platform">
          <Reveal className="section-intro" reduceMotion={reduceMotion}>
            <span className="marketing-kicker"><span /> One composed system</span>
            <h2>Everything your search needs.<br /><em>Nothing it doesn’t.</em></h2>
            <p>A connected set of tools that helps you move from vague ambition to well-supported action.</p>
          </Reveal>
          <div className="capability-grid">
            {capabilities.map(([title, text, Icon], index) => (
              <Reveal className="capability-card" delay={index * 0.045} reduceMotion={reduceMotion} key={title}>
                <span className="capability-index">0{index + 1}</span>
                <span className="capability-icon"><Icon size={20} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <ArrowRight className="capability-arrow" size={17} />
              </Reveal>
            ))}
          </div>
        </section>

        <section className="workflow-section" id="workflow">
          <Reveal className="workflow-copy" reduceMotion={reduceMotion}>
            <span className="marketing-kicker light"><span /> Deliberate by default</span>
            <h2>A calmer way to run your job search.</h2>
            <p>JobPilot keeps the system moving while you retain control of the decisions that carry your name.</p>
            <Link className="text-link" to="/signup">Create your workspace <ArrowRight size={16} /></Link>
          </Reveal>
          <div className="workflow-list">
            {workflow.map(([number, title, text, Icon], index) => (
              <Reveal className="workflow-item" delay={index * 0.07} reduceMotion={reduceMotion} key={number}>
                <span>{number}</span><Icon size={21} /><div><h3>{title}</h3><p>{text}</p></div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="marketing-cta">
          <Reveal className="marketing-cta-inner" reduceMotion={reduceMotion}>
            <span><Sparkles size={15} /> Your next chapter deserves a better system</span>
            <h2>Build a job search that feels as considered as your career.</h2>
            <div><Link className="button button-primary" to="/signup">Start with JobPilot <ArrowRight size={17} /></Link><Link className="button button-ghost" to="/login">Sign in</Link></div>
          </Reveal>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-brand"><span className="brand-mark"><Zap size={17} /></span><span><strong>JobPilot</strong><small>Move with intention.</small></span></div>
        <p>JobPilot AI v2.0.1 · Review-first AI for modern career decisions.</p>
        <span><Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <Link to="/support">Support</Link> · Private by design</span>
      </footer>
    </div>
  )
}
