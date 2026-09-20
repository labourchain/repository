import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setImmediate as delayImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import {
  RecordJournalService,
  createRepositoryNode,
  runtimeRecordDatabasePlugin,
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
        { plugin: runtimeRecordDatabasePlugin },
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
      database.replaceState('test', Object.freeze({ recordId: inside.id }))
    })

    await outsideWrite
    assert.deepEqual(await node.context.recordJournal.get(inside.id), inside)
    assert.deepEqual(await node.context.recordJournal.get(outside.id), outside)

    await node.dispose()
  })
})

test('Runtime Record database commits namespaced state only on success', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({
      plugins: [
        { plugin: runtimeRecordDatabasePlugin },
        { plugin: RecordJournalService, config: { directory } },
      ],
    })

    await node.context.runtimeRecordDatabase.runExclusive(async (database) => {
      database.replaceState('membership', Object.freeze({ value: 'stable' }))
    })

    await assert.rejects(
      node.context.runtimeRecordDatabase.runExclusive(async (database) => {
        database.replaceState('membership', Object.freeze({ value: 'discard' }))
        throw new Error('abort')
      }),
      /abort/,
    )

    await node.context.runtimeRecordDatabase.runExclusive(async (database) => {
      assert.deepEqual(
        database.getState<{ readonly value: string }>('membership'),
        { value: 'stable' },
      )
    })

    await node.dispose()
  })
})
