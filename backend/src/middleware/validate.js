function firstIssue(error) {
  const issue = error?.issues?.[0]
  if (!issue) return 'Request data is invalid.'
  const field = issue.path?.length ? `${issue.path.join('.')}: ` : ''
  return `${field}${issue.message}`
}

export function validateRequest(schemas = {}) {
  return (req, res, next) => {
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part]
      if (!schema) continue
      const result = schema.safeParse(req[part] || {})
      if (!result.success) {
        return res.status(400).json({ error: firstIssue(result.error) })
      }
      req[part] = result.data
    }
    next()
  }
}
