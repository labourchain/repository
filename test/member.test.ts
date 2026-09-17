import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import { plugin as memberIdentityPlugin } from '../src/protocols/member.identity.ts'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  MemberConflictError,
  MemberEstablishmentError,
  MemberNotFoundError,
  MemberProtocolConfigError,
  RecordJournalService,
  createRepositoryNode,
  type CoreRecordProtocolService,
  type CoreRecordValue,
} from '../src/index.ts'

const PROTOCOL_HASH = 'a'.repeat(64)
const MEMBER_KEY = 'member-key'
const OTHER_KEY = 'other-key'

function coreEntityProvider(ctx: Context) {
  ctx.provide(CORE_ENTITY_PROTOCOL_SERVICE, {
    validateEntityPublicKey(value: unknown) {
      if (value !== MEMBER_KEY && value !== OTHER_KEY) {
        throw new Error('invalid test EntityPublicKey')
      }
      return value
    },
  })
}

const coreRecordService: CoreRecordProtocolService = {
  validateRecord(value: unknown): CoreRecordValue {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('invalid test Record')
    }
    const record = value as Partial<CoreRecordValue>
    if (
      typeof record.id !== 'string' ||
      typeof record.protocol !== 'string' ||
      typeof record.protocolHash !== 'string' ||
      typeof record.createdBy !== 'string' ||
      typeof record.createdAt !== 'string' ||
      typeof record.signature !== 'string' ||
      !Object.prototype.hasOwnProperty.call(record, 'data')
    ) {
      throw new Error('invalid test Record')
    }
    return record as CoreRecordValue
  },
  verifySignature(value: unknown) {
    return (value as Partial<CoreRecordValue>)?.signature === 'valid-signature'
  },
}

function coreRecordProvider(ctx: Context) {
  ctx.provide(CORE_RECORD_PROTOCOL_SERVICE, coreRecordService)
}

function memberRecord(
  id: string,
  overrides: Partial<CoreRecordValue> = {},
): CoreRecordValue {
  return {
    id,
    protocol: MEMBER_PROTOCOL_REFERENCE,
    protocolHash: PROTOCOL_HASH,
    createdBy: MEMBER_KEY,
    createdAt: '2026-09-17T00:00:00.000Z',
    signature: 'valid-signature',
    data: {},
    ...overrides,
  }
}

async function withDirectory<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'labourchain-member-test-'))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function memberPluginEntry() {
  return {
    plugin: memberIdentityPlugin,
    config: { protocolHash: PROTOCOL_HASH },
  }
}

function composition(directory: string) {
  return [
    memberPluginEntry(),
    { plugin: coreEntityProvider },
    { plugin: coreRecordProvider },
    { plugin: RecordJournalService, config: { directory } },
  ]
}

test('Protocol artifact entry exports exactly one named plugin', async () => {
  const namespace = await import('../src/protocols/member.identity.ts')
  assert.deepEqual(Object.keys(namespace), ['plugin'])
  assert.equal(namespace.plugin.name, MEMBER_PROTOCOL_REFERENCE)
  assert.deepEqual(namespace.plugin.inject, [
    CORE_ENTITY_PROTOCOL_SERVICE,
    CORE_RECORD_PROTOCOL_SERVICE,
    'recordJournal',
  ])
})

test('establishes and requires a Member through the Cordis Protocol plugin', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    const record = memberRecord('member-record-1')

    const established = await node.context[MEMBER_PROTOCOL_SERVICE].establishMember(record)
    const loaded = await node.context[MEMBER_PROTOCOL_SERVICE].requireMember(MEMBER_KEY)

    assert.deepEqual(established, {
      identity: MEMBER_KEY,
      establishmentRecordId: record.id,
    })
    assert.deepEqual(loaded, established)

    const stored = await node.context.recordJournal.get(record.id)
    assert.deepEqual(stored, record)
    await node.dispose()
  })
})

test('rebuilds Member recognition from the durable journal after restart', async () => {
  await withDirectory(async (directory) => {
    const first = await createRepositoryNode({ plugins: composition(directory) })
    const record = memberRecord('member-record-restart')
    await first.context[MEMBER_PROTOCOL_SERVICE].establishMember(record)
    await first.dispose()

    const second = await createRepositoryNode({ plugins: composition(directory) })
    assert.deepEqual(
      await second.context[MEMBER_PROTOCOL_SERVICE].requireMember(MEMBER_KEY),
      { identity: MEMBER_KEY, establishmentRecordId: record.id },
    )
    await second.dispose()
  })
})

test('rejects a non-Member identity without creating it implicitly', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })

    await assert.rejects(
      node.context[MEMBER_PROTOCOL_SERVICE].requireMember(OTHER_KEY),
      MemberNotFoundError,
    )

    await node.dispose()
  })
})

test('re-submitting the exact establishment Record is idempotent', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    const record = memberRecord('member-record-idempotent')

    const first = await node.context[MEMBER_PROTOCOL_SERVICE].establishMember(record)
    const second = await node.context[MEMBER_PROTOCOL_SERVICE].establishMember(record)

    assert.deepEqual(second, first)
    await node.dispose()
  })
})

test('rejects a conflicting establishment Record for the same Member identity', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await node.context[MEMBER_PROTOCOL_SERVICE].establishMember(memberRecord('member-record-original'))

    await assert.rejects(
      node.context[MEMBER_PROTOCOL_SERVICE].establishMember(memberRecord('member-record-conflict')),
      MemberConflictError,
    )

    await node.dispose()
  })
})

test('fails closed for wrong protocol identity, signature, payload, and Entity identity', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    const service = node.context[MEMBER_PROTOCOL_SERVICE]

    await assert.rejects(
      service.establishMember(memberRecord('wrong-ref', { protocol: 'member.profile@0.1.0' })),
      MemberEstablishmentError,
    )
    await assert.rejects(
      service.establishMember(memberRecord('wrong-hash', { protocolHash: 'b'.repeat(64) })),
      MemberEstablishmentError,
    )
    await assert.rejects(
      service.establishMember(memberRecord('bad-signature', { signature: 'invalid-signature' })),
      MemberEstablishmentError,
    )
    await assert.rejects(
      service.establishMember(memberRecord('non-empty', { data: { member: MEMBER_KEY } })),
      MemberEstablishmentError,
    )
    await assert.rejects(
      service.establishMember(memberRecord('bad-identity', { createdBy: 'not-an-entity-key' })),
      MemberEstablishmentError,
    )
    await assert.rejects(
      service.requireMember('not-an-entity-key'),
      MemberEstablishmentError,
    )

    await node.dispose()
  })
})

test('fails startup when the Host does not supply an exact ProtocolHash', async () => {
  await withDirectory(async (directory) => {
    await assert.rejects(
      createRepositoryNode({
        plugins: [
          { plugin: memberIdentityPlugin, config: { protocolHash: 'not-a-hash' } },
          { plugin: coreEntityProvider },
          { plugin: coreRecordProvider },
          { plugin: RecordJournalService, config: { directory } },
        ],
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.ok(error.cause instanceof MemberProtocolConfigError)
        return true
      },
    )
  })
})

test('fails closed if durable journal contains conflicting Member establishments', async () => {
  await withDirectory(async (directory) => {
    const journalNode = await createRepositoryNode({
      plugins: [{ plugin: RecordJournalService, config: { directory } }],
    })
    await journalNode.context.recordJournal.accept(memberRecord('durable-a'))
    await journalNode.context.recordJournal.accept(memberRecord('durable-b'))
    await journalNode.dispose()

    await assert.rejects(
      createRepositoryNode({ plugins: composition(directory) }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.ok(error.cause instanceof MemberConflictError)
        return true
      },
    )
  })
})
