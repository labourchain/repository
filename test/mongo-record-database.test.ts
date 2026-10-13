import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Collection } from 'mongodb'
import {
  MongoRuntimeRecordDatabaseService,
  RuntimeRecordDatabaseConflictError,
  RuntimeRecordDatabaseCorruptionError,
  RuntimeRecordDatabaseInputError,
  RuntimeRecordDatabaseNotFoundError,
  RuntimeRecordDatabasePublicationError,
  RuntimeRecordDatabaseStorageError,
  runtimeRecordDatabasePlugin,
} from '../src/index.ts'
import { RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE } from '../src/internal-publication.ts'

interface Doc { _id: string; serialized: string }

function store() {
  const values = new Map<string, Doc>()
  let fail: 'insert' | 'read' | 'iterate' | undefined
  const collection = {
    async insertOne(value: Doc) {
      if (fail === 'insert') throw new Error('database insert unavailable')
      if (values.has(value._id)) throw { code: 11000 }
      values.set(value._id, structuredClone(value))
      return {} 
    },
    async findOne(filter: { _id: string }) {
      if (fail === 'read') throw new Error('database read unavailable')
      return structuredClone(values.get(filter._id) ?? null)
    },
    find() {
      return {
        sort() {
          return {
            async *[Symbol.asyncIterator]() {
              if (fail === 'iterate') throw new Error('database cursor unavailable')
              for (const doc of [...values.values()].sort((a, b) =>
                a._id.localeCompare(b._id))) yield structuredClone(doc)
            },
          }
        },
      }
    },
  }
  return {
    values,
    collection: collection as unknown as Collection<Doc>,
    setFailure(value: typeof fail) { fail = value },
  }
}

function record(id = 'a', value: unknown = 'valid') {
  return {
    id, protocol: 'labour.record@0.1.0', protocolHash: 'a'.repeat(64),
    createdBy: 'member', createdAt: '2026-10-13T00:00:00Z',
    signature: 'sig', data: { content: value },
  }
}

test('Mongo Record provider reads and replays exact persisted Records across service restart', async () => {
  const db = store()
  const first = new MongoRuntimeRecordDatabaseService(db.collection)
  const signed = record('a')
  await first.runExclusive(async (session) => session.accept(signed))
  const second = new MongoRuntimeRecordDatabaseService(db.collection)
  await second.runExclusive(async (session) => session.accept({ ...signed }))
  assert.deepEqual(await second.get('a'), signed)
  const restored = await second.get('a')
  assert.ok(
    'data' in restored &&
    typeof restored.data === 'object' &&
    restored.data !== null &&
    'content' in restored.data,
  )
  restored.data.content = 'changed'
  assert.deepEqual(await second.get('a'), signed)
  await assert.rejects(
    second.runExclusive(async (session) => session.accept(record('a', 'different'))),
    RuntimeRecordDatabaseConflictError,
  )
  assert.deepEqual(await second.get('a'), signed)
  await assert.rejects(second.get('absent'), RuntimeRecordDatabaseNotFoundError)
  await second.runExclusive(async (session) => session.accept(record('b')))
  const seen = []
  for await (const item of second.iterateAccepted()) seen.push(item.id)
  assert.deepEqual(seen, ['a', 'b'])
  assert.equal(db.values.get('a')?.serialized.includes('"_id"'), false)
})

test('Mongo Record provider guards Repo D on public ingress but allows contribution-owned D last', async () => {
  const db = store()
  const service = new MongoRuntimeRecordDatabaseService(db.collection)
  const d = { ...record('d'), protocol: 'repo.contribution@0.1.0' }
  await assert.rejects(
    service.runExclusive(async (session) => session.accept(d)),
    RuntimeRecordDatabasePublicationError,
  )
  await assert.rejects(service.get('d'), RuntimeRecordDatabaseNotFoundError)
  await service[RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE](
    async (session) => session.accept(d),
  )
  assert.deepEqual(await service.get('d'), d)
})

test('Mongo Record provider preserves domain mutation gate and releases it on failure', async () => {
  const db = store()
  const service = new MongoRuntimeRecordDatabaseService(db.collection)
  let release!: () => void
  const hold = new Promise<void>((resolve) => { release = resolve })
  const order: string[] = []
  const first = service.runExclusive(async (session) => {
    await session.accept(record('first'))
    order.push('first-start')
    await hold
    order.push('first-end')
  })
  const second = service.runExclusive(async (session) => {
    order.push('second')
    await session.accept(record('second'))
  })
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.deepEqual(order, ['first-start'])
  release()
  await Promise.all([first, second])
  assert.deepEqual(order, ['first-start', 'first-end', 'second'])
  await assert.rejects(
    service.runExclusive(async () => { throw new Error('interrupted') }),
    /interrupted/u,
  )
  await service.runExclusive(async (session) => session.accept(record('third')))
  assert.deepEqual(await service.get('third'), record('third'))
})

test('Mongo Record provider distinguishes input, corruption, conflict and provider failure', async () => {
  const db = store()
  const service = new MongoRuntimeRecordDatabaseService(db.collection)
  await assert.rejects(service.get(''), RuntimeRecordDatabaseInputError)
  await assert.rejects(
    service.runExclusive(async (session) => session.accept({ id: '' })),
    RuntimeRecordDatabaseInputError,
  )
  const invalidBigInt = { id: 'broken', data: { value: 1n } }
  const lossyRecord = { id: 'lossy', data: { optional: undefined } }
  const invalidDate = {
    id: 'date',
    data: new Date('2026-10-13T00:00:00Z'),
  }
  for (const invalid of [invalidBigInt, lossyRecord, invalidDate]) {
    await assert.rejects(
      service.runExclusive(async (session) => session.accept(invalid)),
      RuntimeRecordDatabaseInputError,
    )
  }
  db.setFailure('insert')
  await assert.rejects(
    service.runExclusive(async (session) => session.accept(record('x'))),
    RuntimeRecordDatabaseStorageError,
  )
  db.setFailure('read')
  await assert.rejects(service.get('x'), RuntimeRecordDatabaseStorageError)
  db.setFailure('iterate')
  await assert.rejects(async () => {
    for await (const _record of service.iterateAccepted()) { /* read */ }
  }, RuntimeRecordDatabaseStorageError)
  db.setFailure(undefined)
  db.values.set('broken', { _id: 'broken', serialized: '{"id":"other"}' })
  await assert.rejects(service.get('broken'), RuntimeRecordDatabaseCorruptionError)
  await assert.rejects(
    service.runExclusive(async (session) => session.accept(record('broken'))),
    RuntimeRecordDatabaseCorruptionError,
  )
})

test('Mongo plugin requires an explicit configured database; there is no fallback', async () => {
  await assert.rejects(
    runtimeRecordDatabasePlugin.apply({} as never, {
      uri: '', databaseName: 'labourchain',
    }),
    RuntimeRecordDatabaseInputError,
  )
})
