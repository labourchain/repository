import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { test } from 'node:test'
import type { Plugin } from '@deepseek-ai/cordis'
import { plugin as memberIdentityPlugin } from '../src/protocols/member.identity.ts'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  RecordJournalService,
  createRepositoryNode,
  type CoreEntityProtocolService,
  type CoreRecordProtocolService,
  type CoreRecordValue,
} from '../src/index.ts'

const CORE_RELEASE = 'v0.1.0'
const CORE_VERSION = '0.1.0'
const CORE_RELEASE_BASE =
  'https://github.com/labourchain/core-protocols/releases/download/v0.1.0'

const CORE_ENTITY_PROTOCOL_HASH =
  'c507745d8e17760f25d852f3889381ca9053b0197f418bdc0f0a5e9e0f19ae9c'
const CORE_RECORD_PROTOCOL_HASH =
  '752efeba281ee962b87f6fa69623c8e207dbed5f3a695cfc6871c9fc8a841df1'
const MEMBER_PROTOCOL_HASH = 'a'.repeat(64)
const MAX_RUNTIME_BYTES = 1024 * 1024

interface ReleasedProtocolDescriptor {
  readonly protocolHash: string
  readonly protocol: {
    readonly name: string
    readonly version: string
    readonly runtime: {
      readonly kind: string
      readonly abi: number
    }
    readonly artifact?: string
  }
}

interface RuntimePluginShape {
  readonly name?: unknown
  readonly provide?: unknown
  readonly inject?: unknown
  readonly apply?: unknown
}

interface CoreEntityRuntimeService extends CoreEntityProtocolService {
  encodeBase58btc(bytes: Uint8Array): string
}

interface CoreRecordRuntimeService extends CoreRecordProtocolService {
  recordId(value: unknown): string
  signingPayload(recordId: string): Uint8Array
}

async function loadReleasedCorePlugin(
  name: 'core.entity' | 'core.record',
  expectedProtocolHash: string,
  directory: string,
): Promise<Plugin> {
  const descriptorUrl =
    CORE_RELEASE_BASE + '/' + name + '-' + CORE_VERSION + '.json'
  const response = await fetch(descriptorUrl, { redirect: 'follow' })

  assert.equal(
    response.ok,
    true,
    'unable to fetch released Core descriptor ' +
      descriptorUrl +
      ': HTTP ' +
      response.status,
  )

  const descriptor = (await response.json()) as ReleasedProtocolDescriptor
  assert.equal(descriptor.protocolHash, expectedProtocolHash)
  assert.equal(descriptor.protocol.name, name)
  assert.equal(descriptor.protocol.version, CORE_VERSION)
  assert.deepEqual(descriptor.protocol.runtime, {
    kind: 'cordis-js-esm',
    abi: 1,
  })
  assert.equal(typeof descriptor.protocol.artifact, 'string')

  const runtime = gunzipSync(
    Buffer.from(descriptor.protocol.artifact as string, 'base64'),
  )
  assert.ok(
    runtime.byteLength <= MAX_RUNTIME_BYTES,
    name + ' released runtime exceeds ABI v1 1 MiB limit',
  )

  const runtimePath = join(directory, name + '.mjs')
  await writeFile(runtimePath, runtime)
  const namespace = await import(
    pathToFileURL(runtimePath).href + '?' + expectedProtocolHash
  )

  assert.deepEqual(Object.keys(namespace), ['plugin'])

  const pluginShape = namespace.plugin as RuntimePluginShape
  assert.equal(pluginShape.name, name + '@' + CORE_VERSION)
  assert.equal(
    pluginShape.provide,
    'protocol:' + name + '@' + CORE_VERSION,
  )
  assert.ok(
    Array.isArray(pluginShape.inject) ||
      (typeof pluginShape.inject === 'object' && pluginShape.inject !== null),
  )
  assert.equal(typeof pluginShape.apply, 'function')

  return namespace.plugin as Plugin
}

test(
  'member.identity runs against released Core v0.1.0 Cordis Protocol artifacts',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'labourchain-core-release-'))
    const journalDirectory = join(root, 'journal')
    await mkdir(journalDirectory)

    try {
      const [coreEntityPlugin, coreRecordPlugin] = await Promise.all([
        loadReleasedCorePlugin(
          'core.entity',
          CORE_ENTITY_PROTOCOL_HASH,
          root,
        ),
        loadReleasedCorePlugin(
          'core.record',
          CORE_RECORD_PROTOCOL_HASH,
          root,
        ),
      ])

      const node = await createRepositoryNode({
        plugins: [
          {
            plugin: memberIdentityPlugin,
            config: { protocolHash: MEMBER_PROTOCOL_HASH },
          },
          { plugin: coreEntityPlugin },
          { plugin: coreRecordPlugin },
          {
            plugin: RecordJournalService,
            config: { directory: journalDirectory },
          },
        ],
      })

      try {
        const entityService = node.context[
          CORE_ENTITY_PROTOCOL_SERVICE
        ] as CoreEntityRuntimeService
        const recordService = node.context[
          CORE_RECORD_PROTOCOL_SERVICE
        ] as CoreRecordRuntimeService

        const { publicKey, privateKey } = generateKeyPairSync('ed25519')
        const publicKeyDer = publicKey.export({
          format: 'der',
          type: 'spki',
        }) as Buffer
        const identity = entityService.encodeBase58btc(
          publicKeyDer.subarray(publicKeyDer.byteLength - 32),
        )

        assert.equal(entityService.validateEntityPublicKey(identity), identity)

        const rawRecord = {
          protocol: MEMBER_PROTOCOL_REFERENCE,
          protocolHash: MEMBER_PROTOCOL_HASH,
          createdBy: identity,
          createdAt: '2026-09-18T00:00:00.000Z',
          data: {},
        }
        const id = recordService.recordId(rawRecord)
        const signature = sign(
          null,
          recordService.signingPayload(id),
          privateKey,
        ).toString('hex')
        const memberRecord: CoreRecordValue = {
          id,
          ...rawRecord,
          signature,
        }

        assert.equal(recordService.verifySignature(memberRecord), true)

        const declared = await node.context[
          MEMBER_PROTOCOL_SERVICE
        ].declareMember(memberRecord)
        const loaded = await node.context[
          MEMBER_PROTOCOL_SERVICE
        ].requireMember(identity)

        assert.deepEqual(declared, { identity })
        assert.deepEqual(loaded, declared)
        assert.deepEqual(
          await node.context.recordJournal.get(memberRecord.id),
          memberRecord,
        )
      } finally {
        await node.dispose()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)

test('Core release integration is pinned to the declared release', () => {
  assert.equal(CORE_RELEASE, 'v0.1.0')
  assert.equal(CORE_VERSION, '0.1.0')
})
