import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PACK = path.join(__dirname, 'pack')

function copyDir(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true })
}

function copyBackend(src, dest) {
  const excludedRoots = new Set(['data', 'node_modules', 'test'])
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, {
    recursive: true,
    filter(source) {
      const relative = path.relative(src, source)
      if (!relative) return true
      const [root] = relative.split(path.sep)
      return !excludedRoots.has(root) && relative !== '.env'
    },
  })
}

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

console.log('[desktop] Building web apps...')
execSync('npm run build --workspace=frontend', { cwd: ROOT, stdio: 'inherit' })

console.log('[desktop] Preparing pack folder...')
rm(PACK)
fs.mkdirSync(PACK, { recursive: true })

copyBackend(path.join(ROOT, 'backend'), path.join(PACK, 'backend'))
copyDir(path.join(ROOT, 'frontend', 'dist'), path.join(PACK, 'frontend', 'dist'))

// Fresh production node_modules for the backend dependency tree
const stagingPkg = {
  name: 'jobpilot-pack',
  private: true,
  type: 'module',
  dependencies: JSON.parse(
    fs.readFileSync(path.join(ROOT, 'backend', 'package.json'), 'utf8')
  ).dependencies,
}
fs.writeFileSync(path.join(PACK, 'package.json'), JSON.stringify(stagingPkg, null, 2))
console.log('[desktop] Installing production dependencies into pack...')
execSync('npm install --omit=dev', { cwd: PACK, stdio: 'inherit' })

console.log('[desktop] Rebuilding native modules for Electron...')
execSync('npx electron-rebuild -f -w better-sqlite3', {
  cwd: PACK,
  stdio: 'inherit',
})

// Ensure data directory exists for SQLite
fs.mkdirSync(path.join(PACK, 'backend', 'data'), { recursive: true })

console.log('[desktop] Pack folder ready at desktop/pack')
