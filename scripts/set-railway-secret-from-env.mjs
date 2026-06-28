import { spawnSync } from 'node:child_process'
import path from 'node:path'

const [variableName, sourceEnvironmentName] = process.argv.slice(2)
if (!variableName || !sourceEnvironmentName) {
  throw new Error('Usage: node scripts/set-railway-secret-from-env.mjs VARIABLE_NAME SOURCE_ENVIRONMENT_NAME')
}

const value = process.env[sourceEnvironmentName]
if (!value) throw new Error(`Source environment variable is empty: ${sourceEnvironmentName}`)

const railwayCli = path.join(
  process.env.APPDATA || '',
  'npm',
  'node_modules',
  '@railway',
  'cli',
  'bin',
  'railway.js',
)

const result = spawnSync(process.execPath, [
  railwayCli,
  'variable',
  'set',
  '--service',
  'jobpilot-web',
  '--environment',
  'production',
  '--skip-deploys',
  '--stdin',
  variableName,
], {
  input: Buffer.from(value, 'utf8'),
  encoding: 'utf8',
})

if (result.status !== 0) {
  throw new Error(result.stderr || 'Railway variable update failed')
}

console.log(JSON.stringify({ updated: true, variable: variableName }))
