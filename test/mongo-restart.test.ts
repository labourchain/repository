import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { MongoClient } from 'mongodb'
import {
  createRepositoryNode,
  runtimeRecordDatabasePlugin,
  RuntimeRecordDatabaseConflictError,
  RuntimeRecordDatabaseNotFoundError,
} from '../src/index.ts'

test('MongoDB stores exact Record facts across independent Cordis Node restarts', {
  skip: !process.env.MONGODB_TEST_URI,
}, async () => {
  const uri = process.env.MONGODB_TEST_URI!
  const databaseName = 'labourchain_ci_' + randomUUID().replaceAll('-', '')
  const plugin = { plugin: runtimeRecordDatabasePlugin, config: { uri, databaseName } }
  const signed = {
    id: 'record-1',
    protocol: 'labour.record@0.1.0',
    protocolHash: 'a'.repeat(64),
    createdBy: 'member-1',
    createdAt: '2026-10-13T00:00:00Z',
    signature: 'unchanged-signature',
    data: { content: 'immutable fact', references: [] },
  }
  let node: Awaited<ReturnType<typeof createRepositoryNode>> | undefined
  try {
    node = await createRepositoryNode({ plugins: [plugin] })
    await node.context.runtimeRecordDatabase.runExclusive(
      async (db) => db.accept(signed),
    )
    await node.dispose()
    node = await createRepositoryNode({ plugins: [plugin] })
    assert.deepEqual(
      await node.context.runtimeRecordDatabase.get(signed.id),
      signed,
    )
    await node.context.runtimeRecordDatabase.runExclusive(
      async (db) => db.accept({ ...signed }),
    )
    const conflicting = { ...signed, signature: 'different' }
    await assert.rejects(
      node.context.runtimeRecordDatabase.runExclusive(
        async (db) => db.accept(conflicting),
      ),
      RuntimeRecordDatabaseConflictError,
    )
    await assert.rejects(
      node.context.runtimeRecordDatabase.get('absent'),
      RuntimeRecordDatabaseNotFoundError,
    )
    const records = []
    for await (const item of node.context.runtimeRecordDatabase.iterateAccepted()) {
      records.push(item)
    }
    assert.deepEqual(records, [signed])
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
