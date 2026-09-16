import { copyFile, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const libDir = resolve(root, 'lib')
const schemaSource = resolve(root, 'plugin/bootstrap.cue')
const schemaPath = resolve(libDir, 'bootstrap.cue')
const sidecarPath = resolve(libDir, 'bootstrap.plugin.json')

async function loadCorePluginTools() {
  const explicit = process.env.LABOURCHAIN_CORE_PLUGINS_MODULE
  if (explicit) {
    return import(pathToFileURL(resolve(explicit)).href)
  }

  try {
    return await import('@labourchain/core-plugins')
  } catch (cause) {
    throw new Error(
      'Core Plugin tooling is unavailable. Install/link @labourchain/core-plugins '
      + 'or set LABOURCHAIN_CORE_PLUGINS_MODULE to its built lib/index.js.',
      { cause },
    )
  }
}

async function walkRuntimeJs(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkRuntimeJs(path))
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path)
    }
  }
  return files
}

function artifactPath(path) {
  return relative(libDir, path).split(sep).join('/')
}

async function readArtifactFiles(paths) {
  const entries = await Promise.all(paths.map(async (path) => {
    const bytes = await readFile(resolve(libDir, path))
    return [path, bytes]
  }))
  return new Map(entries)
}

async function build() {
  const core = await loadCorePluginTools()
  const runtime = await import(pathToFileURL(resolve(libDir, 'index.js')).href)

  await copyFile(schemaSource, schemaPath)

  const runtimePaths = (await walkRuntimeJs(libDir))
    .map(artifactPath)
    .sort()
  const paths = [...runtimePaths, 'bootstrap.cue'].sort()
  const artifact = await readArtifactFiles(paths)

  const files = paths.map((path) => {
    const bytes = artifact.get(path)
    return {
      path,
      size: bytes.byteLength,
      hash: core.fileHash(bytes),
    }
  })

  const plugin = {
    name: runtime.BOOTSTRAP_PLUGIN.name,
    version: runtime.BOOTSTRAP_PLUGIN.version,
    runtime: {
      kind: 'js-esm',
      abi: runtime.BOOTSTRAP_RUNTIME_ABI,
      entry: 'bin.js',
    },
    schema: 'bootstrap.cue',
    dependencies: [],
    files,
  }

  const expected = core.pluginHash(plugin)
  const verified = core.verifyArtifact(plugin, artifact, expected)
  if (verified !== expected) {
    throw new Error('Core returned an unexpected Bootstrap PluginHash.')
  }

  await writeFile(sidecarPath, `${JSON.stringify({ pluginHash: verified, plugin }, null, 2)}\n`)
  process.stdout.write(`Bootstrap PluginHash: ${verified}\n`)
}

async function verify() {
  const core = await loadCorePluginTools()
  const runtime = await import(pathToFileURL(resolve(libDir, 'index.js')).href)
  const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'))

  if (
    sidecar?.plugin?.name !== runtime.BOOTSTRAP_PLUGIN.name
    || sidecar?.plugin?.version !== runtime.BOOTSTRAP_PLUGIN.version
    || sidecar?.plugin?.runtime?.abi !== runtime.BOOTSTRAP_RUNTIME_ABI
  ) {
    throw new Error('Bootstrap Plugin sidecar does not match the built source identity.')
  }

  const paths = sidecar.plugin.files.map((file) => file.path)
  const artifact = await readArtifactFiles(paths)
  const verified = core.verifyArtifact(sidecar.plugin, artifact, sidecar.pluginHash)
  if (verified !== sidecar.pluginHash) {
    throw new Error('Bootstrap PluginHash verification returned an unexpected identity.')
  }

  process.stdout.write(`Bootstrap artifact verified: ${verified}\n`)
}

const command = process.argv[2]
if (command === 'build') {
  await build()
} else if (command === 'verify') {
  await verify()
} else {
  throw new Error(`Expected "build" or "verify", received ${JSON.stringify(command)}.`)
}
