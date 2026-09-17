import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  RecordJournalConflictError,
  RecordJournalCorruptionError,
  RecordJournalNotFoundError,
  RecordJournalService,
  RecordJournalStorageError,
  createRepositoryNode,
  type JournalRecord,
} from '../src/index.ts'

function record(id: string, overrides: Partial<JournalRecord> = {}): JournalRecord {
  return {
    id,
    plugin: 'repo.test@0.1.0',
    pluginHash: 'b'.repeat(64),
    createdBy: 'worker-public-key',
    createdAt: '2026-09-17T00:00:00Z',
    signature: 'c'.repeat(128),
    data: { value: id.slice(0, 4) },
    ...overrides,
  }
}

async function tempJournalDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'labourchain-record-journal-'))
}

async function createJournalNode(directory: string) {
  return createRepositoryNode({
    plugins: [{ plugin: RecordJournalService, config: { directory } }],
  })
}

test('durably accepts and reads an exact Record', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await createJournalNode(directory)
  const expected = record('a'.repeat(64))

  await node.context.recordJournal.accept(expected)
  assert.deepEqual(await node.context.recordJournal.get(expected.id), expected)

  await node.dispose()
})

test('survives Repository node restart with the same persistent path', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const expected = record('a'.repeat(64))
  const first = await createJournalNode(directory)
  await first.context.recordJournal.accept(expected)
  await first.dispose()

  const second = await createJournalNode(directory)
  assert.deepEqual(await second.context.recordJournal.get(expected.id), expected)

  const replayed: JournalRecord[] = []
  for await (const item of second.context.recordJournal.iterateAccepted()) {
    replayed.push(item)
  }
  assert.deepEqual(replayed, [expected])

  await second.dispose()
})

test('is idempotent for concurrent equivalent Record acceptance', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await createJournalNode(directory)
  const expected = record('a'.repeat(64))

  await Promise.all([
    node.context.recordJournal.accept(expected),
    node.context.recordJournal.accept({
      data: { value: 'aaaa' },
      signature: expected.signature,
      createdAt: expected.createdAt,
      createdBy: expected.createdBy,
      pluginHash: expected.pluginHash,
      plugin: expected.plugin,
      id: expected.id,
    }),
  ])

  const replayed: JournalRecord[] = []
  for await (const item of node.context.recordJournal.iterateAccepted()) replayed.push(item)
  assert.equal(replayed.length, 1)
  assert.deepEqual(replayed[0], expected)

  await node.dispose()
})

test('rejects conflicting content under an existing RecordId without overwrite', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await createJournalNode(directory)
  const expected = record('a'.repeat(64))
  const conflicting = record(expected.id, { signature: 'd'.repeat(128) })

  await node.context.recordJournal.accept(expected)
  await assert.rejects(
    node.context.recordJournal.accept(conflicting),
    RecordJournalConflictError,
  )
  assert.deepEqual(await node.context.recordJournal.get(expected.id), expected)

  await node.dispose()
})

test('distinguishes missing Record from provider failure', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await createJournalNode(directory)
  await assert.rejects(
    node.context.recordJournal.get('a'.repeat(64)),
    RecordJournalNotFoundError,
  )
  await node.dispose()

  const blockedPath = join(directory, 'not-a-directory')
  await writeFile(blockedPath, 'file')
  const broken = await createJournalNode(blockedPath)
  await assert.rejects(
    broken.context.recordJournal.get('a'.repeat(64)),
    RecordJournalStorageError,
  )
  await broken.dispose()
})

test('detects corrupted persisted Record data', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await createJournalNode(directory)
  const expected = record('a'.repeat(64))
  await node.context.recordJournal.accept(expected)

  const files = (await readdir(directory)).filter((name) => name.endsWith('.record.json'))
  assert.equal(files.length, 1)
  await writeFile(join(directory, files[0]!), '{broken json', 'utf8')

  await assert.rejects(
    node.context.recordJournal.get(expected.id),
    RecordJournalCorruptionError,
  )

  await node.dispose()
})

test('replays accepted Records deterministically without assigning chain meaning to order', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await createJournalNode(directory)
  const laterName = record('b'.repeat(64))
  const earlierName = record('a'.repeat(64))

  await node.context.recordJournal.accept(laterName)
  await node.context.recordJournal.accept(earlierName)

  const ids: string[] = []
  for await (const item of node.context.recordJournal.iterateAccepted()) ids.push(item.id)

  assert.deepEqual(ids, [earlierName.id, laterName.id])
  await node.dispose()
})

test('empty journal replay yields no Records and does not claim chain state', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await createJournalNode(directory)
  const records: JournalRecord[] = []
  for await (const item of node.context.recordJournal.iterateAccepted()) records.push(item)

  assert.deepEqual(records, [])
  assert.equal('packed' in node.context.recordJournal, false)
  assert.equal('blockConfirmed' in node.context.recordJournal, false)

  await node.dispose()
})
