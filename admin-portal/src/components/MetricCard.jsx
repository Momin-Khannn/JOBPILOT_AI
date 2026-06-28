import { motion, useReducedMotion } from 'framer-motion'

export default function MetricCard({ label, value, detail }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.article
      className="metric-card"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <i />
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </motion.article>
  )
}
