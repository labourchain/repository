import { readFile } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import type { Fiber, FiberState, Plugin } from '@deepseek-ai/cordis'

/** Stable source identity shared by every build of this Bootstrap version. */
export const BOOTSTRAP_PLUGIN = Object.freeze({
  name: 'repository.bootstrap',
  version: '0.1.0',
} as const)

export const BOOTSTRAP_RUNTIME_ABI = 1 as const

export type BootstrapSourceIdentity = typeof BOOTSTRAP_PLUGIN

export interface BootstrapArtifactIdentity extends BootstrapSourceIdentity {
  /** Core PluginHash of the exact built Bootstrap artifact. */
  readonly pluginHash: string
}

export interface RepositoryPluginEntry {
  /** Cordis plugin to mount into the Repository root Context. */
  readonly plugin: Plugin
  /** Plugin configuration passed unchanged to Cordis. */
  readonly config?: unknown
}

export interface CreateRepositoryNodeOptions {
  /** Complete Cordis composition required for this node instance. */
  readonly plugins?: readonly RepositoryPluginEntry[]
  /** Exact artifact identity when the node is started from a built Bootstrap. */
  readonly bootstrap?: BootstrapSourceIdentity | BootstrapArtifactIdentity
}

export interface RepositoryNode {
  /** Root Cordis context owned by this node instance. */
  readonly context: Context
  /** Source identity, plus PluginHash when started from a built artifact. */
  readonly bootstrap: BootstrapSourceIdentity | BootstrapArtifactIdentity
  /** Whether root disposal has been requested. */
  readonly disposed: boolean
  /** Dispose the root Cordis fiber and every child plugin it owns. */
  dispose(): Promise<void>
}

export class BootstrapStartupError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'BootstrapStartupError'
  }
}

const FIBER_PENDING = 0 as FiberState.PENDING
const FIBER_ACTIVE = 2 as FiberState.ACTIVE

type MountedFiber = Fiber & PromiseLike<Fiber>

function mountPlugin(context: Context, entry: RepositoryPluginEntry): MountedFiber {
  return Reflect.apply(context.plugin, context, [entry.plugin, entry.config]) as MountedFiber
}

function pendingDiagnostic(fiber: Fiber): string {
  const missing = Object.keys(fiber.inject)
    .filter((service) => fiber.ctx.get(service) === undefined)
  return missing.length > 0
    ? `pending (waiting for services: ${missing.join(', ')})`
    : 'pending (dependency unavailable)'
}

/**
 * Wait until the complete mounted composition stops producing lifecycle work.
 *
 * Fibers are mounted first because a Cordis plugin may legitimately depend on
 * a service provided by a later composition entry. `Fiber.await()` alone is
 * insufficient for a PENDING fiber because there is no in-flight lifecycle
 * work until its dependency appears.
 */
async function settleComposition(fibers: readonly MountedFiber[]): Promise<void> {
  const maxPasses = Math.max(2, fibers.length + 1)

  for (let pass = 0; pass < maxPasses; pass += 1) {
    await Promise.all(fibers.map((fiber) => fiber.await()))
    await Promise.resolve()
    if (!fibers.some((fiber) => fiber.inertia)) break
  }

  const inactive = fibers.filter((fiber) => fiber.state !== FIBER_ACTIVE)
  if (inactive.length === 0) return

  const diagnostics = inactive.map((fiber) => {
    if (fiber.state === FIBER_PENDING) return `${fiber.name}: ${pendingDiagnostic(fiber)}`
    return `${fiber.name}: inactive fiber state ${String(fiber.state)}`
  })
  throw new Error(`Repository composition did not activate:\n${diagnostics.join('\n')}`)
}

/**
 * Read the exact PluginHash sidecar generated for the built Bootstrap.
 *
 * Core validates and hashes the full artifact during build. Runtime only reads
 * the resulting identity and checks that it belongs to this source version;
 * it does not duplicate Core canonicalization or hashing rules.
 */
export async function loadBootstrapArtifactIdentity(
  url: URL = new URL('./bootstrap.plugin.json', import.meta.url),
): Promise<BootstrapArtifactIdentity> {
  const parsed = JSON.parse(await readFile(url, 'utf8')) as {
    plugin?: { name?: unknown; version?: unknown }
    pluginHash?: unknown
  }

  if (
    parsed.plugin?.name !== BOOTSTRAP_PLUGIN.name
    || parsed.plugin.version !== BOOTSTRAP_PLUGIN.version
    || typeof parsed.pluginHash !== 'string'
  ) {
    throw new BootstrapStartupError('Built Bootstrap Plugin identity is invalid.')
  }

  return Object.freeze({
    ...BOOTSTRAP_PLUGIN,
    pluginHash: parsed.pluginHash,
  })
}

/**
 * Start one Repository node runtime.
 *
 * Bootstrap creates one root Cordis Context, mounts the entire supplied
 * composition through Cordis, waits for it to settle, and fails closed if any
 * required entry remains inactive. It does not own a second plugin registry,
 * dependency graph, or lifecycle system.
 */
export async function createRepositoryNode(
  options: CreateRepositoryNodeOptions = {},
): Promise<RepositoryNode> {
  const context = new Context()

  try {
    const fibers = (options.plugins ?? []).map((entry) => mountPlugin(context, entry))
    await settleComposition(fibers)
  } catch (cause) {
    await context.fiber.dispose()
    throw new BootstrapStartupError('Repository node startup failed.', { cause })
  }

  let disposal: Promise<void> | undefined

  return {
    context,
    bootstrap: options.bootstrap ?? BOOTSTRAP_PLUGIN,
    get disposed() {
      return disposal !== undefined
    },
    dispose() {
      return disposal ??= Promise.resolve(context.fiber.dispose())
    },
  }
}
