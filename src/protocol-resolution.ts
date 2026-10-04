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

interface ExactServiceImplementation {
  readonly fiber: Fiber
}

interface ExactServiceBinding {
  readonly implementation: ExactServiceImplementation
  readonly value: unknown
}

export class ProtocolResolutionService {
  private readonly ctx: Context
  private readonly host: ProtocolResolutionHost
  private readonly resolvedByHash = new Map<string, ResolvedProtocolView>()
  private readonly providerByHash = new Map<string, Fiber>()
  private readonly implementationByHash =
    new Map<string, ExactServiceImplementation>()
  private readonly hashByReference = new Map<string, string>()
  private readonly dependenciesByHash = new Map<
    string,
    readonly ProtocolDependency[]
  >()
  private readonly inFlight = new Map<
    string,
    {
      readonly reference: string
      readonly promise: Promise<ResolvedProtocolView>
    }
  >()
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

  async withExactService<T>(
    reference: string,
    protocolHash: string,
    operation: (service: unknown) => Promise<T> | T,
  ): Promise<T> {
    const resolved = await this.resolve(reference, protocolHash)
    const service = this.requireExactService(resolved)

    try {
      const result = await operation(service)
      this.assertExactProviderTree(protocolHash)
      return result
    } catch (cause) {
      try {
        this.assertExactProviderTree(protocolHash)
      } catch (providerCause) {
        throw new ProtocolRuntimeError(
          `Verified Protocol provider changed during execution: ${resolved.service}.`,
          { cause: providerCause },
        )
      }
      throw cause
    }
  }

  private requireExactService(resolved: ResolvedProtocolView): unknown {
    this.assertExactProviderTree(resolved.protocolHash)
    const implementation = this.implementationByHash.get(
      resolved.protocolHash,
    )
    if (implementation === undefined) {
      throw new ProtocolRuntimeError(
        `Verified Protocol service is unavailable through Cordis: ${resolved.service}.`,
      )
    }

    const service = this.ctx.get(resolved.service)
    if (service === undefined) {
      throw new ProtocolRuntimeError(
        `Verified Protocol service is unavailable through Cordis: ${resolved.service}.`,
      )
    }
    return this.bindExactServiceValue(
      resolved.service,
      implementation,
      service,
    )
  }

  private assertExactImplementation(
    service: string,
    expected: ExactServiceImplementation,
  ): void {
    const current = this.ctx.reflect._getImpl(service)
    if (current !== expected) {
      throw new ProtocolRuntimeError(
        `Verified Protocol provider generation changed: ${service}.`,
      )
    }
  }

  private bindExactServiceValue(
    service: string,
    expected: ExactServiceImplementation,
    value: unknown,
  ): unknown {
    const boundByRaw = new WeakMap<object, unknown>()
    const rawByBound = new WeakMap<object, object>()
    const assertCurrent = () =>
      this.assertExactImplementation(service, expected)
    const isBindable = (candidate: unknown): candidate is object | Function =>
      (typeof candidate === 'object' && candidate !== null) ||
      typeof candidate === 'function'
    const unwrap = (candidate: unknown): unknown => {
      if (!isBindable(candidate)) return candidate
      return rawByBound.get(candidate) ?? candidate
    }
    const descriptorNeedsShadow = (
      descriptor: PropertyDescriptor | undefined,
    ): boolean => {
      if (descriptor === undefined || descriptor.configurable !== false) {
        return false
      }
      if ('value' in descriptor) {
        return descriptor.writable === false && isBindable(descriptor.value)
      }
      return descriptor.get !== undefined || descriptor.set !== undefined
    }
    const hasFixedBindableProperty = (candidate: object): boolean =>
      Reflect.ownKeys(candidate).some((property) =>
        descriptorNeedsShadow(
          Reflect.getOwnPropertyDescriptor(candidate, property),
        ),
      )
    const needsShadowTarget = (candidate: object): boolean =>
      hasFixedBindableProperty(candidate) ||
      (!Reflect.isExtensible(candidate) &&
        Reflect.getPrototypeOf(candidate) !== null)
    const assertSupportedShadowShape = (candidate: object): void => {
      for (const property of Reflect.ownKeys(candidate)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(
          candidate,
          property,
        )
        if (
          descriptor === undefined ||
          descriptor.configurable !== false ||
          ('value' in descriptor
            ? descriptor.writable !== false
            : descriptor.set !== undefined)
        ) {
          throw new ProtocolRuntimeError(
            'Unsupported exact Protocol dependency value shape for ' +
              service +
              ': shadow binding requires fixed own properties.',
          )
        }
      }

      if (
        Reflect.isExtensible(candidate) &&
        !Reflect.preventExtensions(candidate)
      ) {
        throw new ProtocolRuntimeError(
          'Unable to seal exact Protocol dependency value: ' +
            service +
            '.',
        )
      }
    }
    const createShadowTarget = (candidate: object): object => {
      if (typeof candidate === 'function') {
        const shadow = (..._args: unknown[]) => undefined
        Reflect.setPrototypeOf(shadow, Reflect.getPrototypeOf(candidate))
        return shadow
      }
      if (Array.isArray(candidate)) return []
      return Object.create(Reflect.getPrototypeOf(candidate)) as object
    }

    const safeIntrinsicPrototypes = new Set<object>([
      Object.prototype,
      Function.prototype,
      Array.prototype,
      Uint8Array.prototype,
    ])
    const bindPrototype = (prototype: object | null): object | null =>
      prototype === null || safeIntrinsicPrototypes.has(prototype)
        ? prototype
        : bind(prototype) as object

    const bindDescriptor = (
      descriptor: PropertyDescriptor,
    ): PropertyDescriptor => {
      const boundDescriptor: PropertyDescriptor = {
        configurable: descriptor.configurable ?? false,
        enumerable: descriptor.enumerable ?? false,
      }

      if ('value' in descriptor) {
        boundDescriptor.writable = descriptor.writable ?? false
        boundDescriptor.value = bind(descriptor.value)
      } else {
        if (descriptor.get !== undefined) {
          boundDescriptor.get = bind(descriptor.get) as () => unknown
        }
        if (descriptor.set !== undefined) {
          boundDescriptor.set = bind(descriptor.set) as (
            value: unknown,
          ) => void
        }
      }
      return boundDescriptor
    }

    const bind = (candidate: unknown): unknown => {
      if (!isBindable(candidate)) return candidate

      const cached = boundByRaw.get(candidate)
      if (cached !== undefined) return cached

      assertCurrent()
      if (candidate instanceof Promise) {
        const boundPromise = candidate.then((result) => bind(result))
        boundByRaw.set(candidate, boundPromise)
        return boundPromise
      }

      const shadowed = needsShadowTarget(candidate)
      if (shadowed) assertSupportedShadowShape(candidate)
      const proxyTarget = shadowed
        ? createShadowTarget(candidate)
        : candidate
      let bound: object
      const get = (property: PropertyKey) => {
        assertCurrent()
        if (shadowed) {
          return Reflect.get(proxyTarget, property, bound)
        }
        const descriptor = Reflect.getOwnPropertyDescriptor(
          candidate,
          property,
        )
        if (descriptorNeedsShadow(descriptor)) {
          throw new ProtocolRuntimeError(
            'Exact Protocol dependency value changed to an unsupported fixed shape: ' +
              service +
              '.',
          )
        }
        return bind(Reflect.get(candidate, property, candidate))
      }
      const set = (property: PropertyKey, nextValue: unknown) => {
        assertCurrent()
        if (shadowed) return false
        return Reflect.set(
          candidate,
          property,
          unwrap(nextValue),
          candidate,
        )
      }
      const getOwnPropertyDescriptor = (property: PropertyKey) => {
        assertCurrent()
        if (shadowed) {
          return Reflect.getOwnPropertyDescriptor(proxyTarget, property)
        }
        const descriptor = Reflect.getOwnPropertyDescriptor(
          candidate,
          property,
        )
        if (descriptor === undefined) return undefined
        if (descriptorNeedsShadow(descriptor)) {
          throw new ProtocolRuntimeError(
            'Exact Protocol dependency value changed to an unsupported fixed shape: ' +
              service +
              '.',
          )
        }
        return bindDescriptor(descriptor)
      }
      const ownKeys = () => {
        assertCurrent()
        return Reflect.ownKeys(proxyTarget)
      }
      const has = (property: PropertyKey) => {
        assertCurrent()
        return Reflect.has(proxyTarget, property)
      }
      const deleteProperty = (property: PropertyKey) => {
        assertCurrent()
        return Reflect.deleteProperty(proxyTarget, property)
      }
      const isExtensible = () => {
        assertCurrent()
        return Reflect.isExtensible(proxyTarget)
      }
      const getPrototypeOf = (): object | null => {
        assertCurrent()
        if (shadowed) return Reflect.getPrototypeOf(proxyTarget)
        if (!Reflect.isExtensible(candidate)) {
          throw new ProtocolRuntimeError(
            'Exact Protocol dependency value changed to an unsupported non-extensible shape: ' +
              service +
              '.',
          )
        }
        return bindPrototype(Reflect.getPrototypeOf(candidate))
      }
      const defineProperty = () => {
        assertCurrent()
        return false
      }
      const setPrototypeOf = (prototype: object | null) => {
        assertCurrent()
        if (shadowed) {
          return prototype === Reflect.getPrototypeOf(proxyTarget)
        }
        return unwrap(prototype) === Reflect.getPrototypeOf(candidate)
      }
      const preventExtensions = () => {
        assertCurrent()
        return shadowed
      }

      if (typeof candidate === 'function') {
        const callable = candidate as Function
        bound = new Proxy(proxyTarget as Function, {
          apply: (_target, thisArg, args) => {
            assertCurrent()
            const result = Reflect.apply(
              callable,
              unwrap(thisArg),
              args.map(unwrap),
            )
            return bind(result)
          },
          construct: (_target, args, newTarget) => {
            assertCurrent()
            const rawNewTarget = unwrap(newTarget)
            if (typeof rawNewTarget !== 'function') {
              throw new ProtocolRuntimeError(
                'Exact Protocol constructor target is unavailable: ' +
                  service +
                  '.',
              )
            }
            return bind(
              Reflect.construct(
                callable,
                args.map(unwrap),
                rawNewTarget,
              ),
            ) as object
          },
          get: (_target, property) => get(property),
          set: (_target, property, nextValue) =>
            set(property, nextValue),
          getOwnPropertyDescriptor: (_target, property) =>
            getOwnPropertyDescriptor(property),
          ownKeys: () => ownKeys(),
          has: (_target, property) => has(property),
          deleteProperty: (_target, property) =>
            deleteProperty(property),
          isExtensible: () => isExtensible(),
          getPrototypeOf: () => getPrototypeOf(),
          defineProperty: () => defineProperty(),
          setPrototypeOf: (_target, prototype) =>
            setPrototypeOf(prototype),
          preventExtensions: () => preventExtensions(),
        })
      } else {
        bound = new Proxy(proxyTarget, {
          get: (_target, property) => get(property),
          set: (_target, property, nextValue) =>
            set(property, nextValue),
          getOwnPropertyDescriptor: (_target, property) =>
            getOwnPropertyDescriptor(property),
          ownKeys: () => ownKeys(),
          has: (_target, property) => has(property),
          deleteProperty: (_target, property) =>
            deleteProperty(property),
          isExtensible: () => isExtensible(),
          getPrototypeOf: () => getPrototypeOf(),
          defineProperty: () => defineProperty(),
          setPrototypeOf: (_target, prototype) =>
            setPrototypeOf(prototype),
          preventExtensions: () => preventExtensions(),
        })
      }

      boundByRaw.set(candidate, bound)
      rawByBound.set(bound, candidate)

      if (shadowed) {
        const properties = Reflect.ownKeys(candidate)
        if (Array.isArray(candidate)) {
          const index = properties.indexOf('length')
          if (index >= 0) {
            properties.splice(index, 1)
            properties.push('length')
          }
        }

        for (const property of properties) {
          const descriptor = Reflect.getOwnPropertyDescriptor(
            candidate,
            property,
          )
          if (descriptor === undefined) continue

          if (
            !Reflect.defineProperty(
              proxyTarget,
              property,
              bindDescriptor(descriptor),
            )
          ) {
            throw new ProtocolRuntimeError(
              'Unable to bind exact Protocol service value: ' +
                service +
                '.',
            )
          }
        }

        const boundPrototype = bindPrototype(
          Reflect.getPrototypeOf(candidate),
        )
        if (!Reflect.setPrototypeOf(proxyTarget, boundPrototype)) {
          throw new ProtocolRuntimeError(
            'Unable to bind exact Protocol service prototype: ' +
              service +
              '.',
          )
        }
        Reflect.preventExtensions(proxyTarget)
      }

      return bound
    }

    assertCurrent()
    return bind(value)
  }

  private createExactRuntimeContext(protocol: ProtocolDescriptor): Context {
    const bindings = new Map<string, ExactServiceBinding>()
    const meta: Record<string, unknown> = {}

    for (const dependency of protocol.dependencies) {
      const reference = `${dependency.name}@${dependency.version}`
      const resolved = this.resolvedByHash.get(dependency.protocolHash)
      const implementation = this.implementationByHash.get(
        dependency.protocolHash,
      )
      if (
        resolved === undefined ||
        resolved.reference !== reference ||
        implementation === undefined
      ) {
        throw new ProtocolRuntimeError(
          `Verified Protocol dependency is unavailable: ${reference}.`,
        )
      }

      this.assertExactImplementation(resolved.service, implementation)
      const value = this.ctx.get(resolved.service)
      if (value === undefined) {
        throw new ProtocolRuntimeError(
          `Verified Protocol dependency is unavailable: ${reference}.`,
        )
      }
      bindings.set(
        resolved.service,
        Object.freeze({
          implementation,
          value: this.bindExactServiceValue(
            resolved.service,
            implementation,
            value,
          ),
        }),
      )
    }

    meta.get = (name: string, strict = true) => {
      const binding = bindings.get(name)
      if (binding === undefined) return this.ctx.get(name, strict)
      this.assertExactImplementation(name, binding.implementation)
      return binding.value
    }

    for (const [service, binding] of bindings) {
      Object.defineProperty(meta, service, {
        configurable: true,
        enumerable: true,
        get: () => {
          this.assertExactImplementation(
            service,
            binding.implementation,
          )
          return binding.value
        },
      })
    }

    return this.ctx.extend(meta)
  }

  private assertExactProviderTree(
    protocolHash: string,
    visited = new Set<string>(),
  ): void {
    if (visited.has(protocolHash)) return
    visited.add(protocolHash)

    const resolved = this.resolvedByHash.get(protocolHash)
    const provider = this.providerByHash.get(protocolHash)
    const expectedImplementation = this.implementationByHash.get(
      protocolHash,
    )
    if (
      resolved === undefined ||
      provider === undefined ||
      expectedImplementation === undefined
    ) {
      throw new ProtocolRuntimeError(
        `Verified Protocol provider is unavailable for ProtocolHash: ${protocolHash}.`,
      )
    }

    const implementation = this.ctx.reflect._getImpl(resolved.service)
    if (
      implementation !== expectedImplementation ||
      implementation.fiber !== provider
    ) {
      throw new ProtocolRuntimeError(
        `Verified Protocol provider is unavailable through Cordis: ${resolved.service}.`,
      )
    }

    for (const dependency of this.dependenciesByHash.get(protocolHash) ?? []) {
      const dependencyReference =
        `${dependency.name}@${dependency.version}`
      const dependencyResolved = this.resolvedByHash.get(
        dependency.protocolHash,
      )
      if (
        dependencyResolved === undefined ||
        dependencyResolved.reference !== dependencyReference
      ) {
        throw new ProtocolRuntimeError(
          `Verified Protocol dependency is unavailable: ${dependencyReference}.`,
        )
      }
      this.assertExactProviderTree(dependency.protocolHash, visited)
    }
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
      this.assertExactProviderTree(protocolHash)
      return resolved
    }

    const pending = this.inFlight.get(protocolHash)
    if (pending !== undefined) {
      try {
        const result = await pending.promise
        if (result.reference !== reference) {
          throw new ProtocolReferenceMismatchError(reference, result.reference)
        }
        return result
      } catch (cause) {
        if (
          cause instanceof ProtocolReferenceMismatchError &&
          pending.reference !== reference
        ) {
          if (this.inFlight.get(protocolHash) === pending) {
            this.inFlight.delete(protocolHash)
          }
          return this.resolveShared(reference, protocolHash, stack)
        }
        throw cause
      }
    }

    const operation = this.resolveExact(reference, protocolHash, stack)
    const pendingResolution = Object.freeze({
      reference,
      promise: operation,
    })
    this.inFlight.set(protocolHash, pendingResolution)

    try {
      return await operation
    } finally {
      if (this.inFlight.get(protocolHash) === pendingResolution) {
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
    let mountedFiber: (Fiber & PromiseLike<Fiber>) | undefined

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
      const runtimeContext =
        protocol.dependencies.length === 0
          ? this.ctx
          : this.createExactRuntimeContext(protocol)

      mountedFiber = runtimeContext.plugin(plugin, { protocolHash }) as Fiber &
        PromiseLike<Fiber>
      await mountedFiber

      const implementation = this.ctx.reflect._getImpl(service)
      if (
        this.ctx.get(service) === undefined ||
        implementation === undefined ||
        implementation.fiber !== mountedFiber.ctx.fiber
      ) {
        throw new ProtocolRuntimeError(
          `Protocol plugin did not provide ${service}.`,
        )
      }

      const view = Object.freeze({
        protocolHash,
        reference,
        service,
      })
      this.providerByHash.set(protocolHash, mountedFiber.ctx.fiber)
      this.implementationByHash.set(protocolHash, implementation)
      this.dependenciesByHash.set(
        protocolHash,
        Object.freeze([...protocol.dependencies]),
      )
      this.resolvedByHash.set(protocolHash, view)
      return view
    } catch (cause) {
      if (mountedFiber !== undefined) {
        await mountedFiber.dispose()
      }
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
