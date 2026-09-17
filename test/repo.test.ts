import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  BootstrapStartupError,
  CoreValidationConfigError,
  CoreValidationService,
  RecordJournalNotFoundError,
  RecordJournalService,
  RepoAlreadyEstablishedError,
  RepoIdentityError,
  RepoInvalidEstablishmentError,
  RepoNotFoundError,
  RepoService,
  createRepositoryNode,
  type CoreRecord,
  type CoreValidationConfig,
  type RepoServiceConfig,
} from '../src/index.ts'

const PROTOCOL = Object.freeze({
  plugin: 'repo.establishment@0.1.0',
  pluginHash: 'a'.repeat(64),
})

const REPO_CONFIG: RepoServiceConfig = Object.freeze({
  establishmentProtocol: PROTOCOL,
})

// These fixtures only stand in for already-Core-validated identities. The test
// provider deliberately does not reimplement Base58 or Ed25519 algorithms.
const WORKER_A = '11111111111111111111111111111111'
const WORKER_B = '11111111111111111111111111111112'
const REPO_A = '11111111111111111111111111111113'
const REPO_B = '11111111111111111111111111111114'
const VALID_IDENTITIES = new Set([WORKER_A, WORKER_B, REPO_A, REPO_B])

function establishmentRecord(
  idChar: string,
  repo: string,
  createdBy = WORKER_A,
  overrides: Partial<CoreRecord> = {},
): CoreRecord {
  const id = idChar.repeat(64)
  return {
    id,
    plugin: PROTOCOL.plugin,
    pluginHash: PROTOCOL.pluginHash,
    createdBy,
    createdAt: '2026-09-17T05:00:00Z',
    signature: 'c'.repeat(128),
    data: { repo },
    ...overrides,
  }
}

function fakeCoreValidation(): CoreValidationConfig {
  return {
    validateRecord(value: unknown): CoreRecord {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('not a Core Record')
      }

      const record = value as Partial<CoreRecord>
      if (
        typeof record.id !== 'string'
        || typeof record.plugin !== 'string'
        || typeof record.pluginHash !== 'string'
        || typeof record.createdBy !== 'string'
        || typeof record.createdAt !== 'string'
        || typeof record.signature !== 'string'
        || !('data' in record)
      ) {
        throw new Error('incomplete Core Record')
      }
      if (!VALID_IDENTITIES.has(record.createdBy)) {
        throw new Error('invalid createdBy')
      }

      return value as CoreRecord
    },

    verifyRecordSignature(record: CoreRecord): boolean {
      return record.signature === 'c'.repeat(128)
    },

    validateEntityPublicKey(value: unknown): string {
      if (typeof value !== 'string' || !VALID_IDENTITIES.has(value)) {
        throw new Error('invalid EntityPublicKey')
      }
      return value
    },
  }
}

async function tempJournalDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'labourchain-repo-story-'))
}

async function fullNode(directory: string) {
  return createRepositoryNode({
    // Mount the consumer first to exercise Cordis dependency waiting rather
    // than relying on hand-authored plugin order.
    plugins: [
      { plugin: RepoService, config: REPO_CONFIG },
      { plugin: RecordJournalService, config: { directory } },
      { plugin: CoreValidationService, config: fakeCoreValidation() },
    ],
  })
}

async function journalOnlyNode(directory: string) {
  return createRepositoryNode({
    plugins: [{ plugin: RecordJournalService, config: { directory } }],
  })
}

test('establishes a Repo from a signed Record and derives operator from createdBy', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await fullNode(directory)
  const record = establishmentRecord('1', REPO_A, WORKER_A)

  const repo = await node.context.repo.establishRepo(record)
  assert.deepEqual(repo, {
    repo: REPO_A,
    operator: WORKER_A,
    establishmentRecordId: record.id,
  })
  assert.deepEqual(await node.context.recordJournal.get(record.id), record)
  assert.equal('packed' in repo, false)
  assert.equal('blockConfirmed' in repo, false)

  await node.dispose()
})

test('loads the same Repo after restart by rebuilding the derived index from the journal', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const record = establishmentRecord('1', REPO_A, WORKER_A)
  const first = await fullNode(directory)
  await first.context.repo.establishRepo(record)
  await first.dispose()

  const second = await fullNode(directory)
  assert.deepEqual(await second.context.repo.loadRepo(REPO_A), {
    repo: REPO_A,
    operator: WORKER_A,
    establishmentRecordId: record.id,
  })
  await second.dispose()
})

test('re-establishing the exact same Record is idempotent', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await fullNode(directory)
  const record = establishmentRecord('1', REPO_A)

  const first = await node.context.repo.establishRepo(record)
  const second = await node.context.repo.establishRepo({
    data: { repo: REPO_A },
    signature: record.signature,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    pluginHash: record.pluginHash,
    plugin: record.plugin,
    id: record.id,
  })

  assert.deepEqual(second, first)
  const accepted: CoreRecord[] = []
  for await (const item of node.context.recordJournal.iterateAccepted()) {
    accepted.push(item as CoreRecord)
  }
  assert.equal(accepted.length, 1)

  await node.dispose()
})

test('rejects a conflicting second establishment and does not journal the replacement', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await fullNode(directory)
  const first = establishmentRecord('1', REPO_A, WORKER_A)
  const replacement = establishmentRecord('2', REPO_A, WORKER_B)

  await node.context.repo.establishRepo(first)
  await assert.rejects(
    node.context.repo.establishRepo(replacement),
    RepoAlreadyEstablishedError,
  )
  await assert.rejects(
    node.context.recordJournal.get(replacement.id),
    RecordJournalNotFoundError,
  )
  assert.equal((await node.context.repo.loadRepo(REPO_A)).operator, WORKER_A)

  await node.dispose()
})

test('serializes concurrent conflicting establishments for one Repo identity', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await fullNode(directory)
  const first = establishmentRecord('1', REPO_A, WORKER_A)
  const second = establishmentRecord('2', REPO_A, WORKER_B)

  const results = await Promise.allSettled([
    node.context.repo.establishRepo(first),
    node.context.repo.establishRepo(second),
  ])

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  const rejected = results.find((result) => result.status === 'rejected')
  assert.ok(rejected && rejected.status === 'rejected')
  assert.ok(rejected.reason instanceof RepoAlreadyEstablishedError)

  const accepted: CoreRecord[] = []
  for await (const item of node.context.recordJournal.iterateAccepted()) accepted.push(item as CoreRecord)
  assert.equal(accepted.length, 1)

  await node.dispose()
})

test('a stale index miss cannot authorize replacement of a durable establishment', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await fullNode(directory)

  // Build an empty in-memory index first.
  await assert.rejects(node.context.repo.loadRepo(REPO_A), RepoNotFoundError)

  // Simulate another Runtime path durably accepting a valid establishment
  // after that index snapshot was built.
  const durable = establishmentRecord('1', REPO_A, WORKER_A)
  await node.context.recordJournal.accept(durable)

  const replacement = establishmentRecord('2', REPO_A, WORKER_B)
  await assert.rejects(
    node.context.repo.establishRepo(replacement),
    RepoAlreadyEstablishedError,
  )
  assert.deepEqual(await node.context.repo.loadRepo(REPO_A), {
    repo: REPO_A,
    operator: WORKER_A,
    establishmentRecordId: durable.id,
  })

  await node.dispose()
})

test('load refreshes a stale derived index before reporting Repo not found', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await fullNode(directory)
  await assert.rejects(node.context.repo.loadRepo(REPO_B), RepoNotFoundError)

  const durable = establishmentRecord('3', REPO_B, WORKER_B)
  await node.context.recordJournal.accept(durable)

  assert.deepEqual(await node.context.repo.loadRepo(REPO_B), {
    repo: REPO_B,
    operator: WORKER_B,
    establishmentRecordId: durable.id,
  })
  await node.dispose()
})

test('ignores unrelated journal Records during Repo index rebuild', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const journalNode = await journalOnlyNode(directory)
  await journalNode.context.recordJournal.accept({
    ...establishmentRecord('4', REPO_B),
    plugin: 'work.record@0.1.0',
    pluginHash: 'b'.repeat(64),
    data: { some: 'other fact' },
  })
  await journalNode.dispose()

  const node = await fullNode(directory)
  await assert.rejects(node.context.repo.loadRepo(REPO_B), RepoNotFoundError)
  await node.dispose()
})

test('fails closed when durable journal contains two establishments for one Repo', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const journalNode = await journalOnlyNode(directory)
  await journalNode.context.recordJournal.accept(establishmentRecord('1', REPO_A, WORKER_A))
  await journalNode.context.recordJournal.accept(establishmentRecord('2', REPO_A, WORKER_B))
  await journalNode.dispose()

  const node = await fullNode(directory)
  await assert.rejects(
    node.context.repo.loadRepo(REPO_A),
    RepoAlreadyEstablishedError,
  )
  await node.dispose()
})

test('rejects malformed establishment Records through domain and Core seams', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await fullNode(directory)
  const valid = establishmentRecord('1', REPO_A)

  await assert.rejects(
    node.context.repo.establishRepo(null),
    RepoInvalidEstablishmentError,
  )
  await assert.rejects(
    node.context.repo.establishRepo({ ...valid, pluginHash: 'b'.repeat(64) }),
    RepoInvalidEstablishmentError,
  )
  await assert.rejects(
    node.context.repo.establishRepo({ ...valid, signature: 'd'.repeat(128) }),
    RepoInvalidEstablishmentError,
  )
  await assert.rejects(
    node.context.repo.establishRepo({ ...valid, data: { repo: REPO_A, operator: WORKER_B } }),
    RepoInvalidEstablishmentError,
  )
  await assert.rejects(
    node.context.repo.establishRepo({ ...valid, data: { repo: 'not-a-valid-key' } }),
    RepoInvalidEstablishmentError,
  )

  await node.dispose()
})

test('rejects invalid load identity and never implicitly creates a Repo', async (t) => {
  const directory = await tempJournalDir()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const node = await fullNode(directory)
  await assert.rejects(node.context.repo.loadRepo('invalid-key'), RepoIdentityError)
  await assert.rejects(node.context.repo.loadRepo(REPO_A), RepoNotFoundError)

  const accepted: CoreRecord[] = []
  for await (const item of node.context.recordJournal.iterateAccepted()) accepted.push(item as CoreRecord)
  assert.deepEqual(accepted, [])
  await node.dispose()
})

test('Repo service waits for required Core validation and journal services', async () => {
  await assert.rejects(
    createRepositoryNode({
      plugins: [{ plugin: RepoService, config: REPO_CONFIG }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof BootstrapStartupError)
      assert.match(String(error.cause), /coreValidation|recordJournal/u)
      return true
    },
  )
})

test('Core validation seam fails closed when required callbacks are absent', async () => {
  await assert.rejects(
    createRepositoryNode({
      plugins: [{
        plugin: CoreValidationService,
        config: { validateRecord: fakeCoreValidation().validateRecord },
      }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof BootstrapStartupError)
      assert.ok(error.cause instanceof CoreValidationConfigError)
      return true
    },
  )
})
