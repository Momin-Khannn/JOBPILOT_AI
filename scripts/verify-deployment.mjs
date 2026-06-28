const baseUrl = process.argv[2]?.replace(/\/$/, '')

if (!baseUrl) {
  console.error('Usage: node scripts/verify-deployment.mjs https://your-domain')
  process.exit(1)
}

const checks = [
  ['/api/health', 'json'],
  ['/robots.txt', 'text'],
  ['/sitemap.xml', 'text'],
  ['/privacy', 'text'],
  ['/terms', 'text'],
  ['/support', 'text'],
]

let failed = false

for (const [path, type] of checks) {
  const url = `${baseUrl}${path}`
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = type === 'json' ? await response.json() : await response.text()
    if (path === '/api/health' && body.status !== 'ok') throw new Error('Health status is not ok')
    if (path === '/robots.txt' && !String(body).includes(`${baseUrl}/sitemap.xml`)) {
      throw new Error('robots.txt does not point at the live sitemap')
    }
    if (path === '/sitemap.xml' && !String(body).includes(`${baseUrl}/`)) {
      throw new Error('sitemap.xml does not include the live domain')
    }
    console.log(`ok ${path}`)
  } catch (error) {
    failed = true
    console.error(`fail ${path}: ${error.message}`)
  }
}

process.exit(failed ? 1 : 0)
