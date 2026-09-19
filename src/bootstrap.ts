import { Context } from '@deepseek-ai/cordis'
import type { Fiber, Plugin } from '@deepseek-ai/cordis'

/** Stable human-readable Protocol reference for the Bootstrap source contract. */
export const BOOTSTRAP_PROTOCOL_REFERENCE = Object.freeze({
  name: 'repository.bootstrap',
  version: '0.1.0',
} as const)

export type BootstrapProtocolReference = typeof BOOTSTRAP_PROTOCOL_REFERENCE

export interface RepositoryPluginEntry {
  /** Cordis plugin to mount into the Repository root Context. */
  readonly plugin: Plugin
  /** Plugin configuration passed unchanged to Cordis. */
  readonly config?: unknown
}

export interface CreateRepositoryNodeOptions {
  /** Complete Cordis composition required for this node instance. */
  readonly plugins?: readonly RepositoryPluginEntry[]
}

export interface RepositoryNode {
  /** Root Cordis context owned by this node instance. */
  readonly context: Context
  /** Stable human-readable Protocol reference for this Bootstrap source contract. */
  readonly bootstrap: BootstrapProtocolReference
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

type MountedFiber = Fiber & PromiseLike<Fiber>

function mountPlugin(context: Context, entry: RepositoryPluginEntry): MountedFiber {
  return context.plugin(entry.plugin, entry.config)
}

function inactiveDiagnostic(fiber: Fiber): string {
  const missing = Object.keys(fiber.inject)
    .filter((service) => fiber.ctx.get(service) === undefined)
  return missing.length > 0
    ? `waiting for services: ${missing.join(', ')}`
    : 'inactive'
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
  do {
    await Promise.all(fibers.map((fiber) => fiber.await()))
  } while (fibers.some((fiber) => fiber.inertia))

  const inactive = fibers.filter((fiber) => fiber.store === undefined)
  if (inactive.length === 0) return

  const diagnostics = inactive
    .map((fiber) => `${fiber.name}: ${inactiveDiagnostic(fiber)}`)
  throw new Error(`Repository composition did not activate:\n${diagnostics.join('\n')}`)
}

/**
 * Start one Repository node runtime.
 *
 * Bootstrap creates one root Cordis Context, mounts the entire supplied
 * composition through Cordis, waits for it to settle, and fails closed if any
 * required entry remains inactive. It does not own a second plugin registry,
 * dependency graph, or lifecycle system.
 *
 * Exact Protocol identity is not constructed here. Under Core v0.1.0 that
 * authority is the verified Protocol descriptor + ProtocolHash supplied by the
 * Host/runtime boundary. Bootstrap only owns process/runtime composition.
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
    bootstrap: BOOTSTRAP_PROTOCOL_REFERENCE,
    get disposed() {
      return disposal !== undefined
    },
    dispose() {
      return disposal ??= Promise.resolve(context.fiber.dispose())
    },
  }
}
