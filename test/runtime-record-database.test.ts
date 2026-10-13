import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setImmediate as delayImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import {
  RecordJournalNotFoundError,
  RecordJournalService,
  RuntimeRecordDatabaseNotFoundError,
  createRepositoryNode,
  journalRecordDatabasePlugin,
  type JournalRecord,
} from '../src/index.ts'

async function withDirectory<T>(
  run: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'labourchain-runtime-db-test-'))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function record(id: string): JournalRecord {
  return { id }
}

test('Runtime Record database shares the journal mutation gate', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({
      plugins: [
        { plugin: journalRecordDatabasePlugin },
        { plugin: RecordJournalService, config: { directory } },
      ],
    })

    const inside = record('inside')
    const outside = record('outside')
    let outsideSettled = false
    let outsideWrite: Promise<void> | undefined

    await node.context.runtimeRecordDatabase.runExclusive(async (database) => {
      outsideWrite = node.context.recordJournal.accept(outside).then(() => {
        outsideSettled = true
      })

      await delayImmediate()
      assert.equal(outsideSettled, false)

      await database.accept(inside)
    })

    await outsideWrite
    assert.deepEqual(await node.context.recordJournal.get(inside.id), inside)
    assert.deepEqual(await node.context.recordJournal.get(outside.id), outside)

    await node.dispose()
  })
})

test('journal adapter translates missing RecordId to the shared DB error', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({
      plugins: [
        { plugin: journalRecordDatabasePlugin },
        { plugin: RecordJournalService, config: { directory } },
      ],
    })
    try {
      await assert.rejects(
        node.context.runtimeRecordDatabase.get('missing'),
        RuntimeRecordDatabaseNotFoundError,
      )
      await assert.rejects(
        node.context.runtimeRecordDatabase.runExclusive(
          async (database) => database.get('missing'),
        ),
        RuntimeRecordDatabaseNotFoundError,
      )
      await assert.rejects(
        node.context.recordJournal.get('missing'),
        RecordJournalNotFoundError,
      )
    } finally {
      await node.dispose()
    }
  })
})
