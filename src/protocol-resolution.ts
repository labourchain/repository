import { gunzipSync } from 'node:zlib'
import type { Context, Fiber, Plugin } from '@deepseek-ai/cordis'

export const CORE_PROTOCOL_PROTOCOL_SERVICE =
  'protocol:core.protocol@0.1.0' as const
export const PROTOCOL_RESOLUTION_SERVICE = 'protocolResolution' as const
export const PROTOCOL_RESOLUTION_PLUGIN_NAME =
  'runtime.protocol-resolution' as const

const DIGEST_RE = /^[0-9a-f]{64}$/u
const MAX_RUNTIME_BYTES = 1024 * 1024

export interface ProtocolRuntime {
  readonly kind: string
  readonly abi: number
}

export interface ProtocolDependency {
  readonly name: string
  readonly version: string
  readonly protocolHash: string
}

export interface ProtocolDescriptor {
  readonly name: string
  readonly version: string
  readonly runtime: ProtocolRuntime
  readonly dependencies: readonly ProtocolDependency[]
  readonly artifactHash: string
  readonly artifact?: string
}

export interface CoreProtocolService {
  validateProtocol(value: unknown): ProtocolDescriptor
  verifyArtifact(
    protocol: unknown,
    bytes: Uint8Array,
    expectedProtocolHash?: string,
  ): string
  verifyEmbeddedArtifact(
    protocol: unknown,
    expectedProtocolHash?: string,
  ): string
}

export interface ProtocolArtifactResolution {
  readonly protocol: unknown
  readonly artifact?: Uint8Array
}

export interface ProtocolResolutionHost {
  resolveArtifact(
    protocolHash: string,
  ): Promise<ProtocolArtifactResolution | undefined>
  evaluateRuntime(
    protocol: ProtocolDescriptor,
    runtimeBytes: Uint8Array,
    protocolHash: string,
  ): Promise<unknown>
}

export interface ProtocolResolutionConfig {
  readonly host: ProtocolResolutionHost
}

export interface ResolvedProtocolView {
  readonly protocolHash: string
  readonly reference: string
  readonly service: string
}

export class ProtocolResolutionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProtocolResolutionError'
  }
}

export class ProtocolResolutionConfigError extends ProtocolResolutionError {
  constructor(message: string) {
    super(message)
    this.name = 'ProtocolResolutionConfigError'
  }
}

export class ProtocolUnavailableError extends ProtocolResolutionError {
  readonly protocolHash: string

  constructor(protocolHash: string) {
    super(`Exact ProtocolHash is unavailable: ${protocolHash}`)
    this.name = 'ProtocolUnavailableError'
    this.protocolHash = protocolHash
  }
}

export class ProtocolArtifactUnavailableError extends ProtocolResolutionError {
  readonly protocolHash: string

  constructor(protocolHash: string) {
    super(`Executable artifact is unavailable for ProtocolHash: ${protocolHash}`)
    this.name = 'ProtocolArtifactUnavailableError'
    this.protocolHash = protocolHash
  }
}

export class ProtocolBuildConflictError extends ProtocolResolutionError {
  readonly reference: string
  readonly acceptedProtocolHash: string
  readonly conflictingProtocolHash: string

  constructor(
    reference: string,
    acceptedProtocolHash: string,
    conflictingProtocolHash: string,
  ) {
    super(
      `Protocol build conflict for ${reference}: ` +
        `${acceptedProtocolHash} != ${conflictingProtocolHash}`,
    )
    this.name = 'ProtocolBuildConflictError'
    this.reference = reference
    this.acceptedProtocolHash = acceptedProtocolHash
    this.conflictingProtocolHash = conflictingProtocolHash
  }
}

export class ProtocolReferenceMismatchError extends ProtocolResolutionError {
  constructor(expected: string, actual: string) {
    super(`Protocol reference mismatch: expected ${expected}, got ${actual}`)
    this.name = 'ProtocolReferenceMismatchError'
  }
}

export class ProtocolRuntimeError extends ProtocolResolutionError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProtocolRuntimeError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    'protocol:core.protocol@0.1.0': CoreProtocolService
    protocolResolution: ProtocolResolutionService
  }
}

function requireConfig(config: ProtocolResolutionConfig): ProtocolResolutionHost {
  if (
    !config ||
    typeof config.host !== 'object' ||
    config.host === null ||
    typeof config.host.resolveArtifact !== 'function' ||
    typeof config.host.evaluateRuntime !== 'function'
  ) {
    throw new ProtocolResolutionConfigError(
      'protocol resolution requires Host resolveArtifact and evaluateRuntime functions.',
    )
  }
  return config.host
}

function requireProtocolHash(value: string): string {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    throw new ProtocolResolutionError(
      'ProtocolHash must be 64-character lowercase hexadecimal.',
    )
  }
  return value
}

function protocolReference(protocol: ProtocolDescriptor): string {
  return `${protocol.name}@${protocol.version}`
}

function serviceKey(protocol: ProtocolDescriptor): string {
  return `protocol:${protocol.name}@${protocol.version}`
}

function decodeEmbeddedArtifact(protocol: ProtocolDescriptor): Uint8Array {
  if (protocol.artifact === undefined) {
    throw new ProtocolRuntimeError(
      `Protocol ${protocolReference(protocol)} has no executable artifact.`,
    )
  }
  return Buffer.from(protocol.artifact, 'base64')
}

function gunzipRuntime(artifact: Uint8Array): Uint8Array {
  try {
    return gunzipSync(artifact, { maxOutputLength: MAX_RUNTIME_BYTES })
  } catch (cause) {
    throw new ProtocolRuntimeError(
      'Unable to decode Protocol runtime within the 1 MiB ABI v1 limit.',
      { cause },
    )
  }
}

function injectedServices(plugin: Record<string, unknown>): Set<string> {
  const inject = plugin.inject

  if (Array.isArray(inject)) {
    if (inject.some((service) => typeof service !== 'string')) {
      throw new ProtocolRuntimeError(
        'Protocol plugin.inject array must contain service names.',
      )
    }
    return new Set(inject as string[])
  }

  if (typeof inject === 'object' && inject !== null) {
    return new Set(Object.keys(inject))
  }

  throw new ProtocolRuntimeError(
    'Protocol plugin.inject must be a Cordis array or object declaration.',
  )
}

function validateRuntimeModule(
  protocol: ProtocolDescriptor,
  namespace: unknown,
): Plugin {
  if (typeof namespace !== 'object' || namespace === null) {
    throw new ProtocolRuntimeError(
      `${protocol.name} runtime namespace must be an ESM module namespace.`,
    )
  }

  const exports = Object.keys(namespace)
  if (exports.length !== 1 || exports[0] !== 'plugin') {
    throw new ProtocolRuntimeError(
      `${protocol.name} runtime must export exactly "plugin".`,
    )
  }

  const plugin = (namespace as Record<string, unknown>).plugin
  if (typeof plugin !== 'object' || plugin === null || Array.isArray(plugin)) {
    throw new ProtocolRuntimeError(
      `${protocol.name} plugin must be a Cordis object Plugin.`,
    )
  }

  const value = plugin as Record<string, unknown>
  const reference = protocolReference(protocol)
  const service = serviceKey(protocol)

  if (value.name !== reference) {
    throw new ProtocolRuntimeError(
      `${protocol.name} plugin.name must be ${reference}.`,
    )
  }
  if (value.provide !== service) {
    throw new ProtocolRuntimeError(
      `${protocol.name} plugin.provide must be ${service}.`,
    )
  }
  if (typeof value.apply !== 'function') {
    throw new ProtocolRuntimeError(
      `${protocol.name} plugin.apply must be callable.`,
    )
  }

  const inject = injectedServices(value)
  const declaredProtocolServices = new Set(
    protocol.dependencies.map(
      (dependency) => `protocol:${dependency.name}@${dependency.version}`,
    ),
  )

  for (const required of declaredProtocolServices) {
    if (!inject.has(required)) {
      throw new ProtocolRuntimeError(
        `${protocol.name} runtime is missing declared Protocol dependency ${required}.`,
      )
    }
  }

  for (const runtimeDependency of inject) {
    if (
      runtimeDependency.startsWith('protocol:') &&
      !declaredProtocolServices.has(runtimeDependency)
    ) {
      throw new ProtocolRuntimeError(
        `${protocol.name} runtime injects undeclared Protocol dependency ${runtimeDependency}.`,
      )
    }
  }

  return plugin as Plugin
}

function sameReference(
  protocol: ProtocolDescriptor,
  expectedReference: string,
): void {
  const actual = protocolReference(protocol)
  if (actual !== expectedReference) {
    throw new ProtocolReferenceMismatchError(expectedReference, actual)
  }
}

export class ProtocolResolutionService {
  private readonly ctx: Context
  private readonly host: ProtocolResolutionHost
  private readonly resolvedByHash = new Map<string, ResolvedProtocolView>()
  private readonly hashByReference = new Map<string, string>()
  private readonly inFlight = new Map<string, Promise<ResolvedProtocolView>>()
  private readonly waitingFor = new Map<string, string>()

  constructor(ctx: Context, host: ProtocolResolutionHost) {
    this.ctx = ctx
    this.host = host
  }

  async resolve(
    reference: string,
    protocolHash: string,
  ): Promise<ResolvedProtocolView> {
    requireProtocolHash(protocolHash)
    return this.resolveShared(reference, protocolHash, new Set())
  }

  private async resolveShared(
    reference: string,
    protocolHash: string,
    stack: Set<string>,
  ): Promise<ResolvedProtocolView> {
    if (stack.has(protocolHash)) {
      throw new ProtocolRuntimeError(
        `Protocol dependency cycle includes ${protocolHash}.`,
      )
    }

    const resolved = this.resolvedByHash.get(protocolHash)
    if (resolved !== undefined) {
      if (resolved.reference !== reference) {
        throw new ProtocolReferenceMismatchError(reference, resolved.reference)
      }
      if (this.ctx.get(resolved.service) === undefined) {
        throw new ProtocolRuntimeError(
          `Resolved Protocol service is unavailable through Cordis: ${resolved.service}.`,
        )
      }
      return resolved
    }

    const pending = this.inFlight.get(protocolHash)
    if (pending !== undefined) {
      const result = await pending
      if (result.reference !== reference) {
        throw new ProtocolReferenceMismatchError(reference, result.reference)
      }
      return result
    }

    const operation = this.resolveExact(reference, protocolHash, stack)
    this.inFlight.set(protocolHash, operation)

    try {
      return await operation
    } finally {
      if (this.inFlight.get(protocolHash) === operation) {
        this.inFlight.delete(protocolHash)
      }
    }
  }

  private async resolveDependency(
    parentHash: string,
    reference: string,
    protocolHash: string,
    stack: Set<string>,
  ): Promise<ResolvedProtocolView> {
    this.assertNoWaitCycle(parentHash, protocolHash)
    this.waitingFor.set(parentHash, protocolHash)

    try {
      return await this.resolveShared(reference, protocolHash, stack)
    } finally {
      if (this.waitingFor.get(parentHash) === protocolHash) {
        this.waitingFor.delete(parentHash)
      }
    }
  }

  private assertNoWaitCycle(parentHash: string, protocolHash: string): void {
    let current: string | undefined = protocolHash
    const visited = new Set<string>()

    while (current !== undefined && !visited.has(current)) {
      if (current === parentHash) {
        throw new ProtocolRuntimeError(
          `Protocol dependency cycle includes ${parentHash}.`,
        )
      }
      visited.add(current)
      current = this.waitingFor.get(current)
    }
  }

  private async resolveExact(
    reference: string,
    protocolHash: string,
    stack: Set<string>,
  ): Promise<ResolvedProtocolView> {
    const nextStack = new Set(stack)
    nextStack.add(protocolHash)

    const source = await this.host.resolveArtifact(protocolHash)
    if (source === undefined) {
      throw new ProtocolUnavailableError(protocolHash)
    }

    const core = this.ctx[CORE_PROTOCOL_PROTOCOL_SERVICE]
    let protocol: ProtocolDescriptor
    try {
      protocol = core.validateProtocol(source.protocol)
    } catch (cause) {
      throw new ProtocolResolutionError(
        `Protocol verification failed for ${protocolHash}.`,
        { cause },
      )
    }

    let artifact: Uint8Array
    if (source.artifact !== undefined) {
      const exactArtifact = Uint8Array.from(source.artifact)
      try {
        core.verifyArtifact(protocol, exactArtifact, protocolHash)
      } catch (cause) {
        throw new ProtocolResolutionError(
          `Protocol verification failed for ${protocolHash}.`,
          { cause },
        )
      }
      artifact = exactArtifact
    } else {
      if (protocol.artifact === undefined) {
        throw new ProtocolArtifactUnavailableError(protocolHash)
      }
      try {
        core.verifyEmbeddedArtifact(protocol, protocolHash)
        artifact = decodeEmbeddedArtifact(protocol)
      } catch (cause) {
        throw new ProtocolResolutionError(
          `Protocol verification failed for ${protocolHash}.`,
          { cause },
        )
      }
    }

    sameReference(protocol, reference)

    if (
      protocol.runtime.kind !== 'cordis-js-esm' ||
      protocol.runtime.abi !== 1
    ) {
      throw new ProtocolRuntimeError(
        `Unsupported Protocol runtime for ${reference}.`,
      )
    }

    const acceptedHash = this.hashByReference.get(reference)
    if (acceptedHash !== undefined && acceptedHash !== protocolHash) {
      throw new ProtocolBuildConflictError(
        reference,
        acceptedHash,
        protocolHash,
      )
    }

    this.hashByReference.set(reference, protocolHash)

    try {
      for (const dependency of protocol.dependencies) {
        await this.resolveDependency(
          protocolHash,
          `${dependency.name}@${dependency.version}`,
          dependency.protocolHash,
          nextStack,
        )
      }

      const service = serviceKey(protocol)
      if (this.ctx.get(service) !== undefined) {
        throw new ProtocolRuntimeError(
          `Protocol service is already mounted outside exact resolution: ${service}.`,
        )
      }

      const runtimeBytes = gunzipRuntime(artifact)
      const namespace = await this.host.evaluateRuntime(
        protocol,
        runtimeBytes,
        protocolHash,
      )
      const plugin = validateRuntimeModule(protocol, namespace)

      const fiber = this.ctx.plugin(plugin, { protocolHash }) as Fiber &
        PromiseLike<Fiber>
      await fiber

      if (this.ctx.get(service) === undefined) {
        await fiber.dispose()
        throw new ProtocolRuntimeError(
          `Protocol plugin did not provide ${service}.`,
        )
      }

      const view = Object.freeze({
        protocolHash,
        reference,
        service,
      })
      this.resolvedByHash.set(protocolHash, view)
      return view
    } catch (cause) {
      if (this.hashByReference.get(reference) === protocolHash) {
        this.hashByReference.delete(reference)
      }
      if (cause instanceof ProtocolResolutionError) throw cause
      throw new ProtocolRuntimeError(
        `Unable to load Protocol ${reference} for ${protocolHash}.`,
        { cause },
      )
    }
  }
}

export const protocolResolutionPlugin = {
  name: PROTOCOL_RESOLUTION_PLUGIN_NAME,
  provide: PROTOCOL_RESOLUTION_SERVICE,
  inject: [CORE_PROTOCOL_PROTOCOL_SERVICE],
  apply(ctx: Context, config: ProtocolResolutionConfig): void {
    const host = requireConfig(config)
    ctx.provide(
      PROTOCOL_RESOLUTION_SERVICE,
      new ProtocolResolutionService(ctx, host),
    )
  },
}
