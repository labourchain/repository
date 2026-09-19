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
import { plugin as repoEstablishmentPlugin } from '../src/protocols/repo.establishment.ts'
import { plugin as membershipPlugin } from '../src/protocols/repo.membership.ts'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  MEMBERSHIP_PROTOCOL_REFERENCE,
  MEMBERSHIP_PROTOCOL_SERVICE,
  REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  RecordJournalService,
  createRepositoryNode,
  type CoreEntityProtocolService,
  type CoreRecordProtocolService,
  type CoreRecordValue,
} from '../src/index.ts'

const CORE_RELEASE = 'v0.1.0'
const CORE_VERSION = '0.1.0'
const CORE_RELEASE_BASE =
  'https://github.com/labourchain/core-protocols/releases/download/' +
  CORE_RELEASE

const CORE_ENTITY_PROTOCOL_HASH =
  'c507745d8e17760f25d852f3889381ca9053b0197f418bdc0f0a5e9e0f19ae9c'
const CORE_RECORD_PROTOCOL_HASH =
  '752efeba281ee962b87f6fa69623c8e207dbed5f3a695cfc6871c9fc8a841df1'
const MEMBER_PROTOCOL_HASH = 'a'.repeat(64)
const REPO_PROTOCOL_HASH = 'b'.repeat(64)
const MEMBERSHIP_PROTOCOL_HASH = 'c'.repeat(64)
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
  'Member, Repo establishment and Membership run against released Core v0.1.0 Protocol artifacts',
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
            plugin: membershipPlugin,
            config: { protocolHash: MEMBERSHIP_PROTOCOL_HASH },
          },
          {
            plugin: repoEstablishmentPlugin,
            config: { protocolHash: REPO_PROTOCOL_HASH },
          },
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

        const repoKeyPair = generateKeyPairSync('ed25519')
        const repoPublicKeyDer = repoKeyPair.publicKey.export({
          format: 'der',
          type: 'spki',
        }) as Buffer
        const repoIdentity = entityService.encodeBase58btc(
          repoPublicKeyDer.subarray(repoPublicKeyDer.byteLength - 32),
        )

        const rawRepoRecord = {
          protocol: REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
          protocolHash: REPO_PROTOCOL_HASH,
          createdBy: identity,
          createdAt: '2026-09-18T00:00:01.000Z',
          data: { repo: repoIdentity },
        }
        const repoRecordId = recordService.recordId(rawRepoRecord)
        const repoSignature = sign(
          null,
          recordService.signingPayload(repoRecordId),
          privateKey,
        ).toString('hex')
        const repoRecord: CoreRecordValue = {
          id: repoRecordId,
          ...rawRepoRecord,
          signature: repoSignature,
        }

        assert.equal(recordService.verifySignature(repoRecord), true)

        const established = await node.context[
          REPO_ESTABLISHMENT_PROTOCOL_SERVICE
        ].establishRepo(repoRecord)
        const loadedRepo = await node.context[
          REPO_ESTABLISHMENT_PROTOCOL_SERVICE
        ].loadRepo(repoIdentity)

        assert.deepEqual(established, {
          identity: repoIdentity,
          operator: identity,
          establishmentRecordId: repoRecordId,
        })
        assert.deepEqual(loadedRepo, established)
        assert.deepEqual(
          await node.context.recordJournal.get(repoRecord.id),
          repoRecord,
        )

        const rawMemberScopedRepoRecord = {
          protocol: REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
          protocolHash: REPO_PROTOCOL_HASH,
          createdBy: identity,
          createdAt: '2026-09-18T00:00:02.000Z',
          data: { repo: identity },
        }
        const memberScopedRepoRecordId = recordService.recordId(
          rawMemberScopedRepoRecord,
        )
        const memberScopedRepoRecord: CoreRecordValue = {
          id: memberScopedRepoRecordId,
          ...rawMemberScopedRepoRecord,
          signature: sign(
            null,
            recordService.signingPayload(memberScopedRepoRecordId),
            privateKey,
          ).toString('hex'),
        }

        const memberScopedRepo = await node.context[
          REPO_ESTABLISHMENT_PROTOCOL_SERVICE
        ].establishRepo(memberScopedRepoRecord)

        assert.deepEqual(memberScopedRepo, {
          identity,
          operator: identity,
          establishmentRecordId: memberScopedRepoRecordId,
        })
        assert.deepEqual(
          await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].loadRepo(
            identity,
          ),
          memberScopedRepo,
        )

        const targetKeyPair = generateKeyPairSync('ed25519')
        const targetPublicKeyDer = targetKeyPair.publicKey.export({
          format: 'der',
          type: 'spki',
        }) as Buffer
        const targetIdentity = entityService.encodeBase58btc(
          targetPublicKeyDer.subarray(targetPublicKeyDer.byteLength - 32),
        )

        const rawTargetMemberRecord = {
          protocol: MEMBER_PROTOCOL_REFERENCE,
          protocolHash: MEMBER_PROTOCOL_HASH,
          createdBy: targetIdentity,
          createdAt: '2026-09-18T00:00:03.000Z',
          data: {},
        }
        const targetMemberRecordId = recordService.recordId(
          rawTargetMemberRecord,
        )
        const targetMemberRecord: CoreRecordValue = {
          id: targetMemberRecordId,
          ...rawTargetMemberRecord,
          signature: sign(
            null,
            recordService.signingPayload(targetMemberRecordId),
            targetKeyPair.privateKey,
          ).toString('hex'),
        }
        await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
          targetMemberRecord,
        )

        const rawMembershipAdd = {
          protocol: MEMBERSHIP_PROTOCOL_REFERENCE,
          protocolHash: MEMBERSHIP_PROTOCOL_HASH,
          createdBy: repoIdentity,
          createdAt: '2026-09-18T00:00:04.000Z',
          data: {
            repo: repoIdentity,
            member: targetIdentity,
            action: 'add',
          },
        }
        const membershipAddId = recordService.recordId(rawMembershipAdd)
        const membershipAdd: CoreRecordValue = {
          id: membershipAddId,
          ...rawMembershipAdd,
          signature: sign(
            null,
            recordService.signingPayload(membershipAddId),
            repoKeyPair.privateKey,
          ).toString('hex'),
        }

        assert.deepEqual(
          await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(
            membershipAdd,
          ),
          {
            repo: repoIdentity,
            member: targetIdentity,
            active: true,
            latestRecordId: membershipAddId,
            effectiveAt: rawMembershipAdd.createdAt,
          },
        )
        assert.equal(
          await node.context[MEMBERSHIP_PROTOCOL_SERVICE].hasMember(
            repoIdentity,
            targetIdentity,
          ),
          true,
        )

        const rawMembershipRemove = {
          protocol: MEMBERSHIP_PROTOCOL_REFERENCE,
          protocolHash: MEMBERSHIP_PROTOCOL_HASH,
          createdBy: repoIdentity,
          createdAt: '2026-09-18T00:00:05.000Z',
          data: {
            repo: repoIdentity,
            member: targetIdentity,
            action: 'remove',
          },
        }
        const membershipRemoveId = recordService.recordId(rawMembershipRemove)
        const membershipRemove: CoreRecordValue = {
          id: membershipRemoveId,
          ...rawMembershipRemove,
          signature: sign(
            null,
            recordService.signingPayload(membershipRemoveId),
            repoKeyPair.privateKey,
          ).toString('hex'),
        }

        assert.deepEqual(
          await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(
            membershipRemove,
          ),
          {
            repo: repoIdentity,
            member: targetIdentity,
            active: false,
            latestRecordId: membershipRemoveId,
            effectiveAt: rawMembershipRemove.createdAt,
          },
        )
      } finally {
        await node.dispose()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)

