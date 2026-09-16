import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import {
  BOOTSTRAP_PLUGIN,
  BootstrapStartupError,
  createRepositoryNode,
  loadBootstrapArtifactIdentity,
} from '../src/index.ts'

test('exposes the stable Bootstrap Plugin source identity', async () => {
  const node = await createRepositoryNode()

  assert.deepEqual(node.bootstrap, BOOTSTRAP_PLUGIN)
  assert.equal(node.bootstrap.name, 'repository.bootstrap')
  assert.equal(node.bootstrap.version, '0.1.0')

  await node.dispose()
})

test('loads exact built Bootstrap identity from the generated sidecar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'repository-bootstrap-'))
  const path = join(dir, 'bootstrap.plugin.json')
  const pluginHash = 'ab'.repeat(32)
  await writeFile(path, JSON.stringify({ plugin: BOOTSTRAP_PLUGIN, pluginHash }))

  try {
    assert.deepEqual(
      await loadBootstrapArtifactIdentity(new URL(`file://${path}`)),
      { ...BOOTSTRAP_PLUGIN, pluginHash },
    )

    await writeFile(path, JSON.stringify({
      plugin: { ...BOOTSTRAP_PLUGIN, version: '9.9.9' },
      pluginHash,
    }))
    await assert.rejects(
      loadBootstrapArtifactIdentity(new URL(`file://${path}`)),
      BootstrapStartupError,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('passes plugin configuration through the Cordis composition', async () => {
  let observed: unknown

  function configuredPlugin(_ctx: Context, config: { value: string }) {
    observed = config.value
  }

  const node = await createRepositoryNode({
    plugins: [{ plugin: configuredPlugin, config: { value: 'configured' } }],
  })

  assert.equal(observed, 'configured')
  await node.dispose()
})

test('mounts the complete composition before auditing dependency readiness', async () => {
  const events: string[] = []

  const consumer = Object.assign(
    (ctx: Context) => {
      assert.deepEqual(ctx.get('bootstrap-test-service'), { ready: true })
      events.push('consumer')
    },
    { inject: ['bootstrap-test-service'] },
  )

  function provider(ctx: Context) {
    events.push('provider')
    return ctx.provide('bootstrap-test-service', { ready: true })
  }

  const node = await createRepositoryNode({
    plugins: [
      { plugin: consumer },
      { plugin: provider },
    ],
  })

  assert.deepEqual(events, ['provider', 'consumer'])
  await node.dispose()
})

test('fails closed when a required composition dependency remains pending', async () => {
  const pendingPlugin = Object.assign(
    () => {
      assert.fail('pending plugin must not activate')
    },
    { inject: ['missing-bootstrap-service'] },
  )

  await assert.rejects(
    createRepositoryNode({ plugins: [{ plugin: pendingPlugin }] }),
    (error: unknown) => {
      assert.ok(error instanceof BootstrapStartupError)
      assert.match(String(error.cause), /missing-bootstrap-service/)
      return true
    },
  )
})

test('loads configured plugins through Cordis and disposes their effects once', async () => {
  const events: string[] = []

  function lifecyclePlugin(ctx: Context) {
    events.push('apply')
    ctx.effect(() => {
      events.push('acquire')
      return () => events.push('dispose')
    })
  }

  const node = await createRepositoryNode({ plugins: [{ plugin: lifecyclePlugin }] })

  assert.deepEqual(events, ['apply', 'acquire'])
  assert.equal(node.disposed, false)

  await node.dispose()
  await node.dispose()

  assert.equal(node.disposed, true)
  assert.deepEqual(events, ['apply', 'acquire', 'dispose'])
})

test('concurrent dispose calls share the same Cordis cleanup task', async () => {
  let releaseCleanup!: () => void
  const cleanupGate = new Promise<void>((resolve) => {
    releaseCleanup = resolve
  })

  function slowCleanupPlugin(ctx: Context) {
    ctx.effect(() => async () => cleanupGate)
  }

  const node = await createRepositoryNode({ plugins: [{ plugin: slowCleanupPlugin }] })
  const first = node.dispose()
  const second = node.dispose()

  assert.equal(first, second)
  assert.equal(node.disposed, true)

  releaseCleanup()
  await first
})

test('startup failure disposes plugins that were already loaded', async () => {
  const events: string[] = []
  const startupCause = new Error('plugin failed during startup')

  function loadedPlugin(ctx: Context) {
    ctx.effect(() => {
      events.push('acquire')
      return () => events.push('dispose')
    })
  }

  function failingPlugin() {
    throw startupCause
  }

  await assert.rejects(
    createRepositoryNode({
      plugins: [
        { plugin: loadedPlugin },
        { plugin: failingPlugin },
      ],
    }),
    (error: unknown) => {
      assert.ok(error instanceof BootstrapStartupError)
      assert.equal(error.cause, startupCause)
      return true
    },
  )

  assert.deepEqual(events, ['acquire', 'dispose'])
})

test('importing the package entry does not keep a process alive or emit output', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--input-type=module',
      '--eval',
      "await import('./src/index.ts')",
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 2_000,
    },
  )

  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
})
