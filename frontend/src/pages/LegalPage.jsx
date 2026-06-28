import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Zap } from 'lucide-react'

const effectiveDate = 'June 21, 2026'

function PrivacyPolicy() {
  return (
    <>
      <h1>Privacy Notice</h1>
      <p className="legal-lead">This launch draft explains how JobPilot AI v2.0.1 handles career and account information. It should be reviewed by qualified US counsel before full commercial launch.</p>
      <h2>Information we collect</h2>
      <p>We collect account details, career goals, CV content, public-profile settings, saved jobs, application activity, interview transcripts and coaching scores, support and bug-report communications, integration status, billing status, optional analytics events, and essential security and service logs.</p>
      <h2>How we use information</h2>
      <p>We use this information to operate your private career workspace, match jobs, prepare user-requested materials, provide interview coaching, secure accounts, process subscriptions, send transactional or opted-in product updates, and improve service reliability.</p>
      <h2>AI and voice processing</h2>
      <p>When you choose a Gemini feature, relevant resume facts, job information, prompts, or a recorded interview answer are sent to Google for processing. JobPilot stores the resulting transcript and coaching feedback but does not retain the uploaded interview audio. Coaching scores are not hiring predictions.</p>
      <h2>Service providers</h2>
      <p>JobPilot may use Railway for hosting, Google for authentication, Gmail and Gemini services, and Stripe for subscription billing. Each provider processes information under its own terms and privacy commitments.</p>
      <h2>Cookies and analytics</h2>
      <p>JobPilot uses necessary browser storage for login sessions and preferences. Optional page and product analytics run only after consent and are used to improve reliability, onboarding, and feature quality. You can choose necessary-only storage from the cookie banner.</p>
      <h2>Sharing and selling</h2>
      <p>We do not sell personal information. We share information only with service providers required to deliver requested features, when you direct us to send an application or message, or when legally required.</p>
      <h2>Retention and security</h2>
      <p>We retain account data while your account is active and as needed for security, billing, legal, and dispute obligations. We use access controls, encryption in transit, protected provider tokens, rate limits, and audit records, but no online service can guarantee absolute security.</p>
      <h2>Your choices</h2>
      <p>You can control public CV visibility, disconnect integrations, opt out of product updates, export your account data, and request permanent deletion from Settings. Subscription records may be retained where legally required.</p>
      <h2>Children</h2>
      <p>JobPilot is intended for people aged 18 or older and is not directed to children.</p>
      <h2>Contact</h2>
      <p>Email privacy questions to <a href="mailto:ai.jobpilot@gmail.com">ai.jobpilot@gmail.com</a> or use the <Link to="/support">support form</Link>.</p>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="legal-lead">These are launch-draft terms for JobPilot AI v2.0.1 and should be reviewed by qualified US counsel before full commercial launch.</p>
      <h2>The service</h2>
      <p>JobPilot provides career organization, job discovery, document assistance, communication tools, and interview coaching. It does not guarantee employment, interviews, offers, accuracy of third-party listings, or delivery by external providers.</p>
      <h2>Your responsibilities</h2>
      <p>You must provide truthful information, use a CV that belongs to you or that you are authorized to manage, review all generated content, and obtain permission before contacting another person. You may not impersonate others, misrepresent experience, abuse integrations, scrape prohibited services, or use JobPilot for unlawful activity.</p>
      <h2>AI-generated content</h2>
      <p>AI output can be incomplete or incorrect. You remain responsible for verifying every application, claim, recipient, attachment, and message before approval or sending.</p>
      <h2>Subscriptions</h2>
      <p>Pro subscriptions renew according to the price and billing period displayed at checkout until cancelled. You can manage or cancel through the Stripe Customer Portal. Access may change after cancellation, failed payment, refund, or chargeback. Refunds are provided where required by law or expressly stated at checkout.</p>
      <h2>Account security</h2>
      <p>You are responsible for protecting login credentials, verifying your account email when required, and reporting unauthorized access. We may limit or suspend accounts used for fraud, abuse, security attacks, or violations of these terms.</p>
      <h2>Third-party services</h2>
      <p>Google, Gmail, Stripe, job boards, employers, and communication providers are independent services governed by their own terms. JobPilot is not responsible for their availability or decisions.</p>
      <h2>Changes and termination</h2>
      <p>Features and these terms may change as the product evolves. Material changes will be communicated through the product or account email. You may stop using JobPilot and delete your account, subject to active subscription and legal-retention requirements.</p>
      <h2>Contact</h2>
      <p>Email questions to <a href="mailto:ai.jobpilot@gmail.com">ai.jobpilot@gmail.com</a> or use the <Link to="/support">support form</Link>.</p>
    </>
  )
}

export default function LegalPage({ type }) {
  return (
    <div className="legal-shell">
      <header className="legal-header">
        <Link className="marketing-brand" to="/"><span className="brand-mark"><Zap size={17} /></span><span><strong>JobPilot</strong><small>v2.0.1</small></span></Link>
        <Link className="text-link" to="/"><ArrowLeft size={15} /> Back to JobPilot</Link>
      </header>
      <main className="legal-document">
        <span className="legal-badge"><ShieldCheck size={15} /> Effective {effectiveDate}</span>
        {type === 'privacy' ? <PrivacyPolicy /> : <Terms />}
      </main>
    </div>
  )
}
