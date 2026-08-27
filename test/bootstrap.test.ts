import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import {
  BOOTSTRAP_PLUGIN,
  BootstrapStartupError,
  createRepositoryNode,
} from '../src/index.ts'

test('exposes the stable Bootstrap Plugin source identity', async () => {
  const node = await createRepositoryNode()

  assert.deepEqual(node.bootstrap, BOOTSTRAP_PLUGIN)
  assert.equal(node.bootstrap.name, 'repository.bootstrap')
  assert.equal(node.bootstrap.version, '0.1.0')

  await node.dispose()
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

  const node = await createRepositoryNode({ plugins: [lifecyclePlugin] })

  assert.deepEqual(events, ['apply', 'acquire'])
  assert.equal(node.disposed, false)

  await node.dispose()
  await node.dispose()

  assert.equal(node.disposed, true)
  assert.deepEqual(events, ['apply', 'acquire', 'dispose'])
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
    createRepositoryNode({ plugins: [loadedPlugin, failingPlugin] }),
    (error: unknown) => {
      assert.ok(error instanceof BootstrapStartupError)
      assert.equal(error.cause, startupCause)
      return true
    },
  )

  assert.deepEqual(events, ['acquire', 'dispose'])
})

test('startup reports cleanup failure without hiding the original startup failure', async () => {
  const startupCause = new Error('startup failed')
  const cleanupCause = new Error('cleanup failed')

  function cleanupFailingPlugin(ctx: Context) {
    ctx.effect(() => () => {
      throw cleanupCause
    })
  }

  function failingPlugin() {
    throw startupCause
  }

  await assert.rejects(
    createRepositoryNode({ plugins: [cleanupFailingPlugin, failingPlugin] }),
    (error: unknown) => {
      assert.ok(error instanceof BootstrapStartupError)
      assert.ok(error.cause instanceof AggregateError)
      assert.deepEqual(error.cause.errors, [startupCause, cleanupCause])
      return true
    },
  )
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
