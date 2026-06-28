import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, BriefcaseBusiness, Clock3, Sparkles, Target } from 'lucide-react'

const iconMap = {
  Applications: BriefcaseBusiness,
  'Needs review': Clock3,
  'Follow-ups': Target,
  'Avg. match': Sparkles,
}

export default function MetricCard({ label, value, tone = 'green', detail }) {
  const Icon = iconMap[label] || Sparkles
  const reduceMotion = useReducedMotion()
  return (
    <motion.article
      className={`metric-card tone-${tone}`}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      transition={{ type: 'spring', stiffness: 340, damping: 24 }}
    >
      <div className="metric-card-head"><span className="metric-icon"><Icon size={17} /></span><ArrowUpRight size={16} /></div>
      <div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
    </motion.article>
  )
}
