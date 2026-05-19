import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FileText, Mail, MessageCircle, Search, ShieldCheck, Sparkles } from 'lucide-react'

const capabilities = [
  ['CV intelligence', 'Parses resumes, extracts skills, and highlights ATS improvements.', FileText],
  ['Job discovery', 'Filters remote, office 9-5, internship, and hybrid roles.', Search],
  ['AI drafting', 'Creates tailored Gmail and WhatsApp outreach for each role.', Sparkles],
  ['Human approval', 'Every application waits in a review queue before sending.', ShieldCheck],
]

export default function Landing() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <strong>JobPilot AI</strong>
        </div>
        <Link className="button button-secondary" to="/dashboard">Open app</Link>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Case-study demo · PWA · review-first automation</span>
          <h1>JobPilot AI</h1>
          <p>
            A professional job application agent that reads your CV, finds suitable roles, drafts outreach,
            and queues every Gmail or WhatsApp application for approval before it can be sent.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/resume">
              Start with resume <ArrowRight size={18} />
            </Link>
            <Link className="button button-secondary" to="/jobs">View job feed</Link>
          </div>
        </div>

        <div className="product-preview" aria-label="JobPilot AI workflow preview">
          <div className="preview-toolbar">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-grid">
            <div>
              <small>Resume match</small>
              <strong>92%</strong>
              <p>Node.js · PostgreSQL · AWS</p>
            </div>
            <div>
              <small>Review queue</small>
              <strong>6</strong>
              <p>Awaiting approval</p>
            </div>
            <div>
              <small>Channels</small>
              <strong><Mail size={20} /> <MessageCircle size={20} /></strong>
              <p>Gmail and WhatsApp</p>
            </div>
          </div>
          <div className="preview-list">
            {['Remote Backend Engineer', 'Database Engineer 9-5', 'ML Internship'].map((item, index) => (
              <div key={item}>
                <CheckCircle2 size={18} />
                <span>{item}</span>
                <strong>{[92, 87, 78][index]}%</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="capability-grid">
        {capabilities.map(([title, text, Icon]) => (
          <article key={title} className="capability-card">
            <Icon size={22} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
