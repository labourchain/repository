import { Context } from '@deepseek-ai/cordis'
import type { Plugin } from '@deepseek-ai/cordis'

/**
 * Source-level identity of the executable Repository bootstrap.
 *
 * Core's complete PluginManifest is an artifact-level object because it locks
 * the final runtime files by exact size/hash. Repository therefore keeps only
 * the stable Plugin name/version in source and leaves complete manifest/hash
 * construction to Core artifact tooling.
 */
export const BOOTSTRAP_PLUGIN = Object.freeze({
  name: 'repository.bootstrap',
  version: '0.1.0',
} as const)

export type BootstrapPluginIdentity = typeof BOOTSTRAP_PLUGIN

export interface CreateRepositoryNodeOptions {
  /** Cordis plugins composed into this node instance. */
  plugins?: readonly Plugin[]
}

export interface RepositoryNode {
  /** Root Cordis context owned by this node instance. */
  readonly context: Context
  /** Stable source identity of the executable Bootstrap Plugin. */
  readonly bootstrap: BootstrapPluginIdentity
  /** Whether this wrapper has already requested root disposal. */
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

/**
 * Start one Repository node runtime.
 *
 * The root Context is the only runtime container created here. All configured
 * capabilities are mounted with Cordis itself; Bootstrap does not maintain a
 * parallel plugin registry, dependency graph, or lifecycle system.
 */
export async function createRepositoryNode(
  options: CreateRepositoryNodeOptions = {},
): Promise<RepositoryNode> {
  const context = new Context()

  try {
    for (const plugin of options.plugins ?? []) {
      await context.plugin(plugin)
    }
  } catch (cause) {
    try {
      await context.fiber.dispose()
    } catch (disposeCause) {
      throw new BootstrapStartupError(
        'Repository node startup failed and Cordis cleanup also failed.',
        { cause: new AggregateError([cause, disposeCause]) },
      )
    }

    throw new BootstrapStartupError('Repository node startup failed.', { cause })
  }

  let disposed = false

  return {
    context,
    bootstrap: BOOTSTRAP_PLUGIN,
    get disposed() {
      return disposed
    },
    async dispose() {
      if (disposed) return
      disposed = true
      await context.fiber.dispose()
    },
  }
}
