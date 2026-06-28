import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, ShieldCheck, Sparkles, Zap } from 'lucide-react'

const ease = [0.22, 1, 0.36, 1]

export default function AuthScaffold({ eyebrow, title, description, children }) {
  const reduceMotion = useReducedMotion()
  const enter = reduceMotion ? false : { opacity: 0, y: 18 }

  return (
    <div className="auth-shell premium-auth-shell">
      <div className="auth-ambient" aria-hidden="true"><span /><span /></div>

      <motion.section
        className="auth-copy"
        initial={enter}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
      >
        <Link className="auth-brand" to="/">
          <span><Zap size={17} /></span>
          <strong>JobPilot</strong>
          <small>PRO</small>
        </Link>

        <div className="auth-message">
          <span className="eyebrow"><Sparkles size={14} /> {eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="auth-proof">
          <span><ShieldCheck size={16} /> Nothing sends without your approval</span>
          <span><BadgeCheck size={16} /> Your career data stays private</span>
        </div>

        <div className="auth-insight-card">
          <span>Designed for deliberate careers</span>
          <p>Less application noise. Better-fit roles, sharper materials, and a clear record of every decision.</p>
        </div>

        <Link className="auth-back-link" to="/"><ArrowLeft size={15} /> Back to overview</Link>
      </motion.section>

      <motion.div
        className="auth-card-wrap"
        initial={reduceMotion ? false : { opacity: 0, x: 22, scale: 0.985 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.62, delay: reduceMotion ? 0 : 0.08, ease }}
      >
        <div className="auth-card-label"><span /> Secure client workspace</div>
        {children}
        <p className="auth-legal">Encrypted sessions · review-first automation · clear audit history</p>
      </motion.div>
    </div>
  )
}
