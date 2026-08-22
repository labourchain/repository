import { spawnSync } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: process.cwd(),
  encoding: 'utf8',
})

if (result.error) throw result.error
if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const packs = JSON.parse(result.stdout)
const files = packs[0]?.files?.map((entry) => entry.path) ?? []

const forbiddenPrefixes = [
  'docs/',
  'specs/',
  'src/',
  'test/',
  'scripts/',
  '.github/',
]

const forbiddenFiles = new Set([
  'AGENTS.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
])

const leaked = files.filter((file) =>
  forbiddenPrefixes.some((prefix) => file.startsWith(prefix)) || forbiddenFiles.has(file),
)

if (leaked.length > 0) {
  console.error('Development artifacts leaked into the npm package:')
  for (const file of leaked) console.error(`- ${file}`)
  process.exit(1)
}

const requiredFiles = ['package.json', 'README.md', 'LICENSE']
for (const file of requiredFiles) {
  if (!files.includes(file)) {
    console.error(`Required package file is missing: ${file}`)
    process.exit(1)
  }
}

const runtimeFiles = files.filter((file) => file.startsWith('lib/'))
if (runtimeFiles.length === 0) {
  console.error('No built runtime files under lib/ were found in the package.')
  process.exit(1)
}

console.log('Package contents verified: runtime artifacts only; docs/specs remain source-only.')
