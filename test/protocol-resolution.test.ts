import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { test } from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import {
  CORE_PROTOCOL_PROTOCOL_SERVICE,
  PROTOCOL_RESOLUTION_SERVICE,
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
      if (expectedProtocolHash === HASH_C) throw new Error('test hash mismatch')
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

test('rejects verification failure and human-readable reference mismatch', async () => {
  const alpha = descriptor('test.alpha', '1.0.0')
  const node = await nodeWith(
    new Map([
      [HASH_A, { protocol: alpha, artifact: artifact() }],
      [HASH_C, { protocol: alpha, artifact: artifact() }],
    ]),
  )
  const service = node.context[PROTOCOL_RESOLUTION_SERVICE]

  await assert.rejects(
    service.resolve('test.alpha@1.0.0', HASH_C),
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
