import { useEffect, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Copy, ExternalLink, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react'
import { api } from '../api/client.js'
import CvProfileView from '../components/CvProfileView.jsx'

const blankExperience = { title: '', company: '', duration: '', description: '' }
const blankEducation = { degree: '', institution: '', year: '', description: '' }
const blankProject = { name: '', url: '', description: '', technologies: '' }
const editorTabs = [
  ['identity', 'Identity'],
  ['contact', 'Contact'],
  ['style', 'Photos & style'],
  ['skills', 'Skills'],
  ['experience', 'Experience'],
  ['projects', 'Projects'],
  ['education', 'Education'],
  ['extras', 'Extras'],
  ['publish', 'Publish'],
]

export default function ProfileBuilder() {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('identity')

  useEffect(() => {
    api.profile().then(data => setProfile(data.profile)).catch(err => setError(err.message))
  }, [])

  function update(path, value) {
    setProfile(current => {
      const next = structuredClone(current)
      const parts = path.split('.')
      let target = next
      parts.slice(0, -1).forEach((part) => {
        target[part] ||= {}
        target = target[part]
      })
      target[parts.at(-1)] = value
      return next
    })
  }

  function updateItem(collection, index, field, value) {
    setProfile(current => {
      const next = structuredClone(current)
      next[collection][index][field] = value
      return next
    })
  }

  function addItem(collection, value) {
    setProfile(current => ({ ...current, [collection]: [...(current[collection] || []), value] }))
  }

  function removeItem(collection, index) {
    setProfile(current => ({ ...current, [collection]: current[collection].filter((_, itemIndex) => itemIndex !== index) }))
  }

  async function uploadImage(file, kind) {
    if (!file) return
    try {
      const data = await api.uploadProfileImage(file, kind)
      setProfile(current => ({
        ...current,
        images: { ...current.images, [kind]: data.profile.images[kind] },
      }))
      setMessage(`${kind === 'cover' ? 'Cover' : 'Profile'} photo updated.`)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  function moveSection(index, direction) {
    setProfile(current => {
      const next = structuredClone(current)
      const target = index + direction
      if (target < 0 || target >= next.sectionOrder.length) return current
      const [section] = next.sectionOrder.splice(index, 1)
      next.sectionOrder.splice(target, 0, section)
      return next
    })
  }

  function clearImage(kind) {
    setProfile(current => ({ ...current, images: { ...current.images, [kind]: '' } }))
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setMessage('Public CV link copied.')
      setError('')
    } catch {
      setError('Could not copy automatically. Open the public page and copy its address.')
    }
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const data = await api.saveProfile(profile)
      setProfile(data.profile)
      setMessage(data.profile.published ? 'CV webpage saved and published.' : 'CV webpage saved as a private draft.')
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return <p className="muted">Loading CV builder...</p>
  const publicUrl = `${window.location.origin}/cv/${profile.slug}`
  const activeLabel = editorTabs.find(([key]) => key === activeSection)?.[1] || 'Section'

  function renderActiveEditor() {
    if (activeSection === 'style') {
      return (
        <>
          <div className="image-upload-row">
            <div className="image-control"><label className="image-upload"><ImagePlus size={20} />Profile photo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => uploadImage(e.target.files?.[0], 'avatar')} /></label>{profile.images.avatar && <button type="button" className="image-remove" onClick={() => clearImage('avatar')}><X size={14} />Remove</button>}</div>
            <div className="image-control"><label className="image-upload"><ImagePlus size={20} />Cover photo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => uploadImage(e.target.files?.[0], 'cover')} /></label>{profile.images.cover && <button type="button" className="image-remove" onClick={() => clearImage('cover')}><X size={14} />Remove</button>}</div>
          </div>
          <div className="form-grid">
            <label>Accent color<input type="color" value={profile.theme.accent} onChange={e => update('theme.accent', e.target.value)} /></label>
            <label>Template<select value={profile.theme.template} onChange={e => update('theme.template', e.target.value)}><option value="modern">Modern</option><option value="classic">Classic</option><option value="minimal">Minimal</option></select></label>
          </div>
        </>
      )
    }

    if (activeSection === 'contact') {
      return (
        <>
          <div className="form-grid">
            {['email', 'phone', 'website', 'linkedin', 'github'].map(field => <label key={field}>{field[0].toUpperCase() + field.slice(1)}<input value={profile.contact[field] || ''} onChange={e => update(`contact.${field}`, e.target.value)} /></label>)}
          </div>
          <div className="visibility-grid">
            {['email', 'phone', 'location', 'website', 'linkedin', 'github'].map(field => <label key={field}><input type="checkbox" checked={Boolean(profile.visibility[field])} onChange={e => update(`visibility.${field}`, e.target.checked)} />Show {field}</label>)}
          </div>
        </>
      )
    }

    if (activeSection === 'skills') {
      return (
        <>
          <label>Skills<input value={profile.skills.join(', ')} onChange={e => update('skills', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} /></label>
          <p className="muted">Separate skills with commas. These appear in the featured skills and Skills cards.</p>
        </>
      )
    }

    if (activeSection === 'experience') {
      return <CollectionEditor title="Experience" items={profile.experience} fields={['title', 'company', 'duration', 'description']} onChange={(i, f, v) => updateItem('experience', i, f, v)} onAdd={() => addItem('experience', blankExperience)} onRemove={i => removeItem('experience', i)} />
    }

    if (activeSection === 'projects') {
      return <CollectionEditor title="Projects" items={profile.projects} fields={['name', 'url', 'technologies', 'description']} onChange={(i, f, v) => updateItem('projects', i, f, v)} onAdd={() => addItem('projects', blankProject)} onRemove={i => removeItem('projects', i)} />
    }

    if (activeSection === 'education') {
      return <CollectionEditor title="Education" items={profile.education} fields={['degree', 'institution', 'year', 'description']} onChange={(i, f, v) => updateItem('education', i, f, v)} onAdd={() => addItem('education', blankEducation)} onRemove={i => removeItem('education', i)} />
    }

    if (activeSection === 'extras') {
      return (
        <>
          <label>Certifications<input value={profile.certifications.join(', ')} onChange={e => update('certifications', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} /></label>
          <label>Languages<input value={profile.languages.join(', ')} onChange={e => update('languages', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} /></label>
        </>
      )
    }

    if (activeSection === 'publish') {
      return (
        <>
          <div className="section-order-list">{profile.sectionOrder.map((section, index) => <div key={section} className="section-order-row"><label><input type="checkbox" checked={profile.sectionVisibility[section] !== false} onChange={e => update(`sectionVisibility.${section}`, e.target.checked)} />Show {section}</label><span><button type="button" className="icon-button" disabled={index === 0} onClick={() => moveSection(index, -1)} aria-label={`Move ${section} up`}><ArrowUp size={15} /></button><button type="button" className="icon-button" disabled={index === profile.sectionOrder.length - 1} onClick={() => moveSection(index, 1)} aria-label={`Move ${section} down`}><ArrowDown size={15} /></button></span></div>)}</div>
          <label className="publish-toggle"><input type="checkbox" checked={profile.published} onChange={e => update('published', e.target.checked)} /><span><strong>Publish this CV webpage</strong><small>Anyone with the link can view the sections and contact details you enabled.</small></span></label>
          {profile.published && <div className="public-link-row"><input readOnly value={publicUrl} aria-label="Public CV link" /><button type="button" className="button button-secondary" onClick={copyPublicLink}><Copy size={15} />Copy link</button></div>}
        </>
      )
    }

    return (
      <>
        <div className="form-grid">
          <label>Display name<input value={profile.displayName} onChange={e => update('displayName', e.target.value)} /></label>
          <label>Headline<input value={profile.headline} onChange={e => update('headline', e.target.value)} /></label>
          <label>Location<input value={profile.location} onChange={e => update('location', e.target.value)} /></label>
          <label>Public address<input value={profile.slug} onChange={e => update('slug', e.target.value)} /></label>
        </div>
        <label>About<textarea rows="5" value={profile.about} onChange={e => update('about', e.target.value)} /></label>
      </>
    )
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div><span className="eyebrow">Version 2 profile</span><h1>CV Webpage Builder</h1><p>Turn your parsed CV into a shareable profile with your own cover, photo, sections, colors, and privacy choices.</p></div>
        {profile.published && <a className="button button-secondary" href={publicUrl} target="_blank" rel="noreferrer">Open public page <ExternalLink size={15} /></a>}
      </section>
      {error && <div className="alert"><AlertCircle size={18} />{error}</div>}
      {message && <div className="success">{message}</div>}

      <form className="profile-builder" onSubmit={save}>
        <section className="profile-preview-stage">
          <div className="profile-preview-label">Main CV pane · click any card to edit</div>
          <CvProfileView profile={profile} preview activeSection={activeSection} onEditSection={setActiveSection} />
        </section>

        <section className="panel profile-editor-panel editor-section">
          <div className="profile-editor-head">
            <div>
              <span className="eyebrow">Editing</span>
              <h2>{activeLabel}</h2>
            </div>
            <button className="button button-primary" disabled={saving}><Save size={16} />{saving ? 'Saving...' : 'Save CV webpage'}</button>
          </div>
          <div className="profile-section-tabs">
            {editorTabs.map(([key, label]) => (
              <button key={key} type="button" className={activeSection === key ? 'active' : ''} onClick={() => setActiveSection(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="profile-section-editor">
            {renderActiveEditor()}
          </div>
        </section>
      </form>
    </div>
  )
}

function CollectionEditor({ title, items = [], fields, onChange, onAdd, onRemove }) {
  return (
    <section className="collection-editor-block editor-section">
      <div className="panel-head"><h2>{title}</h2><button type="button" className="button button-secondary" onClick={onAdd}><Plus size={15} />Add</button></div>
      <div className="collection-list">
        {items.map((item, index) => <article key={index} className="collection-item">
          <button type="button" className="icon-button collection-remove" onClick={() => onRemove(index)} aria-label={`Remove ${title} item`}><Trash2 size={16} /></button>
          <div className="form-grid">{fields.map(field => <label key={field} className={field === 'description' ? 'wide' : ''}>{field[0].toUpperCase() + field.slice(1)}{field === 'description' ? <textarea rows="3" value={item[field] || ''} onChange={e => onChange(index, field, e.target.value)} /> : <input value={item[field] || ''} onChange={e => onChange(index, field, e.target.value)} />}</label>)}</div>
        </article>)}
        {!items.length && <p className="muted">No {title.toLowerCase()} added yet.</p>}
      </div>
    </section>
  )
}
