import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { MongoClient } from 'mongodb'
import { plugin as memberPlugin } from '../src/protocols/member.identity.ts'
import { plugin as labourPlugin } from '../src/protocols/labour.record.ts'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  LABOUR_CAPTURE_SERVICE,
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  LABOUR_RECORD_PROTOCOL_SERVICE,
  LabourInputConflictError,
  LabourInputNotFoundError,
  LabourInputValidationError,
  LabourRecordValidationError,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  RuntimeRecordDatabaseNotFoundError,
  createRepositoryNode,
  labourCapturePlugin,
  runtimeRecordDatabasePlugin,
  type CoreRecordValue,
  type NewLabourInput,
} from '../src/index.ts'

const HASH = 'a'.repeat(64)
const AUTHOR = 'signed-member'
const SECOND = 'other-member'

function coreProvider(ctx: Context): void {
  ctx.provide(CORE_ENTITY_PROTOCOL_SERVICE, {
    validateEntityPublicKey(value: unknown) {
      if (value !== AUTHOR && value !== SECOND) throw Error('invalid public key')
      return value
    },
    validateEntity(value: unknown) {
      const publicKey = (value as { publicKey?: unknown })?.publicKey
      if (publicKey !== AUTHOR && publicKey !== SECOND) {
        throw Error('invalid Entity')
      }
      return { publicKey }
    },
  })
  ctx.provide(CORE_RECORD_PROTOCOL_SERVICE, {
    validateRecord(value: unknown): CoreRecordValue {
      if (typeof value !== 'object' || value === null) {
        throw Error('invalid Core Record')
      }
      const record = value as Partial<CoreRecordValue>
      if (typeof record.id !== 'string' ||
          typeof record.protocol !== 'string' ||
          typeof record.protocolHash !== 'string' ||
          typeof record.signature !== 'string' ||
          typeof record.createdBy !== 'string' ||
          typeof record.createdAt !== 'string' ||
          !Object.prototype.hasOwnProperty.call(value, 'data')) {
        throw Error('invalid Core Record')
      }
      return record as CoreRecordValue
    },
    verifySignature(value: unknown): boolean {
      const record = value as CoreRecordValue
      return record.signature === 'sig:' + record.createdBy
    },
  })
}

function signed(
  id: string, protocol: string, createdBy: string, data: unknown,
  protocolHash = HASH,
): CoreRecordValue {
  return {
    id, protocol, protocolHash, createdBy,
    createdAt: '2026-10-13T10:00:00Z',
    signature: 'sig:' + createdBy, data,
  }
}

function composition(uri: string, databaseName: string) {
  return [
    { plugin: labourCapturePlugin },
    { plugin: labourPlugin, config: { protocolHash: HASH } },
    { plugin: memberPlugin, config: { protocolHash: HASH } },
    { plugin: coreProvider },
    { plugin: runtimeRecordDatabasePlugin, config: { uri, databaseName } },
  ]
}

test('natural-language draft and independently signed L survive Mongo restart', {
  skip: !process.env.MONGODB_TEST_URI,
}, async () => {
  const uri = process.env.MONGODB_TEST_URI!
  const databaseName = 'labour_capture_' + randomUUID().replaceAll('-', '')
  const plugins = composition(uri, databaseName)
  const l = signed('labour-confirmed', LABOUR_RECORD_PROTOCOL_REFERENCE, AUTHOR, {
    content: 'Member-confirmed details differ from the suggestion',
    duration: 1,
    references: ['asset:opaque-reference'],
  })
  let node: Awaited<ReturnType<typeof createRepositoryNode>> | undefined
  try {
    node = await createRepositoryNode({ plugins })
    await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
      signed('member-1', MEMBER_PROTOCOL_REFERENCE, AUTHOR, {}),
    )
    await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
      signed('member-2', MEMBER_PROTOCOL_REFERENCE, SECOND, {}),
    )
    const capture = node.context[LABOUR_CAPTURE_SERVICE]
    const raw = '  我今天处理了数据，时间记不太清楚。\n '
    const draft = await capture.create({
      memberIdentity: AUTHOR,
      originalText: raw,
      source: 'manual-note',
      sourceReference: 'note:2026-10-13/1',
      suggested: {
        content: '可能处理了数据',
        duration: 0.5,
        references: ['asset:opaque-reference'],
      },
    })
    assert.equal(draft.status, 'draft')
    assert.equal(draft.input.originalText, raw)
    assert.equal(draft.input.source, 'manual-note')
    assert.equal(draft.input.sourceReference, 'note:2026-10-13/1')
    assert.deepEqual(draft.input.suggested, {
      content: '可能处理了数据',
      duration: 0.5,
      references: ['asset:opaque-reference'],
    })
    assert.equal(draft.confirmed, undefined)
    assert.equal((await capture.get(draft.input.id)).status, 'draft')
    assert.equal((await capture.list()).length, 1)
    assert.deepEqual(await capture.listSigned(), [])
    await assert.rejects(
      capture.loadSigned(l.id), RuntimeRecordDatabaseNotFoundError,
    )
    await assert.rejects(
      capture.get('missing-draft'), LabourInputNotFoundError,
    )

    await assert.rejects(
      capture.confirm(draft.input.id, { ...l, signature: 'not-member-signed' }),
      LabourRecordValidationError,
    )
    await assert.rejects(
      capture.confirm(draft.input.id, { ...l, protocolHash: 'b'.repeat(64) }),
      LabourRecordValidationError,
    )
    await assert.rejects(
      capture.confirm(draft.input.id, {
        ...l, id: 'different-author', createdBy: SECOND, signature: 'sig:' + SECOND,
      }),
      LabourInputValidationError,
    )
    assert.equal((await capture.get(draft.input.id)).status, 'draft')
    await assert.rejects(
      capture.loadSigned(l.id), RuntimeRecordDatabaseNotFoundError,
    )

    const confirmed = await capture.confirm(draft.input.id, l)
    assert.equal(confirmed.status, 'confirmed')
    assert.equal(confirmed.input.confirmedRecordId, l.id)
    assert.equal(confirmed.confirmed?.data.content, l.data &&
      (l.data as { content: string }).content)
    assert.deepEqual(await capture.confirm(draft.input.id, l), confirmed)
    await assert.rejects(
      capture.confirm(draft.input.id, { ...l, id: 'another-labour' }),
      LabourInputConflictError,
    )
    await assert.rejects(
      capture.loadSigned('another-labour'), RuntimeRecordDatabaseNotFoundError,
    )

    // Signed L can be accepted and queried directly, with no input, A or D.
    const standalone = signed(
      'labour-alone', LABOUR_RECORD_PROTOCOL_REFERENCE, AUTHOR,
      { content: 'A standalone labour action', duration: 0, assets: [] },
    )
    await node.context[LABOUR_RECORD_PROTOCOL_SERVICE]
      .acceptLabourRecord(standalone)
    assert.equal((await capture.listSigned()).length, 2)
    assert.equal((await capture.loadSigned(standalone.id)).recordId, standalone.id)

    await node.dispose()
    node = await createRepositoryNode({ plugins })
    const after = await node.context[LABOUR_CAPTURE_SERVICE].get(draft.input.id)
    assert.deepEqual(after, confirmed)
    assert.equal(after.input.originalText, raw)
    assert.equal(after.input.sourceReference, 'note:2026-10-13/1')
    assert.equal((await node.context[LABOUR_CAPTURE_SERVICE].list()).length, 1)
    assert.equal((await node.context[LABOUR_CAPTURE_SERVICE].listSigned()).length, 2)
    assert.equal((await node.context[LABOUR_CAPTURE_SERVICE].loadSigned(l.id))
      .data.duration, 1)

    // Unsigned metadata and signed facts stay in different Mongo collections.
    const check = new MongoClient(uri)
    await check.connect()
    try {
      const db = check.db(databaseName)
      assert.equal(await db.collection('labour_inputs').countDocuments(), 1)
      assert.equal(await db.collection('records').countDocuments(), 4)
      assert.equal(await db.collection('records')
        .countDocuments({ _id: draft.input.id }), 0)
    } finally {
      await check.close()
    }
  } finally {
    if (node && !node.disposed) await node.dispose()
    const client = new MongoClient(uri)
    await client.connect()
    try {
      await client.db(databaseName).dropDatabase()
    } finally {
      await client.close()
    }
  }
})

test('capture rejects invalid input and incomplete or invented suggested fields', {
  skip: !process.env.MONGODB_TEST_URI,
}, async () => {
  const uri = process.env.MONGODB_TEST_URI!
  const databaseName = 'labour_capture_validation_' + randomUUID().replaceAll('-', '')
  let node: Awaited<ReturnType<typeof createRepositoryNode>> | undefined
  try {
    node = await createRepositoryNode({
      plugins: composition(uri, databaseName),
    })
    await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
      signed('member-1', MEMBER_PROTOCOL_REFERENCE, AUTHOR, {}),
    )
    const capture = node.context[LABOUR_CAPTURE_SERVICE]
    const valid = {
      memberIdentity: AUTHOR, originalText: '今天解决了一处问题',
      source: 'direct-entry',
    }
    const invalidInputs: unknown[] = [
      { ...valid, originalText: '' },
      { ...valid, source: ' ' },
      { ...valid, sourceReference: ' ' },
      { ...valid, suggested: { content: '' } },
      { ...valid, suggested: { duration: 0.25 } },
      { ...valid, suggested: { tags: ['design'] } },
      { ...valid, suggested: { startAt: '2026-10-13T10:00:00Z' } },
    ]
    for (const invalid of invalidInputs) {
      await assert.rejects(
        capture.create(invalid as NewLabourInput),
        LabourInputValidationError,
      )
    }
    await assert.rejects(capture.create({
      ...valid, memberIdentity: SECOND,
    }))
    const sparse = await capture.create({
      ...valid, suggested: { content: '未确认的描述' },
    })
    assert.deepEqual(sparse.input.suggested, { content: '未确认的描述' })
    assert.equal(sparse.status, 'draft')
    const empty = await capture.create(valid)
    assert.equal(empty.input.suggested, undefined)
    assert.equal((await capture.list()).length, 2)
  } finally {
    if (node && !node.disposed) await node.dispose()
    const client = new MongoClient(uri)
    await client.connect()
    try {
      await client.db(databaseName).dropDatabase()
    } finally {
      await client.close()
    }
  }
})
