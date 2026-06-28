#!/usr/bin/env node

const siteUrl = String(process.argv[2] || process.env.FRONTEND_URL || process.env.APP_BASE_URL || '').replace(/\/$/, '')
const key = String(process.env.INDEXNOW_KEY || process.argv[3] || '').trim()

if (!siteUrl || !/^https?:\/\//i.test(siteUrl)) {
  console.error('Usage: INDEXNOW_KEY=<key> node scripts/submit-indexnow.mjs https://your-site.example')
  process.exit(1)
}

if (!key) {
  console.error('INDEXNOW_KEY is required')
  process.exit(1)
}

function hostName(url) {
  return new URL(url).hostname
}

async function sitemapUrls() {
  const response = await fetch(`${siteUrl}/sitemap.xml`)
  if (!response.ok) throw new Error(`Could not fetch sitemap: ${response.status}`)
  const xml = await response.text()
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(match => match[1].trim())
    .filter(Boolean)
  return urls.length ? urls : [siteUrl]
}

const urlList = await sitemapUrls()
const keyLocation = `${siteUrl}/${key}.txt`
const payload = {
  host: hostName(siteUrl),
  key,
  keyLocation,
  urlList,
}

const response = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
})

const body = await response.text()
console.log(JSON.stringify({
  status: response.status,
  ok: response.ok || response.status === 202,
  submitted: urlList.length,
  keyLocation,
  response: body,
}, null, 2))

if (!response.ok && response.status !== 202) process.exit(1)
