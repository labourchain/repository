import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { test } from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import {
  CORE_PROTOCOL_PROTOCOL_SERVICE,
  PROTOCOL_RESOLUTION_SERVICE,
  ProtocolArtifactUnavailableError,
  ProtocolBuildConflictError,
  ProtocolReferenceMismatchError,
  ProtocolResolutionError,
  ProtocolRuntimeError,
  ProtocolUnavailableError,
  createRepositoryNode,
  protocolResolutionPlugin,
  type CoreProtocolService,
  type ProtocolArtifactResolution,
  type ProtocolDescriptor,
  type ProtocolResolutionHost,
} from '../src/index.ts'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const HASH_C = 'c'.repeat(64)
const HASH_INVALID = 'd'.repeat(64)

function descriptor(
  name: string,
  version: string,
  dependencies: ProtocolDescriptor['dependencies'] = [],
): ProtocolDescriptor {
  return {
    name,
    version,
    runtime: { kind: 'cordis-js-esm', abi: 1 },
    dependencies,
    artifactHash: 'f'.repeat(64),
  }
}

function coreProtocolProvider(ctx: Context) {
  const service: CoreProtocolService = {
    validateProtocol(value: unknown) {
      if (typeof value !== 'object' || value === null) {
        throw new Error('invalid test Protocol')
      }
      return value as ProtocolDescriptor
    },
    verifyArtifact(_protocol, bytes, expectedProtocolHash) {
      if (bytes.byteLength === 0) throw new Error('empty test artifact')
      if (expectedProtocolHash === HASH_INVALID) throw new Error('test hash mismatch')
      return expectedProtocolHash ?? HASH_A
    },
    verifyEmbeddedArtifact() {
      throw new Error('test descriptors are external')
    },
  }
  ctx.provide(CORE_PROTOCOL_PROTOCOL_SERVICE, service)
}

function artifact(): Uint8Array {
  return gzipSync(Buffer.from('export const plugin = {}', 'utf8'))
}

function pluginNamespace(
  protocol: ProtocolDescriptor,
  inject: readonly string[] = [],
) {
  const service = `protocol:${protocol.name}@${protocol.version}`
  return {
    plugin: {
      name: `${protocol.name}@${protocol.version}`,
      provide: service,
      inject: [...inject],
      apply(ctx: Context) {
        ctx.provide(service, { protocol: protocol.name })
      },
    },
  }
}

function host(
  values: Map<string, ProtocolArtifactResolution>,
  evaluate?: ProtocolResolutionHost['evaluateRuntime'],
): ProtocolResolutionHost {
  return {
    async resolveArtifact(protocolHash) {
      return values.get(protocolHash)
    },
    async evaluateRuntime(protocol, runtimeBytes, protocolHash) {
      assert.ok(runtimeBytes.byteLength > 0)
      if (evaluate) {
        return evaluate(protocol, runtimeBytes, protocolHash)
      }
      return pluginNamespace(
        protocol,
        protocol.dependencies.map(
          (dependency) =>
            `protocol:${dependency.name}@${dependency.version}`,
        ),
      )
    },
  }
}

async function nodeWith(values: Map<string, ProtocolArtifactResolution>) {
  return createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: { host: host(values) },
      },
      { plugin: coreProtocolProvider },
    ],
  })
}

test('resolves and mounts by exact ProtocolHash', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const values = new Map([
    [HASH_A, { protocol: alpha, artifact: artifact() }],
  ])
  const node = await nodeWith(values)

  const resolved = await node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
    'test.alpha@1.0.0',
    HASH_A,
  )

  assert.deepEqual(resolved, {
    protocolHash: HASH_A,
    reference: 'test.alpha@1.0.0',
    service: 'protocol:test.alpha@1.0.0',
  })
  assert.deepEqual(node.context.get('protocol:test.alpha@1.0.0'), {
    protocol: 'test.alpha',
  })

  await node.dispose()
  assert.equal(node.context.get('protocol:test.alpha@1.0.0'), undefined)
})

test('resolves exact Protocol dependencies before mounting the consumer', async () => {
  const dependency = descriptor('test.dep', '1.0.0')
  const consumer = descriptor('test.consumer', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const values = new Map([
    [HASH_A, { protocol: dependency, artifact: artifact() }],
    [HASH_B, { protocol: consumer, artifact: artifact() }],
  ])
  const node = await nodeWith(values)

  await node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
    'test.consumer@1.0.0',
    HASH_B,
  )

  assert.ok(node.context.get('protocol:test.dep@1.0.0'))
  assert.ok(node.context.get('protocol:test.consumer@1.0.0'))
  await node.dispose()
})

test('executes an immutable copy of the verified external artifact', async () => {
  const dependency = descriptor('test.dep', '1.0.0')
  const consumer = descriptor('test.consumer', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const dependencyArtifact = artifact()
  const consumerArtifact = artifact()

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: {
            async resolveArtifact(protocolHash: string) {
              if (protocolHash === HASH_B) {
                return { protocol: consumer, artifact: consumerArtifact }
              }
              if (protocolHash === HASH_A) {
                consumerArtifact.fill(0)
                return { protocol: dependency, artifact: dependencyArtifact }
              }
              return undefined
            },
            async evaluateRuntime(protocol: ProtocolDescriptor) {
              return pluginNamespace(
                protocol,
                protocol.dependencies.map(
                  (dependency) =>
                    `protocol:${dependency.name}@${dependency.version}`,
                ),
              )
            },
          },
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  const resolved = await node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
    'test.consumer@1.0.0',
    HASH_B,
  )

  assert.equal(resolved.protocolHash, HASH_B)
  await node.dispose()
})

test('a concurrent wrong reference cannot poison a valid exact-hash resolution', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: {
            async resolveArtifact(protocolHash: string) {
              assert.equal(protocolHash, HASH_A)
              await gate
              return { protocol: alpha, artifact: artifact() }
            },
            async evaluateRuntime(protocol: ProtocolDescriptor) {
              return pluginNamespace(protocol)
            },
          },
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  const service = node.context[PROTOCOL_RESOLUTION_SERVICE]
  const wrong = service.resolve('test.wrong@1.0.0', HASH_A)
  const valid = service.resolve('test.alpha@1.0.0', HASH_A)

  release()

  await assert.rejects(wrong, ProtocolReferenceMismatchError)
  assert.deepEqual(await valid, {
    protocolHash: HASH_A,
    reference: 'test.alpha@1.0.0',
    service: 'protocol:test.alpha@1.0.0',
  })

  await node.dispose()
})

test('shares one exact dependency load across concurrent resolutions', async () => {
  const dependency = descriptor('test.dep', '1.0.0')
  const first = descriptor('test.first', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const second = descriptor('test.second', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const values = new Map([
    [HASH_A, { protocol: dependency, artifact: artifact() }],
    [HASH_B, { protocol: first, artifact: artifact() }],
    [HASH_C, { protocol: second, artifact: artifact() }],
  ])
  let dependencyEvaluations = 0

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async (protocol) => {
            if (protocol.name === 'test.dep') dependencyEvaluations += 1
            return pluginNamespace(
              protocol,
              protocol.dependencies.map(
                (dependency) =>
                  `protocol:${dependency.name}@${dependency.version}`,
              ),
            )
          }),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  await Promise.all([
    node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
      'test.first@1.0.0',
      HASH_B,
    ),
    node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
      'test.second@1.0.0',
      HASH_C,
    ),
  ])

  assert.equal(dependencyEvaluations, 1)
  await node.dispose()
})

test('rejects concurrent cross-root dependency cycles without hanging', async () => {
  const first = descriptor('test.first', '1.0.0', [
    { name: 'test.second', version: '1.0.0', protocolHash: HASH_B },
  ])
  const second = descriptor('test.second', '1.0.0', [
    { name: 'test.first', version: '1.0.0', protocolHash: HASH_A },
  ])
  const node = await nodeWith(
    new Map([
      [HASH_A, { protocol: first, artifact: artifact() }],
      [HASH_B, { protocol: second, artifact: artifact() }],
    ]),
  )

  const results = await Promise.allSettled([
    node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
      'test.first@1.0.0',
      HASH_A,
    ),
    node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
      'test.second@1.0.0',
      HASH_B,
    ),
  ])

  assert.ok(results.some(
    (result) =>
      result.status === 'rejected' &&
      result.reason instanceof ProtocolRuntimeError,
  ))
  await node.dispose()
})

test('allows genuinely distinct Protocol versions to coexist', async () => {
  const first = descriptor('test.alpha', '1.0.0')
  const second = descriptor('test.alpha', '2.0.0')
  const node = await nodeWith(
    new Map([
      [HASH_A, { protocol: first, artifact: artifact() }],
      [HASH_B, { protocol: second, artifact: artifact() }],
    ]),
  )

  await node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
    'test.alpha@1.0.0',
    HASH_A,
  )
  await node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
    'test.alpha@2.0.0',
    HASH_B,
  )

  assert.ok(node.context.get('protocol:test.alpha@1.0.0'))
  assert.ok(node.context.get('protocol:test.alpha@2.0.0'))
  await node.dispose()
})

test('rejects same-version different-build conflicts', async () => {
  const first = descriptor('test.alpha', '1.0.0')
  const second = descriptor('test.alpha', '1.0.0')
  const node = await nodeWith(
    new Map([
      [HASH_A, { protocol: first, artifact: artifact() }],
      [HASH_B, { protocol: second, artifact: artifact() }],
    ]),
  )

  await node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
    'test.alpha@1.0.0',
    HASH_A,
  )
  await assert.rejects(
    node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
      'test.alpha@1.0.0',
      HASH_B,
    ),
    ProtocolBuildConflictError,
  )

  await node.dispose()
})

test('fails when exact hash is unavailable without fallback', async () => {
  const newer = descriptor('test.alpha', '2.0.0')
  const node = await nodeWith(
    new Map([[HASH_B, { protocol: newer, artifact: artifact() }]]),
  )

  await assert.rejects(
    node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
      'test.alpha@1.0.0',
      HASH_A,
    ),
    ProtocolUnavailableError,
  )
  await node.dispose()
})

test('distinguishes an unavailable executable artifact', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const node = await nodeWith(
    new Map([[HASH_A, { protocol: alpha }]]),
  )

  await assert.rejects(
    node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
      'test.alpha@1.0.0',
      HASH_A,
    ),
    ProtocolArtifactUnavailableError,
  )

  await node.dispose()
})

test('rejects verification failure and human-readable reference mismatch', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const node = await nodeWith(
    new Map([
      [HASH_A, { protocol: alpha, artifact: artifact() }],
      [HASH_INVALID, { protocol: alpha, artifact: artifact() }],
    ]),
  )
  const service = node.context[PROTOCOL_RESOLUTION_SERVICE]

  await assert.rejects(
    service.resolve('test.alpha@1.0.0', HASH_INVALID),
    ProtocolResolutionError,
  )
  await assert.rejects(
    service.resolve('test.beta@1.0.0', HASH_A),
    ProtocolReferenceMismatchError,
  )

  await node.dispose()
})

test('adding a newer version does not change an existing exact resolution', async () => {
  const values = new Map<string, ProtocolArtifactResolution>([
    [HASH_A, { protocol: descriptor('test.alpha', '1.0.0'), artifact: artifact() }],
  ])
  const node = await nodeWith(values)
  const service = node.context[PROTOCOL_RESOLUTION_SERVICE]

  const first = await service.resolve('test.alpha@1.0.0', HASH_A)
  values.set(HASH_B, {
    protocol: descriptor('test.alpha', '2.0.0'),
    artifact: artifact(),
  })
  const second = await service.resolve('test.alpha@1.0.0', HASH_A)

  assert.equal(second, first)
  await node.dispose()
})

test('cached exact resolution rejects a replacement Cordis provider', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const protocolService = 'protocol:test.alpha@1.0.0'
  const runtimeService = 'runtime.helper'
  const values = new Map([
    [HASH_A, { protocol: alpha, artifact: artifact() }],
  ])
  const helperPlugin = {
    name: 'runtime.helper',
    provide: runtimeService,
    inject: [],
    apply(ctx: Context) {
      ctx.provide(runtimeService, { helper: true })
    },
  }
  const foreignPlugin = {
    name: 'runtime.foreign-alpha',
    provide: protocolService,
    inject: [],
    apply(ctx: Context) {
      ctx.provide(protocolService, { protocol: 'foreign' })
    },
  }

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async (protocol) =>
            pluginNamespace(protocol, [runtimeService]),
          ),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })
  const helperFiber = node.context.plugin(helperPlugin)
  await helperFiber

  const service = node.context[PROTOCOL_RESOLUTION_SERVICE]
  await service.resolve('test.alpha@1.0.0', HASH_A)

  await helperFiber.dispose()
  assert.equal(node.context.get(protocolService), undefined)
  await assert.rejects(
    service.withExactService(
      'test.alpha@1.0.0',
      HASH_A,
      () => assert.fail('missing exact provider must not execute'),
    ),
    ProtocolRuntimeError,
  )

  const foreignFiber = node.context.plugin(foreignPlugin)
  await foreignFiber
  assert.deepEqual(node.context.get(protocolService), {
    protocol: 'foreign',
  })

  await assert.rejects(
    service.resolve('test.alpha@1.0.0', HASH_A),
    ProtocolRuntimeError,
  )

  await node.dispose()
})

test('exact service use rejects a foreign replacement of a Protocol dependency', async () => {
  const dependency = descriptor('test.dep', '1.0.0')
  const consumer = descriptor('test.consumer', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const dependencyService = 'protocol:test.dep@1.0.0'
  const consumerService = 'protocol:test.consumer@1.0.0'
  const values = new Map([
    [HASH_A, { protocol: dependency, artifact: artifact() }],
    [HASH_B, { protocol: consumer, artifact: artifact() }],
  ])
  let exactInvocations = 0
  let foreignInvocations = 0

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async (protocol) => {
            if (protocol.name === 'test.dep') {
              return {
                plugin: {
                  name: 'test.dep@1.0.0',
                  provide: dependencyService,
                  inject: [],
                  apply(ctx: Context) {
                    ctx.provide(dependencyService, {
                      touch() {
                        exactInvocations += 1
                      },
                    })
                  },
                },
              }
            }

            return {
              plugin: {
                name: 'test.consumer@1.0.0',
                provide: consumerService,
                inject: [dependencyService],
                apply(ctx: Context) {
                  ctx.provide(consumerService, {
                    touchDependency() {
                      const service = ctx.get(dependencyService) as
                        | { touch(): void }
                        | undefined
                      service?.touch()
                    },
                  })
                },
              },
            }
          }),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  const resolver = node.context[PROTOCOL_RESOLUTION_SERVICE]
  await resolver.withExactService(
    'test.consumer@1.0.0',
    HASH_B,
    (value) => {
      ;(value as { touchDependency(): void }).touchDependency()
    },
  )
  assert.equal(exactInvocations, 1)

  const exactDependency = node.context.reflect._getImpl(dependencyService)
  assert.ok(exactDependency)
  await exactDependency.fiber.dispose()

  const foreignFiber = node.context.plugin({
    name: 'runtime.foreign-dependency',
    provide: dependencyService,
    inject: [],
    apply(ctx: Context) {
      ctx.provide(dependencyService, {
        touch() {
          foreignInvocations += 1
        },
      })
    },
  })
  await foreignFiber

  await assert.rejects(
    resolver.withExactService(
      'test.consumer@1.0.0',
      HASH_B,
      (value) => {
        ;(value as { touchDependency(): void }).touchDependency()
      },
    ),
    ProtocolRuntimeError,
  )
  assert.equal(foreignInvocations, 0)

  await node.dispose()
})

test('exact dependency reachable values remain bound to the captured generation', async () => {
  const dependency = descriptor('test.dep', '1.0.0')
  const consumer = descriptor('test.consumer', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const dependencyService = 'protocol:test.dep@1.0.0'
  const consumerService = 'protocol:test.consumer@1.0.0'
  const values = new Map([
    [HASH_A, { protocol: dependency, artifact: artifact() }],
    [HASH_B, { protocol: consumer, artifact: artifact() }],
  ])
  let exactInvocations = 0
  let foreignInvocations = 0
  let getterReads = 0
  let blockedInvocations = 0
  let entered!: () => void
  const enteredGate = new Promise<void>((resolve) => {
    entered = resolve
  })
  let resume!: () => void
  const resumeGate = new Promise<void>((resolve) => {
    resume = resolve
  })
  const rejection = new Error('dependency rejection')

  interface NestedService {
    count: number
    self?: NestedService
    touch(): void
    increment(): number
  }

  interface CallableService {
    (): number
    nested: NestedService
  }

  interface DependencyService {
    nested: NestedService
    alias: NestedService
    frozen: Readonly<{ nested: NestedService }>
    readonly fromGetter: NestedService
    createNested(): NestedService
    createCallable(): CallableService
    createNestedAsync(): Promise<NestedService>
    createCallableAsync(): Promise<CallableService>
    rejectAsync(): Promise<never>
  }

  interface StableResult {
    readonly sharedIdentity: boolean
    readonly cycleIdentity: boolean
    readonly returnedIdentity: boolean
    readonly asyncIdentity: boolean
    readonly callableIdentity: boolean
    readonly callableNestedIdentity: boolean
    readonly frozenIdentity: boolean
    readonly firstCount: number
    readonly secondCount: number
    readonly rejectionPreserved: boolean
  }

  interface ConsumerService {
    verifyStable(): Promise<StableResult>
    useCapturedAfterGate(): Promise<void>
  }

  const nested: NestedService = {
    count: 0,
    touch() {
      exactInvocations += 1
    },
    increment() {
      this.count += 1
      return this.count
    },
  }
  nested.self = nested

  const callable = Object.assign(
    () => {
      exactInvocations += 1
      return nested.increment()
    },
    { nested },
  )
  const frozen = Object.freeze({ nested })

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async (protocol) => {
            if (protocol.name === 'test.dep') {
              return {
                plugin: {
                  name: 'test.dep@1.0.0',
                  provide: dependencyService,
                  inject: [],
                  apply(ctx: Context) {
                    ctx.provide(dependencyService, {
                      nested,
                      alias: nested,
                      frozen,
                      get fromGetter() {
                        getterReads += 1
                        return nested
                      },
                      createNested() {
                        return nested
                      },
                      createCallable() {
                        return callable
                      },
                      async createNestedAsync() {
                        return nested
                      },
                      async createCallableAsync() {
                        return callable
                      },
                      rejectAsync() {
                        return Promise.reject(rejection)
                      },
                    })
                  },
                },
              }
            }

            return {
              plugin: {
                name: 'test.consumer@1.0.0',
                provide: consumerService,
                inject: [dependencyService],
                apply(ctx: Context) {
                  const exactDependency = () =>
                    ctx.get(dependencyService) as DependencyService

                  ctx.provide(consumerService, {
                    async verifyStable() {
                      const service = exactDependency()
                      const nestedHandle = service.nested
                      const returnedCallable = service.createCallable()
                      const asyncNested =
                        await service.createNestedAsync()
                      const asyncCallable =
                        await service.createCallableAsync()
                      let rejectionPreserved = false

                      try {
                        await service.rejectAsync()
                      } catch (error) {
                        rejectionPreserved = error === rejection
                      }

                      return {
                        sharedIdentity:
                          service.alias === nestedHandle &&
                          service.fromGetter === nestedHandle,
                        cycleIdentity:
                          nestedHandle.self === nestedHandle,
                        returnedIdentity:
                          service.createNested() === nestedHandle,
                        asyncIdentity: asyncNested === nestedHandle,
                        callableIdentity:
                          returnedCallable === asyncCallable,
                        callableNestedIdentity:
                          returnedCallable.nested === nestedHandle,
                        frozenIdentity:
                          service.frozen.nested === nestedHandle,
                        firstCount: nestedHandle.increment(),
                        secondCount: returnedCallable(),
                        rejectionPreserved,
                      }
                    },

                    async useCapturedAfterGate() {
                      const service = exactDependency()
                      const nestedHandle = service.nested
                      const nestedMethod = nestedHandle.touch
                      const returnedNested = service.createNested()
                      const returnedCallable = service.createCallable()
                      const asyncNested =
                        await service.createNestedAsync()
                      const asyncCallable =
                        await service.createCallableAsync()
                      const getterNested = service.fromGetter
                      const frozenNested = service.frozen.nested

                      const invocations = [
                        () => nestedHandle.touch(),
                        () => nestedMethod(),
                        () => returnedNested.touch(),
                        () => returnedCallable(),
                        () => asyncNested.touch(),
                        () => asyncCallable(),
                        () => getterNested.touch(),
                        () => frozenNested.touch(),
                        () => service.fromGetter.touch(),
                      ]

                      entered()
                      await resumeGate

                      for (const invoke of invocations) {
                        try {
                          invoke()
                        } catch (error) {
                          if (!(error instanceof ProtocolRuntimeError)) {
                            throw error
                          }
                          blockedInvocations += 1
                        }
                      }
                    },
                  })
                },
              },
            }
          }),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  const resolver = node.context[PROTOCOL_RESOLUTION_SERVICE]
  const stable = await resolver.withExactService(
    'test.consumer@1.0.0',
    HASH_B,
    (value) => (value as ConsumerService).verifyStable(),
  )

  assert.equal(stable.sharedIdentity, true)
  assert.equal(stable.cycleIdentity, true)
  assert.equal(stable.returnedIdentity, true)
  assert.equal(stable.asyncIdentity, true)
  assert.equal(stable.callableIdentity, true)
  assert.equal(stable.callableNestedIdentity, true)
  assert.equal(stable.frozenIdentity, true)
  assert.equal(stable.firstCount, 1)
  assert.equal(stable.secondCount, 2)
  assert.equal(stable.rejectionPreserved, true)
  assert.equal(exactInvocations, 1)
  assert.equal(getterReads, 1)

  const operation = resolver.withExactService(
    'test.consumer@1.0.0',
    HASH_B,
    (value) => (value as ConsumerService).useCapturedAfterGate(),
  )
  await enteredGate
  assert.equal(getterReads, 2)

  const exactDependency = node.context.reflect._getImpl(dependencyService)
  assert.ok(exactDependency)
  await exactDependency.fiber.dispose()

  const foreignFiber = node.context.plugin({
    name: 'runtime.foreign-reachable-dependency',
    provide: dependencyService,
    inject: [],
    apply(ctx: Context) {
      ctx.provide(dependencyService, {
        nested: {
          touch() {
            foreignInvocations += 1
          },
        },
      })
    },
  })
  await foreignFiber

  resume()

  await assert.rejects(operation, ProtocolRuntimeError)
  assert.equal(blockedInvocations, 9)
  assert.equal(exactInvocations, 1)
  assert.equal(foreignInvocations, 0)
  assert.equal(getterReads, 2)

  await node.dispose()
})

test('exact service reflection remains bound to the captured generation', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const serviceName = 'protocol:test.alpha@1.0.0'
  const values = new Map([
    [HASH_A, { protocol: alpha, artifact: artifact() }],
  ])
  let exactInvocations = 0
  let foreignInvocations = 0
  let getterInvocations = 0
  let setterInvocations = 0

  interface NestedService {
    touch(): void
  }

  interface ReflectedService {
    mutable: number
    ownMethod(): void
    nested: NestedService
    frozen: Readonly<{
      touch(): void
      nested: NestedService
    }>
    accessor: number
    prototypeTouch(): void
  }

  interface ReflectedPrototype {
    prototypeTouch(): void
    prototypeNested: NestedService
  }

  const nested: NestedService = {
    touch() {
      exactInvocations += 1
    },
  }
  const prototypeNested: NestedService = {
    touch() {
      exactInvocations += 1
    },
  }

  class ExactService {
    mutable = 1

    prototypeTouch() {
      exactInvocations += 1
    }
  }

  Object.defineProperty(ExactService.prototype, 'prototypeNested', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: prototypeNested,
  })

  const exactService = new ExactService() as ExactService &
    Omit<ReflectedService, 'mutable' | 'prototypeTouch'>
  Object.defineProperties(exactService, {
    ownMethod: {
      configurable: true,
      enumerable: true,
      writable: true,
      value() {
        exactInvocations += 1
      },
    },
    nested: {
      configurable: true,
      enumerable: true,
      writable: true,
      value: nested,
    },
    frozen: {
      configurable: true,
      enumerable: true,
      writable: true,
      value: Object.freeze({
        touch() {
          exactInvocations += 1
        },
        nested,
      }),
    },
    accessor: {
      configurable: true,
      enumerable: false,
      get() {
        getterInvocations += 1
        return exactService.mutable
      },
      set(value: number) {
        setterInvocations += 1
        exactService.mutable = value
      },
    },
  })

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async () => ({
            plugin: {
              name: 'test.alpha@1.0.0',
              provide: serviceName,
              inject: [],
              apply(ctx: Context) {
                ctx.provide(serviceName, exactService)
              },
            },
          })),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })
  const resolver = node.context[PROTOCOL_RESOLUTION_SERVICE]

  let boundService!: ReflectedService
  let descriptorMethod!: () => void
  let reflectDescriptorMethod!: () => void
  let descriptorNested!: NestedService
  let descriptorGetter!: () => number
  let descriptorSetter!: (value: number) => void
  let prototypeMethod!: () => void
  let reflectPrototypeMethod!: () => void
  let prototypeNestedHandle!: NestedService
  let frozenMethod!: () => void
  let frozenNested!: NestedService

  await resolver.withExactService(
    'test.alpha@1.0.0',
    HASH_A,
    (value) => {
      boundService = value as ReflectedService

      const descriptor = Object.getOwnPropertyDescriptor(
        boundService,
        'ownMethod',
      )
      const reflectedDescriptor = Reflect.getOwnPropertyDescriptor(
        boundService,
        'ownMethod',
      )
      assert.ok(descriptor)
      assert.ok(reflectedDescriptor)
      assert.equal(descriptor.configurable, true)
      assert.equal(descriptor.enumerable, true)
      assert.equal(descriptor.writable, true)
      descriptorMethod = descriptor.value as () => void
      reflectDescriptorMethod =
        reflectedDescriptor.value as () => void
      assert.equal(descriptorMethod, reflectDescriptorMethod)
      assert.equal(descriptorMethod, boundService.ownMethod)

      const nestedDescriptor = Object.getOwnPropertyDescriptor(
        boundService,
        'nested',
      )
      assert.ok(nestedDescriptor)
      descriptorNested = nestedDescriptor.value as NestedService
      assert.equal(descriptorNested, boundService.nested)

      const accessorDescriptor = Object.getOwnPropertyDescriptor(
        boundService,
        'accessor',
      )
      assert.ok(accessorDescriptor)
      assert.equal(accessorDescriptor.configurable, true)
      assert.equal(accessorDescriptor.enumerable, false)
      assert.ok(accessorDescriptor.get)
      assert.ok(accessorDescriptor.set)
      descriptorGetter = accessorDescriptor.get as () => number
      descriptorSetter =
        accessorDescriptor.set as (value: number) => void
      assert.equal(descriptorGetter.call(boundService), 1)
      descriptorSetter.call(boundService, 7)
      assert.equal(boundService.mutable, 7)

      const prototype = Object.getPrototypeOf(
        boundService,
      ) as ReflectedPrototype
      const reflectedPrototype = Reflect.getPrototypeOf(
        boundService,
      ) as ReflectedPrototype
      assert.equal(prototype, reflectedPrototype)
      assert.equal(Object.getPrototypeOf(boundService), prototype)
      prototypeMethod = prototype.prototypeTouch
      reflectPrototypeMethod = reflectedPrototype.prototypeTouch
      assert.equal(prototypeMethod, reflectPrototypeMethod)
      prototypeNestedHandle = prototype.prototypeNested
      assert.equal(
        prototypeNestedHandle,
        reflectedPrototype.prototypeNested,
      )

      const frozen = boundService.frozen
      assert.equal(Object.isExtensible(frozen), false)
      assert.deepEqual(Object.keys(frozen), ['touch', 'nested'])
      const frozenDescriptor = Object.getOwnPropertyDescriptor(
        frozen,
        'touch',
      )
      const frozenNestedDescriptor =
        Object.getOwnPropertyDescriptor(frozen, 'nested')
      assert.ok(frozenDescriptor)
      assert.ok(frozenNestedDescriptor)
      assert.equal(frozenDescriptor.configurable, false)
      assert.equal(frozenDescriptor.enumerable, true)
      assert.equal(frozenDescriptor.writable, false)
      frozenMethod = frozenDescriptor.value as () => void
      frozenNested = frozenNestedDescriptor.value as NestedService
      assert.equal(frozenNested, boundService.nested)

      descriptorMethod()
      descriptorNested.touch()
      prototypeMethod()
      prototypeNestedHandle.touch()
      frozenMethod()
      frozenNested.touch()
    },
  )

  assert.equal(exactInvocations, 6)
  assert.equal(getterInvocations, 1)
  assert.equal(setterInvocations, 1)

  const exact = node.context.reflect._getImpl(serviceName)
  assert.ok(exact)
  await exact.fiber.dispose()

  const foreignFiber = node.context.plugin({
    name: 'runtime.foreign-reflection-provider',
    provide: serviceName,
    inject: [],
    apply(ctx: Context) {
      ctx.provide(serviceName, {
        ownMethod() {
          foreignInvocations += 1
        },
        nested: {
          touch() {
            foreignInvocations += 1
          },
        },
      })
    },
  })
  await foreignFiber

  const staleInvocations = [
    () => descriptorMethod(),
    () => reflectDescriptorMethod(),
    () => descriptorNested.touch(),
    () => descriptorGetter.call(boundService),
    () => descriptorSetter.call(boundService, 8),
    () => prototypeMethod(),
    () => reflectPrototypeMethod(),
    () => prototypeNestedHandle.touch(),
    () => frozenMethod(),
    () => frozenNested.touch(),
  ]

  for (const invoke of staleInvocations) {
    assert.throws(invoke, ProtocolRuntimeError)
  }
  assert.throws(
    () => Object.getOwnPropertyDescriptor(boundService, 'ownMethod'),
    ProtocolRuntimeError,
  )
  assert.throws(
    () => Reflect.getOwnPropertyDescriptor(boundService, 'ownMethod'),
    ProtocolRuntimeError,
  )
  assert.throws(
    () => Object.getPrototypeOf(boundService),
    ProtocolRuntimeError,
  )
  assert.throws(
    () => Reflect.getPrototypeOf(boundService),
    ProtocolRuntimeError,
  )

  assert.equal(exactInvocations, 6)
  assert.equal(getterInvocations, 1)
  assert.equal(setterInvocations, 1)
  assert.equal(foreignInvocations, 0)
  await node.dispose()
})

test('exact service binding fails closed for mixed mutable shadow shapes', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const serviceName = 'protocol:test.alpha@1.0.0'
  const values = new Map([
    [HASH_A, { protocol: alpha, artifact: artifact() }],
  ])
  let exactInvocations = 0
  let callbackRan = false

  const mixed = { mutable: 1 } as {
    mutable: number
    fixed?: () => void
  }
  Object.defineProperty(mixed, 'fixed', {
    configurable: false,
    enumerable: true,
    writable: false,
    value() {
      exactInvocations += 1
    },
  })

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async () => ({
            plugin: {
              name: 'test.alpha@1.0.0',
              provide: serviceName,
              inject: [],
              apply(ctx: Context) {
                ctx.provide(serviceName, mixed)
              },
            },
          })),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })
  const resolver = node.context[PROTOCOL_RESOLUTION_SERVICE]

  await assert.rejects(
    resolver.withExactService(
      'test.alpha@1.0.0',
      HASH_A,
      () => {
        callbackRan = true
      },
    ),
    (error: unknown) =>
      error instanceof ProtocolRuntimeError &&
      error.message.includes('fixed bindable properties'),
  )

  assert.equal(callbackRan, false)
  assert.equal(exactInvocations, 0)
  assert.equal(mixed.mutable, 1)
  await node.dispose()
})

test('exact async execution cannot switch to a foreign dependency mid-callback', async () => {
  const dependency = descriptor('test.dep', '1.0.0')
  const consumer = descriptor('test.consumer', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const dependencyService = 'protocol:test.dep@1.0.0'
  const consumerService = 'protocol:test.consumer@1.0.0'
  const values = new Map([
    [HASH_A, { protocol: dependency, artifact: artifact() }],
    [HASH_B, { protocol: consumer, artifact: artifact() }],
  ])
  let foreignInvocations = 0
  let entered!: () => void
  const enteredGate = new Promise<void>((resolve) => {
    entered = resolve
  })
  let resume!: () => void
  const resumeGate = new Promise<void>((resolve) => {
    resume = resolve
  })

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async (protocol) => {
            if (protocol.name === 'test.dep') {
              return {
                plugin: {
                  name: 'test.dep@1.0.0',
                  provide: dependencyService,
                  inject: [],
                  apply(ctx: Context) {
                    ctx.provide(dependencyService, { touch() {} })
                  },
                },
              }
            }

            return {
              plugin: {
                name: 'test.consumer@1.0.0',
                provide: consumerService,
                inject: [dependencyService],
                apply(ctx: Context) {
                  ctx.provide(consumerService, {
                    async touchDependencyAfterGate() {
                      entered()
                      await resumeGate
                      const service = ctx.get(dependencyService) as
                        | { touch(): void }
                        | undefined
                      service?.touch()
                    },
                  })
                },
              },
            }
          }),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  const resolver = node.context[PROTOCOL_RESOLUTION_SERVICE]
  await resolver.resolve('test.consumer@1.0.0', HASH_B)

  const operation = resolver.withExactService(
    'test.consumer@1.0.0',
    HASH_B,
    async (value) => {
      await (
        value as { touchDependencyAfterGate(): Promise<void> }
      ).touchDependencyAfterGate()
    },
  )
  await enteredGate

  const exactDependency = node.context.reflect._getImpl(dependencyService)
  assert.ok(exactDependency)
  await exactDependency.fiber.dispose()

  const foreignFiber = node.context.plugin({
    name: 'runtime.foreign-dependency-mid-callback',
    provide: dependencyService,
    inject: [],
    apply(ctx: Context) {
      ctx.provide(dependencyService, {
        touch() {
          foreignInvocations += 1
        },
      })
    },
  })
  await foreignFiber

  resume()

  await assert.rejects(operation, ProtocolRuntimeError)
  assert.equal(foreignInvocations, 0)
  await node.dispose()
})

test('exact async execution fails on dependency loss before invocation', async () => {
  const dependency = descriptor('test.dep', '1.0.0')
  const consumer = descriptor('test.consumer', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const dependencyService = 'protocol:test.dep@1.0.0'
  const consumerService = 'protocol:test.consumer@1.0.0'
  const values = new Map([
    [HASH_A, { protocol: dependency, artifact: artifact() }],
    [HASH_B, { protocol: consumer, artifact: artifact() }],
  ])
  let dependencyInvocations = 0
  let entered!: () => void
  const enteredGate = new Promise<void>((resolve) => {
    entered = resolve
  })
  let resume!: () => void
  const resumeGate = new Promise<void>((resolve) => {
    resume = resolve
  })

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async (protocol) => {
            if (protocol.name === 'test.dep') {
              return {
                plugin: {
                  name: 'test.dep@1.0.0',
                  provide: dependencyService,
                  inject: [],
                  apply(ctx: Context) {
                    ctx.provide(dependencyService, {
                      touch() {
                        dependencyInvocations += 1
                      },
                    })
                  },
                },
              }
            }

            return {
              plugin: {
                name: 'test.consumer@1.0.0',
                provide: consumerService,
                inject: [dependencyService],
                apply(ctx: Context) {
                  ctx.provide(consumerService, {
                    async touchDependencyAfterGate() {
                      entered()
                      await resumeGate
                      const service = ctx.get(dependencyService) as
                        | { touch(): void }
                        | undefined
                      service?.touch()
                    },
                  })
                },
              },
            }
          }),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  const resolver = node.context[PROTOCOL_RESOLUTION_SERVICE]
  await resolver.resolve('test.consumer@1.0.0', HASH_B)
  const operation = resolver.withExactService(
    'test.consumer@1.0.0',
    HASH_B,
    async (value) => {
      await (
        value as { touchDependencyAfterGate(): Promise<void> }
      ).touchDependencyAfterGate()
    },
  )
  await enteredGate

  const exactDependency = node.context.reflect._getImpl(dependencyService)
  assert.ok(exactDependency)
  await exactDependency.fiber.dispose()
  resume()

  await assert.rejects(operation, ProtocolRuntimeError)
  assert.equal(dependencyInvocations, 0)
  await node.dispose()
})

test('same Fiber restart is a new exact provider generation', async () => {
  const dependency = descriptor('test.dep', '1.0.0')
  const consumer = descriptor('test.consumer', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const dependencyService = 'protocol:test.dep@1.0.0'
  const values = new Map([
    [HASH_A, { protocol: dependency, artifact: artifact() }],
    [HASH_B, { protocol: consumer, artifact: artifact() }],
  ])
  const node = await nodeWith(values)
  const resolver = node.context[PROTOCOL_RESOLUTION_SERVICE]

  await resolver.resolve('test.consumer@1.0.0', HASH_B)
  const exactDependency = node.context.reflect._getImpl(dependencyService)
  assert.ok(exactDependency)
  const originalFiber = exactDependency.fiber

  await originalFiber.restart()

  const restartedDependency = node.context.reflect._getImpl(dependencyService)
  assert.ok(restartedDependency)
  assert.equal(restartedDependency.fiber, originalFiber)
  assert.notEqual(restartedDependency, exactDependency)

  let callbackRan = false
  await assert.rejects(
    resolver.withExactService(
      'test.consumer@1.0.0',
      HASH_B,
      () => {
        callbackRan = true
      },
    ),
    ProtocolRuntimeError,
  )
  assert.equal(callbackRan, false)
  await node.dispose()
})

test('stable exact callbacks remain concurrent and preserve callback errors', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const serviceName = 'protocol:test.alpha@1.0.0'
  const values = new Map([
    [HASH_A, { protocol: alpha, artifact: artifact() }],
  ])
  let invocations = 0

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async () => ({
            plugin: {
              name: 'test.alpha@1.0.0',
              provide: serviceName,
              inject: [],
              apply(ctx: Context) {
                ctx.provide(serviceName, {
                  touch() {
                    invocations += 1
                    return invocations
                  },
                })
              },
            },
          })),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })
  const resolver = node.context[PROTOCOL_RESOLUTION_SERVICE]

  const results = await Promise.all([
    resolver.withExactService('test.alpha@1.0.0', HASH_A, (value) =>
      (value as { touch(): number }).touch(),
    ),
    resolver.withExactService('test.alpha@1.0.0', HASH_A, (value) =>
      (value as { touch(): number }).touch(),
    ),
  ])
  assert.deepEqual(results, [1, 2])

  const callbackError = new Error('callback failure')
  await assert.rejects(
    resolver.withExactService(
      'test.alpha@1.0.0',
      HASH_A,
      () => {
        throw callbackError
      },
    ),
    (error: unknown) => error === callbackError,
  )

  assert.equal(
    await resolver.withExactService(
      'test.alpha@1.0.0',
      HASH_A,
      (value) => (value as { touch(): number }).touch(),
    ),
    3,
  )
  await node.dispose()
})

test('failed Protocol mounts are disposed and can be retried cleanly', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const values = new Map([
    [HASH_A, { protocol: alpha, artifact: artifact() }],
  ])
  let attempts = 0
  const failingPlugin = {
    name: 'test.alpha@1.0.0',
    provide: 'protocol:test.alpha@1.0.0',
    inject: [],
    apply() {
      throw new Error('test startup failure')
    },
  }

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async (protocol) => {
            attempts += 1
            if (attempts === 1) return { plugin: failingPlugin }
            return pluginNamespace(protocol)
          }),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  const service = node.context[PROTOCOL_RESOLUTION_SERVICE]

  await assert.rejects(
    service.resolve('test.alpha@1.0.0', HASH_A),
    ProtocolRuntimeError,
  )
  assert.equal(node.context.registry.get(failingPlugin), undefined)
  assert.equal(node.context.get('protocol:test.alpha@1.0.0'), undefined)

  const resolved = await service.resolve('test.alpha@1.0.0', HASH_A)
  assert.equal(resolved.protocolHash, HASH_A)
  assert.ok(node.context.get('protocol:test.alpha@1.0.0'))

  await node.dispose()
})

test('validates runtime dependency projection', async () => {
  const dependency = descriptor('test.dep', '1.0.0')
  const consumer = descriptor('test.consumer', '1.0.0', [
    { name: 'test.dep', version: '1.0.0', protocolHash: HASH_A },
  ])
  const values = new Map([
    [HASH_A, { protocol: dependency, artifact: artifact() }],
    [HASH_B, { protocol: consumer, artifact: artifact() }],
  ])

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async (protocol) => {
            if (protocol.name === 'test.consumer') {
              return pluginNamespace(protocol)
            }
            return pluginNamespace(protocol)
          }),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  await assert.rejects(
    node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
      'test.consumer@1.0.0',
      HASH_B,
    ),
    ProtocolRuntimeError,
  )
  await node.dispose()
})

test('rejects undeclared Protocol runtime dependencies', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const values = new Map([
    [HASH_A, { protocol: alpha, artifact: artifact() }],
  ])

  const node = await createRepositoryNode({
    plugins: [
      {
        plugin: protocolResolutionPlugin,
        config: {
          host: host(values, async (protocol) =>
            pluginNamespace(protocol, ['protocol:test.hidden@1.0.0']),
          ),
        },
      },
      { plugin: coreProtocolProvider },
    ],
  })

  await assert.rejects(
    node.context[PROTOCOL_RESOLUTION_SERVICE].resolve(
      'test.alpha@1.0.0',
      HASH_A,
    ),
    ProtocolRuntimeError,
  )
  await node.dispose()
})
