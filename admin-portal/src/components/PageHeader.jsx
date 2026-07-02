export default function PageHeader({ title, description, meta, actions }) {
  return (
    <section className="page-heading">
      <div className="page-title-group">
        <div className="page-title-line">
          <h1>{title}</h1>
          {meta && <span className="page-meta">{meta}</span>}
        </div>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </section>
  )
}
