import { Award, BadgeCheck, BriefcaseBusiness, Code2, ExternalLink, Github, Globe, GraduationCap, Linkedin, Mail, MapPin, Phone, Sparkles, UserRound } from 'lucide-react'

function safeHref(value = '') {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

function FeedSection({ title, icon: Icon, section, activeSection, onEditSection, children }) {
  const editable = Boolean(onEditSection && section)
  return (
    <section
      id={section ? `cv-section-${section}` : undefined}
      className={`cv-feed-card ${editable ? 'cv-editable-section' : ''} ${activeSection === section ? 'editing' : ''}`}
      onClick={editable ? () => onEditSection(section) : undefined}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={editable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onEditSection(section)
        }
      } : undefined}
    >
      <div className="cv-feed-title">
        <span>{Icon ? <Icon size={17} /> : <Sparkles size={17} />}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function CvProfileView({ profile, preview = false, activeSection = '', onEditSection }) {
  if (!profile) return null
  const visible = profile.sectionVisibility || {}
  const sections = {
    about: visible.about !== false && profile.about && (
      <FeedSection title="About" icon={UserRound} section="about" activeSection={activeSection} onEditSection={onEditSection}><p className="cv-about">{profile.about}</p></FeedSection>
    ),
    skills: visible.skills !== false && profile.skills?.length > 0 && (
      <FeedSection title="Skills" icon={Code2} section="skills" activeSection={activeSection} onEditSection={onEditSection}><div className="cv-skills">{profile.skills.map(skill => <span key={skill}>{skill}</span>)}</div></FeedSection>
    ),
    experience: visible.experience !== false && profile.experience?.length > 0 && (
      <FeedSection title="Experience" icon={BriefcaseBusiness} section="experience" activeSection={activeSection} onEditSection={onEditSection}><div className="cv-timeline">{profile.experience.map((item, index) => (
        <article key={`${item.title}-${index}`}>
          <div><h3>{item.title || 'Role'}</h3><strong>{item.company}</strong></div>
          <span>{item.duration}</span>
          {item.description && <p>{item.description}</p>}
        </article>
      ))}</div></FeedSection>
    ),
    projects: visible.projects !== false && profile.projects?.length > 0 && (
      <FeedSection title="Projects" icon={Sparkles} section="projects" activeSection={activeSection} onEditSection={onEditSection}><div className="cv-card-grid">{profile.projects.map((item, index) => (
        <article key={`${item.name}-${index}`}>
          <h3>{item.name || 'Project'}</h3>
          <p>{item.description}</p>
          {item.technologies && <small>{item.technologies}</small>}
          {item.url && <a href={safeHref(item.url)} target="_blank" rel="noreferrer">View project <ExternalLink size={13} /></a>}
        </article>
      ))}</div></FeedSection>
    ),
    education: visible.education !== false && profile.education?.length > 0 && (
      <FeedSection title="Education" icon={GraduationCap} section="education" activeSection={activeSection} onEditSection={onEditSection}><div className="cv-timeline">{profile.education.map((item, index) => (
        <article key={`${item.degree}-${index}`}>
          <div><h3>{item.degree || 'Qualification'}</h3><strong>{item.institution}</strong></div>
          <span>{item.year}</span>
          {item.description && <p>{item.description}</p>}
        </article>
      ))}</div></FeedSection>
    ),
    certifications: visible.certifications !== false && profile.certifications?.length > 0 && (
      <FeedSection title="Certifications" icon={Award} section="extras" activeSection={activeSection} onEditSection={onEditSection}><ul className="cv-simple-list">{profile.certifications.map(item => <li key={item}>{item}</li>)}</ul></FeedSection>
    ),
    languages: visible.languages !== false && profile.languages?.length > 0 && (
      <FeedSection title="Languages" icon={Globe} section="extras" activeSection={activeSection} onEditSection={onEditSection}><div className="cv-skills">{profile.languages.map(item => <span key={item}>{item}</span>)}</div></FeedSection>
    ),
  }

  const contact = profile.contact || {}
  const contactItems = [
    [profile.location, MapPin, null],
    [contact.email, Mail, contact.email ? `mailto:${contact.email}` : null],
    [contact.phone, Phone, contact.phone ? `tel:${contact.phone}` : null],
    [contact.website, Globe, safeHref(contact.website)],
    [contact.linkedin, Linkedin, safeHref(contact.linkedin)],
    [contact.github, Github, safeHref(contact.github)],
  ].filter(([value]) => value)
  const orderedSections = (profile.sectionOrder || Object.keys(sections)).map(name => sections[name]).filter(Boolean)
  const featuredSkills = (profile.skills || []).slice(0, 8)
  const primaryEmail = contact.email || ''
  const primaryWebsite = contact.website || ''
  const sectionLinks = [
    ['about', 'About', Boolean(sections.about)],
    ['skills', 'Skills', Boolean(sections.skills)],
    ['experience', 'Experience', Boolean(sections.experience)],
    ['projects', 'Projects', Boolean(sections.projects)],
    ['education', 'Education', Boolean(sections.education)],
    ['contact', 'Contact', Boolean(profile.headline || contactItems.length)],
  ].filter(([, , available]) => available)

  return (
    <article
      className={`cv-profile cv-social-profile cv-template-${profile.theme?.template || 'modern'} ${preview ? 'cv-preview' : ''}`}
      style={{ '--cv-accent': profile.theme?.accent || '#176b55' }}
    >
      <div className="cv-social-chrome" aria-hidden="true">
        <span />
        <i />
        <b />
      </div>

      <div className="cv-cover" style={profile.images?.cover ? { backgroundImage: `url(${profile.images.cover})` } : undefined} />
      <header
        className={`cv-identity ${onEditSection ? 'cv-editable-section' : ''} ${activeSection === 'identity' ? 'editing' : ''}`}
        onClick={onEditSection ? () => onEditSection('identity') : undefined}
      >
        <div className="cv-avatar">
          {profile.images?.avatar ? <img src={profile.images.avatar} alt={profile.displayName || 'Profile'} /> : <span>{(profile.displayName || 'CV').slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="cv-title">
          <div className="cv-name-line">
            <h1>{profile.displayName || 'Your name'}</h1>
            <BadgeCheck size={22} />
          </div>
          <p>{profile.headline || 'Professional headline'}</p>
        </div>
        <div className="cv-profile-actions">
          {primaryEmail && <a href={`mailto:${primaryEmail}`}><Mail size={15} /> Message</a>}
          {primaryWebsite && <a href={safeHref(primaryWebsite)} target="_blank" rel="noreferrer"><Globe size={15} /> Website</a>}
        </div>
      </header>

      <nav className="cv-tabs" aria-label="Profile sections">
        {sectionLinks.map(([section, label]) => onEditSection ? (
          <button key={section} type="button" onClick={() => onEditSection(section)}>{label}</button>
        ) : (
          <a key={section} href={`#cv-section-${section}`}>{label}</a>
        ))}
      </nav>

      <div className="cv-content">
        <aside className="cv-side-column">
          <section
            id="cv-section-contact"
            className={`cv-side-card ${onEditSection ? 'cv-editable-section' : ''} ${activeSection === 'contact' ? 'editing' : ''}`}
            onClick={onEditSection ? () => onEditSection('contact') : undefined}
          >
            <h2>Intro</h2>
            <p>{profile.headline || 'Professional profile'}</p>
            {contactItems.length > 0 && (
              <div className="cv-contact">
                {contactItems.map(([value, Icon, href]) => href ? (
                  <a key={`${value}-${href}`} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"><Icon size={15} />{value}</a>
                ) : <span key={`${value}-text`}><Icon size={15} />{value}</span>)}
              </div>
            )}
          </section>

          {featuredSkills.length > 0 && (
            <section
              className={`cv-side-card ${onEditSection ? 'cv-editable-section' : ''} ${activeSection === 'skills' ? 'editing' : ''}`}
              onClick={onEditSection ? () => onEditSection('skills') : undefined}
            >
              <h2>Featured skills</h2>
              <div className="cv-skills compact">{featuredSkills.map(skill => <span key={skill}>{skill}</span>)}</div>
            </section>
          )}
        </aside>

        <div className="cv-feed">
          {orderedSections.length > 0 ? orderedSections.map((section, index) => <div key={index}>{section}</div>) : (
            <FeedSection title="Profile" icon={UserRound} section="identity" activeSection={activeSection} onEditSection={onEditSection}><p className="cv-about">This CV webpage is ready for professional profile details.</p></FeedSection>
          )}
        </div>
      </div>
    </article>
  )
}
