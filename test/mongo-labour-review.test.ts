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
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  LABOUR_RECORD_PROTOCOL_SERVICE,
  LABOUR_REVIEW_SERVICE,
  LabourPatchConflictError,
  LabourPatchIntegrityError,
  LabourPatchValidationError,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  RuntimeRecordDatabaseNotFoundError,
  type StoredLabourPatch,
  createRepositoryNode,
  labourReviewPlugin,
  runtimeRecordDatabasePlugin,
  type CoreRecordValue,
} from '../src/index.ts'

const HASH = 'a'.repeat(64)
const IDENTITY = 'member-1'
const OTHER = 'member-2'

function coreProvider(ctx: Context): void {
  ctx.provide(CORE_ENTITY_PROTOCOL_SERVICE, {
    validateEntityPublicKey(value: unknown): string {
      if (value !== IDENTITY && value !== OTHER) throw Error('invalid Entity key')
      return value
    },
    validateEntity(value: unknown) {
      const key = (value as { publicKey?: unknown })?.publicKey
      if (key !== IDENTITY && key !== OTHER) throw Error('invalid Entity')
      return { publicKey: key }
    },
  })
  ctx.provide(CORE_RECORD_PROTOCOL_SERVICE, {
    validateRecord(value: unknown): CoreRecordValue {
      if (typeof value !== 'object' || value === null) throw Error('invalid Record')
      const record = value as Partial<CoreRecordValue>
      if (typeof record.id !== 'string' ||
          typeof record.createdBy !== 'string' ||
          typeof record.protocol !== 'string' ||
          typeof record.protocolHash !== 'string' ||
          typeof record.signature !== 'string' ||
          typeof record.createdAt !== 'string') throw Error('invalid Record')
      return record as CoreRecordValue
    },
    verifySignature(value: unknown): boolean {
      const record = value as CoreRecordValue
      return record.signature === 'sig:' + record.createdBy
    },
  })
}

function signed(id: string, protocol: string, author: string, data: unknown) {
  return {
    id, protocol, createdBy: author, protocolHash: HASH,
    createdAt: '2026-10-14T08:00:00.000Z',
    signature: 'sig:' + author, data,
  }
}

function composition(uri: string, databaseName: string) {
  return [
    { plugin: labourReviewPlugin },
    { plugin: labourPlugin, config: { protocolHash: HASH } },
    { plugin: memberPlugin, config: { protocolHash: HASH } },
    { plugin: coreProvider },
    { plugin: runtimeRecordDatabasePlugin, config: { uri, databaseName } },
  ]
}

async function cleanup(uri: string, databaseName: string) {
  const client = new MongoClient(uri)
  await client.connect()
  try {
    await client.db(databaseName).dropDatabase()
  } finally {
    await client.close()
  }
}

test('append-only annotations and rebuildable view survive Mongo restart', {
  skip: !process.env.MONGODB_TEST_URI,
}, async () => {
  const uri = process.env.MONGODB_TEST_URI!
  const databaseName = 'labour_review_' + randomUUID().replaceAll('-', '')
  const plugins = composition(uri, databaseName)
  const labour = signed('L1', LABOUR_RECORD_PROTOCOL_REFERENCE, IDENTITY, {
    content: 'Signed original L', duration: 0.5,
    references: ['asset:opaque-upstream'],
  })
  let node: Awaited<ReturnType<typeof createRepositoryNode>> | undefined
  try {
    node = await createRepositoryNode({ plugins })
    await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
      signed('member', MEMBER_PROTOCOL_REFERENCE, IDENTITY, {}),
    )
    await node.context[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord(labour)
    const review = node.context[LABOUR_REVIEW_SERVICE]
    const empty = await review.getCurrent(labour.id)
    assert.equal(empty.version, 0)
    assert.deepEqual(empty.annotations, [])
    await assert.rejects(review.getCurrent('not-signed-L'),
      RuntimeRecordDatabaseNotFoundError)

    const first = await review.append(labour.id, {
      parentId: null, memberIdentity: IDENTITY,
      note: 'Investigated memory use', labelsAdd: ['investigation'],
    })
    assert.equal(first.version, 1)
    assert.equal(first.record.data.content, 'Signed original L')
    const head = first.lastPatchId
    const second = await review.append(labour.id, {
      parentId: head, memberIdentity: IDENTITY,
      note: 'Confirmed the cause',
      labelsAdd: ['verified'], labelsRemove: ['investigation'],
    })
    assert.equal(second.version, 2)
    assert.deepEqual(second.labels, ['verified'])
    assert.deepEqual(second.annotations.map(x => x.note),
      ['Investigated memory use', 'Confirmed the cause'])
    assert.deepEqual(second.history.map(x => x.parentId), [null, head])
    await assert.rejects(review.append(labour.id, {
      parentId: head, memberIdentity: IDENTITY, note: 'Stale edit',
    }), LabourPatchConflictError)
    await assert.rejects(review.append(labour.id, {
      parentId: second.lastPatchId, memberIdentity: OTHER, note: 'Not a Member',
    }))
    await assert.rejects(review.append(labour.id, {
      parentId: second.lastPatchId, memberIdentity: IDENTITY,
      note: 'invalid', labelsAdd: ['same'], labelsRemove: ['same'],
    }), LabourPatchValidationError)

    const mongo = new MongoClient(uri)
    await mongo.connect()
    try {
      const db = mongo.db(databaseName)
      const original = await db.collection<{ _id: string; serialized: string }>('records')
        .findOne({ _id: labour.id })
      assert.ok(original)
      assert.deepEqual(JSON.parse(original.serialized), labour)
      assert.equal(await db.collection('labour_patches').countDocuments(), 2)
    } finally {
      await mongo.close()
    }

    await node.dispose()
    node = await createRepositoryNode({ plugins })
    const rebuilt = await node.context[LABOUR_REVIEW_SERVICE].getCurrent(labour.id)
    assert.deepEqual(rebuilt, second)
    assert.deepEqual(await node.context[LABOUR_REVIEW_SERVICE].listCurrent(), [second])
    assert.deepEqual(await node.context[LABOUR_RECORD_PROTOCOL_SERVICE]
      .loadLabourRecord(labour.id), second.record)
  } finally {
    if (node && !node.disposed) await node.dispose()
    await cleanup(uri, databaseName)
  }
})

test('concurrent appends cannot fork history; damaged history fails closed', {
  skip: !process.env.MONGODB_TEST_URI,
}, async () => {
  const uri = process.env.MONGODB_TEST_URI!
  const databaseName = 'labour_review_conflict_' + randomUUID().replaceAll('-', '')
  let node: Awaited<ReturnType<typeof createRepositoryNode>> | undefined
  try {
    node = await createRepositoryNode({ plugins: composition(uri, databaseName) })
    await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
      signed('member', MEMBER_PROTOCOL_REFERENCE, IDENTITY, {}),
    )
    const labour = signed('L2', LABOUR_RECORD_PROTOCOL_REFERENCE, IDENTITY, {
      content: 'Standalone accepted work', duration: 0,
    })
    await node.context[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord(labour)
    const review = node.context[LABOUR_REVIEW_SERVICE]
    const input = { parentId: null, memberIdentity: IDENTITY }
    const results = await Promise.allSettled([
      review.append(labour.id, { ...input, note: 'first' }),
      review.append(labour.id, { ...input, note: 'second' }),
    ])
    assert.equal(results.filter(x => x.status === 'fulfilled').length, 1)
    assert.equal(results.filter(x => x.status === 'rejected').length, 1)
    const current = await review.getCurrent(labour.id)
    assert.equal(current.history.length, 1)
    const orphan = {
      id: 'orphan', targetId: labour.id, parentId: 'missing',
      memberIdentity: IDENTITY, createdAt: '2026-10-14T08:00:00.000Z',
      note: 'orphan',
    }
    const mongo = new MongoClient(uri)
    await mongo.connect()
    try {
      await mongo.db(databaseName).collection<StoredLabourPatch>('labour_patches').insertOne({
        _id: orphan.id,
        targetId: orphan.targetId,
        parentId: orphan.parentId,
        serialized: JSON.stringify(orphan),
      })
    } finally {
      await mongo.close()
    }
    await assert.rejects(review.getCurrent(labour.id), LabourPatchIntegrityError)
    assert.equal((await node.context[LABOUR_RECORD_PROTOCOL_SERVICE]
      .loadLabourRecord(labour.id)).data.content, 'Standalone accepted work')
  } finally {
    if (node && !node.disposed) await node.dispose()
    await cleanup(uri, databaseName)
  }
})
