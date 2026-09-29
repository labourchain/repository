import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { plugin as labourRecordPlugin } from '../src/protocols/labour.record.ts'
import { plugin as memberIdentityPlugin } from '../src/protocols/member.identity.ts'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  LABOUR_RECORD_PROTOCOL_SERVICE,
  LabourRecordProtocolConfigError,
  LabourRecordValidationError,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  RecordJournalService,
  createRepositoryNode,
  type CoreRecordProtocolService,
  type CoreRecordValue,
} from '../src/index.ts'

const LABOUR_PROTOCOL_HASH = 'c'.repeat(64)
const MEMBER_PROTOCOL_HASH = 'a'.repeat(64)
const MEMBER_KEY = 'member-key'
const OTHER_KEY = 'other-key'

function validateTestEntityPublicKey(value: unknown): string {
  if (value !== MEMBER_KEY && value !== OTHER_KEY) {
    throw new Error('invalid test EntityPublicKey')
  }
  return value
}

function coreEntityProvider(ctx: Context) {
  ctx.provide(CORE_ENTITY_PROTOCOL_SERVICE, {
    validateEntityPublicKey: validateTestEntityPublicKey,
    validateEntity(value: unknown) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('invalid test Entity')
      }
      const entity = value as Record<string, unknown>
      return { publicKey: validateTestEntityPublicKey(entity.publicKey) }
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

function memberRecord(id: string): CoreRecordValue {
  return {
    id,
    protocol: MEMBER_PROTOCOL_REFERENCE,
    protocolHash: MEMBER_PROTOCOL_HASH,
    createdBy: MEMBER_KEY,
    createdAt: '2026-09-29T00:00:00.000Z',
    signature: 'valid-signature',
    data: {},
  }
}

function labourRecord(
  id: string,
  data: unknown = {
    content: '梳理新的 bug 排查原则与方法，形成 skill',
    duration: 0.5,
    references: ['asset:old-debug-notes'],
    assets: ['asset:skill-debugging'],
  },
  overrides: Partial<CoreRecordValue> = {},
): CoreRecordValue {
  return {
    id,
    protocol: LABOUR_RECORD_PROTOCOL_REFERENCE,
    protocolHash: LABOUR_PROTOCOL_HASH,
    createdBy: MEMBER_KEY,
    createdAt: '2026-09-29T00:30:00.000Z',
    signature: 'valid-signature',
    data,
    ...overrides,
  }
}

async function withDirectory<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'labourchain-labour-record-test-'))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function composition(directory: string) {
  return [
    {
      plugin: labourRecordPlugin,
      config: { protocolHash: LABOUR_PROTOCOL_HASH },
    },
    {
      plugin: memberIdentityPlugin,
      config: { protocolHash: MEMBER_PROTOCOL_HASH },
    },
    { plugin: coreEntityProvider },
    { plugin: coreRecordProvider },
    { plugin: RecordJournalService, config: { directory } },
  ]
}

async function declareMember(node: Awaited<ReturnType<typeof createRepositoryNode>>) {
  await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
    memberRecord('member-declaration'),
  )
}

test('Protocol artifact entry exports exactly one named plugin', async () => {
  const namespace = await import('../src/protocols/labour.record.ts')
  assert.deepEqual(Object.keys(namespace), ['plugin'])
  assert.equal(namespace.plugin.name, LABOUR_RECORD_PROTOCOL_REFERENCE)
  assert.equal(namespace.plugin.provide, LABOUR_RECORD_PROTOCOL_SERVICE)
  assert.deepEqual(namespace.plugin.inject, [
    CORE_RECORD_PROTOCOL_SERVICE,
    MEMBER_PROTOCOL_SERVICE,
    'recordJournal',
  ])
})

test('accepts and reloads a Member-signed labour Record', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)

    const record = labourRecord('labour-1')
    const accepted =
      await node.context[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord(record)

    assert.deepEqual(accepted, {
      recordId: 'labour-1',
      createdBy: MEMBER_KEY,
      data: record.data,
    })
    assert.deepEqual(
      await node.context[LABOUR_RECORD_PROTOCOL_SERVICE].loadLabourRecord(
        'labour-1',
      ),
      accepted,
    )
    assert.deepEqual(await node.context.recordJournal.get('labour-1'), record)
    await node.dispose()
  })
})

test('reloads a labour Record after restart without a secondary index', async () => {
  await withDirectory(async (directory) => {
    const first = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(first)
    await first.context[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord(
      labourRecord('labour-restart'),
    )
    await first.dispose()

    const second = await createRepositoryNode({ plugins: composition(directory) })
    const loaded =
      await second.context[LABOUR_RECORD_PROTOCOL_SERVICE].loadLabourRecord(
        'labour-restart',
      )
    assert.equal(loaded.recordId, 'labour-restart')
    assert.equal(loaded.data.duration, 0.5)
    await second.dispose()
  })
})

test('accepts zero-duration incidental labour and optional observed time logs', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)

    const accepted =
      await node.context[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord(
        labourRecord('labour-zero', {
          content: '随手确认并修正一处字段命名',
          duration: 0,
          startAt: '2026-09-29T01:00:00.000Z',
          endAt: '2026-09-29T01:20:00.000Z',
        }),
      )

    assert.equal(accepted.data.duration, 0)
    assert.equal(accepted.data.startAt, '2026-09-29T01:00:00.000Z')
    assert.equal(accepted.data.endAt, '2026-09-29T01:20:00.000Z')
    await node.dispose()
  })
})

test('does not derive duration from startAt/endAt', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)

    const accepted =
      await node.context[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord(
        labourRecord('labour-subjective-time', {
          content: '整理一个设计问题',
          duration: 0.5,
          startAt: '2026-09-29T01:00:00.000Z',
          endAt: '2026-09-29T03:00:00.000Z',
        }),
      )
    assert.equal(accepted.data.duration, 0.5)
    await node.dispose()
  })
})

test('allows the same Asset to be referenced and declared as a result', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)

    const accepted =
      await node.context[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord(
        labourRecord('labour-modify-asset', {
          content: '修改现有设计文档',
          duration: 1,
          references: ['asset:design-doc'],
          assets: ['asset:design-doc'],
        }),
      )
    assert.deepEqual(accepted.data.references, ['asset:design-doc'])
    assert.deepEqual(accepted.data.assets, ['asset:design-doc'])
    await node.dispose()
  })
})

test('rejects non-Member author, wrong protocol identity/hash and invalid signature', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)
    const service = node.context[LABOUR_RECORD_PROTOCOL_SERVICE]

    await assert.rejects(
      service.acceptLabourRecord(
        labourRecord('non-member', undefined, { createdBy: OTHER_KEY }),
      ),
      LabourRecordValidationError,
    )
    await assert.rejects(
      service.acceptLabourRecord(
        labourRecord('wrong-protocol', undefined, {
          protocol: 'labour.other@0.1.0',
        }),
      ),
      LabourRecordValidationError,
    )
    await assert.rejects(
      service.acceptLabourRecord(
        labourRecord('wrong-hash', undefined, {
          protocolHash: 'd'.repeat(64),
        }),
      ),
      LabourRecordValidationError,
    )
    await assert.rejects(
      service.acceptLabourRecord(
        labourRecord('bad-signature', undefined, {
          signature: 'invalid-signature',
        }),
      ),
      LabourRecordValidationError,
    )
    await node.dispose()
  })
})

test('validates the flat labour.record payload strictly', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)
    const service = node.context[LABOUR_RECORD_PROTOCOL_SERVICE]

    const invalidData = [
      { content: '', duration: 0.5 },
      { content: 'x', duration: -0.5 },
      { content: 'x', duration: 0.25 },
      { content: 'x', duration: Number.POSITIVE_INFINITY },
      { content: 'x', duration: 0.5, tags: ['type:design'] },
      { content: 'x', duration: 0.5, startAt: '2026-09-29T01:00:00.000Z' },
      {
        content: 'x',
        duration: 0.5,
        startAt: '2026-09-29T02:00:00.000Z',
        endAt: '2026-09-29T01:00:00.000Z',
      },
      { content: 'x', duration: 0.5, references: [''] },
      { content: 'x', duration: 0.5, references: ['asset:a', 'asset:a'] },
      { content: 'x', duration: 0.5, assets: [' asset:a'] },
    ]

    for (const [index, data] of invalidData.entries()) {
      await assert.rejects(
        service.acceptLabourRecord(labourRecord(`invalid-${index}`, data)),
        LabourRecordValidationError,
      )
    }

    await node.dispose()
  })
})

test('exact replay is idempotent', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)
    const record = labourRecord('labour-idempotent')
    const service = node.context[LABOUR_RECORD_PROTOCOL_SERVICE]

    const first = await service.acceptLabourRecord(record)
    const second = await service.acceptLabourRecord(record)
    assert.deepEqual(second, first)
    await node.dispose()
  })
})

test('fails startup when Host does not supply an exact ProtocolHash', () => {
  assert.throws(
    () =>
      labourRecordPlugin.apply({} as Context, {
        protocolHash: 'not-a-hash',
      }),
    LabourRecordProtocolConfigError,
  )
})
