import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { plugin as assetContentPlugin } from '../src/protocols/asset.content.ts'
import { plugin as labourRecordPlugin } from '../src/protocols/labour.record.ts'
import { plugin as memberIdentityPlugin } from '../src/protocols/member.identity.ts'
import { plugin as repoContributionPlugin } from '../src/protocols/repo.contribution.ts'
import { plugin as repoEstablishmentPlugin } from '../src/protocols/repo.establishment.ts'
import {
  ASSET_CONTENT_PROTOCOL_REFERENCE,
  CONTRIBUTION_STAGING_SERVICE,
  ASSET_CONTENT_PROTOCOL_SERVICE,
  ASSET_STORAGE_SERVICE,
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  LABOUR_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  PROTOCOL_RESOLUTION_SERVICE,
  REPOSITORY_CONTRIBUTION_SERVICE,
  REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE,
  REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
  REPO_CONTRIBUTION_PROTOCOL_SERVICE,
  REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  AssetNotFoundError,
  ContributionStagingStorageError,
  InvalidAsset,
  ProtocolBuildConflictError,
  RecordJournalConflictError,
  RecordJournalInputError,
  RecordJournalNotFoundError,
  RecordJournalPublicationError,
  RecordJournalService,
  RepositoryContributionAssetMismatchError,
  RepositoryContributionConflictError,
  RepositoryContributionProtocolError,
  assetStoragePlugin,
  contributionStagingPlugin,
  createRepositoryNode,
  repositoryContributionPlugin,
  repositoryContributionRecoveryPlugin,
  runtimeRecordDatabasePlugin,
  type Asset,
  type CoreRecordProtocolService,
  type CoreRecordValue,
  type RuntimeRecordDatabaseSession,
} from '../src/index.ts'
import {
  RECORD_JOURNAL_INTERNAL_RUN_EXCLUSIVE,
  RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE,
} from '../src/internal-publication.ts'

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const MEMBER_PROTOCOL_HASH = digest('test/member.identity')
const REPO_PROTOCOL_HASH = digest('test/repo.establishment')
const LABOUR_PROTOCOL_HASH = digest('test/labour.record')
const ASSET_PROTOCOL_HASH = digest('test/asset.content')
const CONTRIBUTION_PROTOCOL_HASH = digest('test/repo.contribution')
const CONTRIBUTION_PROTOCOL_HASH_2 = digest(
  'test/repo.contribution/independent-build',
)

const MEMBER_KEY = 'member-key'
const REPO_KEY = 'repo-key'
const SECOND_REPO_KEY = 'repo-key-2'
const OPERATOR_KEY = 'operator-key'
const SECOND_OPERATOR_KEY = 'operator-key-2'

const VALID_KEYS = new Set([
  MEMBER_KEY,
  REPO_KEY,
  SECOND_REPO_KEY,
  OPERATOR_KEY,
  SECOND_OPERATOR_KEY,
])

function validateTestEntityPublicKey(value: unknown): string {
  if (typeof value !== 'string' || !VALID_KEYS.has(value)) {
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
      const data = value as Record<string, unknown>
      return { publicKey: validateTestEntityPublicKey(data.publicKey) }
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
    const record = value as Partial<CoreRecordValue>
    return record.signature === 'sig:' + record.createdBy
  },
}

function coreRecordProvider(ctx: Context) {
  ctx.provide(CORE_RECORD_PROTOCOL_SERVICE, coreRecordService)
}

function exactResolutionProvider(
  contributionHash = CONTRIBUTION_PROTOCOL_HASH,
) {
  return function provideExactResolution(ctx: Context) {
    const service = {
      async resolve(reference: string, protocolHash: string) {
        if (
          reference === ASSET_CONTENT_PROTOCOL_REFERENCE &&
          protocolHash === ASSET_PROTOCOL_HASH
        ) {
          return {
            protocolHash,
            reference,
            service: ASSET_CONTENT_PROTOCOL_SERVICE,
          }
        }
        if (
          reference === LABOUR_RECORD_PROTOCOL_REFERENCE &&
          protocolHash === LABOUR_PROTOCOL_HASH
        ) {
          return {
            protocolHash,
            reference,
            service: LABOUR_RECORD_PROTOCOL_SERVICE,
          }
        }
        if (
          reference === REPO_CONTRIBUTION_PROTOCOL_REFERENCE &&
          protocolHash === contributionHash
        ) {
          return {
            protocolHash,
            reference,
            service: REPO_CONTRIBUTION_PROTOCOL_SERVICE,
          }
        }
        throw new Error('unexpected exact Protocol resolution')
      },
      async withExactService(
        reference: string,
        protocolHash: string,
        operation: (value: unknown) => unknown | Promise<unknown>,
      ) {
        const resolved = await service.resolve(reference, protocolHash)
        const value = ctx.get(resolved.service)
        if (value === undefined) {
          throw new Error('resolved Protocol service is unavailable')
        }
        return operation(value)
      },
    }
    ctx.provide(PROTOCOL_RESOLUTION_SERVICE, service as never)
  }
}

function memberRecord(): CoreRecordValue {
  return {
    id: 'member-declaration',
    protocol: MEMBER_PROTOCOL_REFERENCE,
    protocolHash: MEMBER_PROTOCOL_HASH,
    createdBy: MEMBER_KEY,
    createdAt: '2026-10-04T00:00:00Z',
    signature: 'sig:' + MEMBER_KEY,
    data: {},
  }
}

function repoRecord(
  id = 'repo-establishment',
  repoIdentity = REPO_KEY,
): CoreRecordValue {
  return {
    id,
    protocol: REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
    protocolHash: REPO_PROTOCOL_HASH,
    createdBy: MEMBER_KEY,
    createdAt: '2026-10-04T00:00:01Z',
    signature: 'sig:' + MEMBER_KEY,
    data: { publicKey: repoIdentity },
  }
}

function labourRecord(
  id: string,
  references: readonly string[],
  assets: readonly string[],
  overrides: Partial<CoreRecordValue> = {},
): CoreRecordValue {
  return {
    id,
    protocol: LABOUR_RECORD_PROTOCOL_REFERENCE,
    protocolHash: LABOUR_PROTOCOL_HASH,
    createdBy: MEMBER_KEY,
    createdAt: '2026-10-04T00:01:00Z',
    signature: 'sig:' + MEMBER_KEY,
    data: {
      content: '提交一个实际劳动结果',
      duration: 1,
      references,
      assets,
    },
    ...overrides,
  }
}

function acceptanceRecord(
  id: string,
  repoIdentity: string,
  labourRecordId: string,
  assetId: string,
  operator = OPERATOR_KEY,
  overrides: Partial<CoreRecordValue> = {},
): CoreRecordValue {
  return {
    id,
    protocol: REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
    protocolHash: CONTRIBUTION_PROTOCOL_HASH,
    createdBy: repoIdentity,
    createdAt: '2026-10-04T00:02:00Z',
    signature: 'sig:' + repoIdentity,
    data: { labourRecordId, assetId, operator },
    ...overrides,
  }
}

async function withRoot<T>(run: (root: string) => Promise<T>) {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-contribution-'))
  try {
    return await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

function composition(
  root: string,
  contributionHash = CONTRIBUTION_PROTOCOL_HASH,
) {
  return [
    { plugin: repositoryContributionRecoveryPlugin },
    {
      plugin: contributionStagingPlugin,
      config: { directory: join(root, 'staging') },
    },
    { plugin: repositoryContributionPlugin },
    { plugin: assetStoragePlugin, config: { directory: join(root, 'assets') } },
    {
      plugin: repoContributionPlugin,
      config: { protocolHash: contributionHash },
    },
    {
      plugin: assetContentPlugin,
      config: { protocolHash: ASSET_PROTOCOL_HASH },
    },
    {
      plugin: labourRecordPlugin,
      config: { protocolHash: LABOUR_PROTOCOL_HASH },
    },
    {
      plugin: repoEstablishmentPlugin,
      config: { protocolHash: REPO_PROTOCOL_HASH },
    },
    {
      plugin: memberIdentityPlugin,
      config: { protocolHash: MEMBER_PROTOCOL_HASH },
    },
    { plugin: exactResolutionProvider(contributionHash) },
    { plugin: coreEntityProvider },
    { plugin: coreRecordProvider },
    { plugin: runtimeRecordDatabasePlugin },
    {
      plugin: RecordJournalService,
      config: { directory: join(root, 'journal') },
    },
  ]
}

async function createNode(
  root: string,
  contributionHash = CONTRIBUTION_PROTOCOL_HASH,
) {
  return createRepositoryNode({
    plugins: composition(root, contributionHash),
  })
}

async function establishBase(
  node: Awaited<ReturnType<typeof createRepositoryNode>>,
  includeSecondRepo = false,
) {
  await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(memberRecord())
  await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(
    repoRecord(),
  )
  if (includeSecondRepo) {
    await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(
      repoRecord('repo-establishment-2', SECOND_REPO_KEY),
    )
  }
}

function createAsset(
  node: Awaited<ReturnType<typeof createRepositoryNode>>,
  content: string,
): Asset {
  return node.context[ASSET_CONTENT_PROTOCOL_SERVICE].createAsset(
    Buffer.from(content, 'utf8'),
  )
}

async function assertRecordMissing(
  node: Awaited<ReturnType<typeof createRepositoryNode>>,
  recordId: string,
) {
  await assert.rejects(
    node.context.recordJournal.get(recordId),
    RecordJournalNotFoundError,
  )
}

async function acceptedContributions(
  node: Awaited<ReturnType<typeof createRepositoryNode>>,
): Promise<CoreRecordValue[]> {
  const records: CoreRecordValue[] = []
  for await (const record of node.context.recordJournal.iterateAccepted()) {
    const candidate = record as Partial<CoreRecordValue>
    if (
      candidate.protocol === REPO_CONTRIBUTION_PROTOCOL_REFERENCE &&
      candidate.protocolHash === CONTRIBUTION_PROTOCOL_HASH
    ) {
      records.push(record as CoreRecordValue)
    }
  }
  return records
}

async function stagedAcceptanceIds(
  node: Awaited<ReturnType<typeof createRepositoryNode>>,
): Promise<string[]> {
  const ids: string[] = []
  for await (
    const request of node.context[
      CONTRIBUTION_STAGING_SERVICE
    ].iterateStaged()
  ) {
    ids.push(request.acceptanceRecord.id)
  }
  return ids
}

test('commits A -> L -> D and does not require references-only Asset durability', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const upstream = createAsset(node, 'upstream reference only')
    const selected = createAsset(node, 'selected durable result')
    const labour = labourRecord(
      'labour-happy',
      [upstream.id],
      [selected.id],
    )
    const acceptance = acceptanceRecord(
      'acceptance-happy',
      REPO_KEY,
      labour.id,
      selected.id,
    )

    assert.equal(
      await node.context[ASSET_STORAGE_SERVICE].has(upstream.id),
      false,
    )

    const result = await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    })

    assert.deepEqual(result, {
      status: 'COMMITTED',
      recordId: acceptance.id,
      repoIdentity: REPO_KEY,
      labourRecordId: labour.id,
      assetId: selected.id,
      operator: OPERATOR_KEY,
      contributor: MEMBER_KEY,
    })
    assert.equal('blockConfirmed' in result, false)
    assert.equal('chainStatus' in result, false)

    assert.deepEqual(
      await node.context[ASSET_STORAGE_SERVICE].get(selected.id),
      selected,
    )
    assert.deepEqual(
      await node.context.recordJournal.get(labour.id),
      labour,
    )
    assert.deepEqual(
      await node.context.recordJournal.get(acceptance.id),
      acceptance,
    )
    assert.equal(
      await node.context[ASSET_STORAGE_SERVICE].has(upstream.id),
      false,
    )

    await node.dispose()
  })
})

test('unchanged maintenance preserves an Asset that is both referenced and returned', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'maintained asset')
    const labour = labourRecord(
      'labour-maintenance',
      [selected.id],
      [selected.id],
    )
    const acceptance = acceptanceRecord(
      'acceptance-maintenance',
      REPO_KEY,
      labour.id,
      selected.id,
    )

    assert.equal(
      await node.context[ASSET_STORAGE_SERVICE].has(selected.id),
      false,
    )

    const result = await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    })

    assert.equal(result.status, 'COMMITTED')
    assert.equal(
      await node.context[ASSET_STORAGE_SERVICE].has(selected.id),
      true,
    )
    await node.dispose()
  })
})

test('exact request replay is idempotent', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'idempotent')
    const labour = labourRecord('labour-replay', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-replay',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const request = {
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    }

    const first = await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit(
      request,
    )
    const second = await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit(
      request,
    )

    assert.deepEqual(second, first)
    assert.equal((await acceptedContributions(node)).length, 1)
    await node.dispose()
  })
})

test('exact replay validates incoming Asset before durable lookup and preserves committed facts', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'validated replay')
    const labour = labourRecord('labour-validated-replay', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-validated-replay',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const request = {
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    }
    const committed = await node.context[
      REPOSITORY_CONTRIBUTION_SERVICE
    ].commit(request)

    const storage = node.context[ASSET_STORAGE_SERVICE]
    const originalGet = storage.get.bind(storage)
    let getCalls = 0
    storage.get = async (assetId) => {
      getCalls += 1
      return originalGet(assetId)
    }

    const malformed = {
      ...selected,
      content: Buffer.from('tampered replay content', 'utf8'),
    }

    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        ...request,
        asset: malformed,
      }),
      InvalidAsset,
    )
    assert.equal(getCalls, 0)

    assert.deepEqual(await originalGet(selected.id), selected)
    assert.deepEqual(
      await node.context.recordJournal.get(labour.id),
      labour,
    )
    assert.deepEqual(
      await node.context.recordJournal.get(acceptance.id),
      acceptance,
    )

    assert.deepEqual(
      await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit(request),
      committed,
    )
    assert.equal(getCalls, 1)
    assert.equal((await acceptedContributions(node)).length, 1)

    await node.dispose()
  })
})

test('exact replay does not repair an unavailable durable Asset', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'missing replay asset')
    const labour = labourRecord('labour-missing-replay-asset', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-missing-replay-asset',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const request = {
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    }
    const committed = await node.context[
      REPOSITORY_CONTRIBUTION_SERVICE
    ].commit(request)

    const storage = node.context[ASSET_STORAGE_SERVICE]
    const originalGet = storage.get.bind(storage)
    const originalPreserve = storage.preserve.bind(storage)
    let preserveCalls = 0
    storage.get = async (assetId) => {
      if (assetId === selected.id) {
        throw new AssetNotFoundError(assetId)
      }
      return originalGet(assetId)
    }
    storage.preserve = async (asset) => {
      preserveCalls += 1
      return originalPreserve(asset)
    }

    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit(request),
      AssetNotFoundError,
    )
    assert.equal(preserveCalls, 0)

    storage.get = originalGet
    storage.preserve = originalPreserve
    assert.deepEqual(
      await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit(request),
      committed,
    )
    assert.equal((await acceptedContributions(node)).length, 1)

    await node.dispose()
  })
})

test('restart reconstructs exact replay from durable A/L/D and preserves conflict detection', async () => {
  await withRoot(async (root) => {
    const first = await createNode(root)
    await establishBase(first)

    const selected = createAsset(first, 'restart durable result')
    const labour = labourRecord('labour-restart', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-restart',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const request = {
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    }

    const committed = await first.context[
      REPOSITORY_CONTRIBUTION_SERVICE
    ].commit(request)
    await first.dispose()

    const second = await createNode(root)
    assert.deepEqual(
      await second.context[REPOSITORY_CONTRIBUTION_SERVICE].commit(request),
      committed,
    )

    const conflicting = acceptanceRecord(
      'acceptance-restart-conflict',
      REPO_KEY,
      labour.id,
      selected.id,
      SECOND_OPERATOR_KEY,
    )
    await assert.rejects(
      second.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: selected,
        labourRecord: labour,
        acceptanceRecord: conflicting,
      }),
      RepositoryContributionConflictError,
    )
    await assertRecordMissing(second, conflicting.id)
    assert.equal((await acceptedContributions(second)).length, 1)
    await second.dispose()
  })
})

test('fresh same-reference different-build runtime fails closed on durable H1 acceptance', async () => {
  await withRoot(async (root) => {
    const first = await createNode(root)
    await establishBase(first)

    const selected = createAsset(first, 'cross-build durable result')
    const labour = labourRecord('labour-cross-build', [], [selected.id])
    const acceptedH1 = acceptanceRecord(
      'acceptance-cross-build-h1',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    await first.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptedH1,
    })
    await first.dispose()

    const second = await createNode(root, CONTRIBUTION_PROTOCOL_HASH_2)
    await establishBase(second)
    const candidateH2 = acceptanceRecord(
      'acceptance-cross-build-h2',
      REPO_KEY,
      labour.id,
      selected.id,
      SECOND_OPERATOR_KEY,
      { protocolHash: CONTRIBUTION_PROTOCOL_HASH_2 },
    )

    await assert.rejects(
      second.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: selected,
        labourRecord: labour,
        acceptanceRecord: candidateH2,
      }),
      ProtocolBuildConflictError,
    )
    await assertRecordMissing(second, candidateH2.id)
    assert.deepEqual(
      await second.context.recordJournal.get(acceptedH1.id),
      acceptedH1,
    )

    await second.dispose()
  })
})

test('same-reference durable acceptance with malformed ProtocolHash fails explicitly', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'malformed durable hash')
    const labour = labourRecord(
      'labour-malformed-durable-hash',
      [],
      [selected.id],
    )
    const malformed = acceptanceRecord(
      'acceptance-malformed-durable-hash',
      REPO_KEY,
      labour.id,
      selected.id,
      OPERATOR_KEY,
      { protocolHash: 'malformed-hash' },
    )
    await node.context.recordJournal[
      RECORD_JOURNAL_INTERNAL_RUN_EXCLUSIVE
    ]((journal) => journal.accept(malformed))

    const candidate = acceptanceRecord(
      'acceptance-after-malformed-durable-hash',
      REPO_KEY,
      labour.id,
      selected.id,
      SECOND_OPERATOR_KEY,
    )
    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: selected,
        labourRecord: labour,
        acceptanceRecord: candidate,
      }),
      RepositoryContributionProtocolError,
    )
    await assertRecordMissing(node, candidate.id)

    await node.dispose()
  })
})

test('public generic ingress cannot publish repo.contribution directly', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'guarded publication')
    const labour = labourRecord(
      'labour-guarded-publication',
      [],
      [selected.id],
    )
    const acceptance = acceptanceRecord(
      'acceptance-guarded-publication',
      REPO_KEY,
      labour.id,
      selected.id,
    )

    await assert.rejects(
      node.context.recordJournal.accept(acceptance),
      RecordJournalPublicationError,
    )
    await assert.rejects(
      node.context.recordJournal.runExclusive(
        (journal) => journal.accept(acceptance),
      ),
      RecordJournalPublicationError,
    )
    await assert.rejects(
      node.context.runtimeRecordDatabase.runExclusive(
        (database) => database.accept(acceptance),
      ),
      RecordJournalPublicationError,
    )
    await assertRecordMissing(node, acceptance.id)

    const generic = { id: 'generic-record-ingress' }
    await node.context.runtimeRecordDatabase.runExclusive(
      (database) => database.accept(generic),
    )
    assert.deepEqual(
      await node.context.recordJournal.get(generic.id),
      generic,
    )

    assert.equal(
      (
        await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
          asset: selected,
          labourRecord: labour,
          acceptanceRecord: acceptance,
        })
      ).status,
      'COMMITTED',
    )
    assert.deepEqual(
      await node.context.recordJournal.get(acceptance.id),
      acceptance,
    )

    await node.dispose()
  })
})

test('public publication guard classifies the one durable JSON snapshot', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)

    let directSerializations = 0
    const disguisedDirect = {
      id: 'snapshot-protected-direct',
      protocol: 'repo.test@0.1.0',
      toJSON() {
        directSerializations += 1
        return {
          id: this.id,
          protocol: REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
        }
      },
    }

    await assert.rejects(
      node.context.recordJournal.accept(disguisedDirect),
      RecordJournalPublicationError,
    )
    assert.equal(directSerializations, 1)
    await assertRecordMissing(node, disguisedDirect.id)

    let databaseSerializations = 0
    const disguisedDatabase = {
      id: 'snapshot-protected-database',
      protocol: 'repo.test@0.1.0',
      toJSON() {
        databaseSerializations += 1
        return {
          id: this.id,
          protocol: REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
        }
      },
    }

    await assert.rejects(
      node.context.runtimeRecordDatabase.runExclusive(
        (database) => database.accept(disguisedDatabase),
      ),
      RecordJournalPublicationError,
    )
    assert.equal(databaseSerializations, 1)
    await assertRecordMissing(node, disguisedDatabase.id)

    let protocolReads = 0
    const getterRecord = {
      id: 'snapshot-getter-record',
      get protocol() {
        protocolReads += 1
        return protocolReads === 1
          ? 'repo.test@0.1.0'
          : REPO_CONTRIBUTION_PROTOCOL_REFERENCE
      },
    }

    await node.context.recordJournal.accept(getterRecord)
    assert.equal(protocolReads, 1)
    assert.deepEqual(
      await node.context.recordJournal.get(getterRecord.id),
      {
        id: getterRecord.id,
        protocol: 'repo.test@0.1.0',
      },
    )

    let genericSerializations = 0
    const genericRecord = {
      id: 'snapshot-generic-record',
      toJSON() {
        genericSerializations += 1
        return {
          id: this.id,
          protocol: 'repo.test@0.1.0',
          data: { serialization: genericSerializations },
        }
      },
    }
    await node.context.recordJournal.accept(genericRecord)
    assert.equal(genericSerializations, 1)
    assert.deepEqual(
      await node.context.recordJournal.get(genericRecord.id),
      {
        id: genericRecord.id,
        protocol: 'repo.test@0.1.0',
        data: { serialization: 1 },
      },
    )

    const changedId = {
      id: 'snapshot-live-id',
      toJSON() {
        return { id: 'snapshot-durable-id' }
      },
    }
    await assert.rejects(
      node.context.recordJournal.accept(changedId),
      RecordJournalInputError,
    )
    await assertRecordMissing(node, changedId.id)
    await assertRecordMissing(node, 'snapshot-durable-id')

    await node.dispose()
  })
})

test('distinct same-key acceptance conflicts while different logical keys remain independent', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node, true)

    const firstAsset = createAsset(node, 'result-one')
    const secondAsset = createAsset(node, 'result-two')
    const labour = labourRecord(
      'labour-multi',
      [],
      [firstAsset.id, secondAsset.id],
    )

    const first = acceptanceRecord(
      'acceptance-first',
      REPO_KEY,
      labour.id,
      firstAsset.id,
    )
    await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
      asset: firstAsset,
      labourRecord: labour,
      acceptanceRecord: first,
    })

    const conflicting = acceptanceRecord(
      'acceptance-conflict',
      REPO_KEY,
      labour.id,
      firstAsset.id,
      SECOND_OPERATOR_KEY,
    )
    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: firstAsset,
        labourRecord: labour,
        acceptanceRecord: conflicting,
      }),
      RepositoryContributionConflictError,
    )

    const otherAsset = acceptanceRecord(
      'acceptance-other-asset',
      REPO_KEY,
      labour.id,
      secondAsset.id,
    )
    assert.equal(
      (
        await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
          asset: secondAsset,
          labourRecord: labour,
          acceptanceRecord: otherAsset,
        })
      ).status,
      'COMMITTED',
    )

    const otherRepo = acceptanceRecord(
      'acceptance-other-repo',
      SECOND_REPO_KEY,
      labour.id,
      firstAsset.id,
    )
    assert.equal(
      (
        await node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
          asset: firstAsset,
          labourRecord: labour,
          acceptanceRecord: otherRepo,
        })
      ).status,
      'COMMITTED',
    )

    assert.equal((await acceptedContributions(node)).length, 3)
    await node.dispose()
  })
})

test('concurrent exact replay converges through the real Runtime Record database gate', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'concurrent exact')
    const labour = labourRecord('labour-concurrent-exact', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-concurrent-exact',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const request = {
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    }

    const results = await Promise.all([
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit(request),
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit(request),
    ])

    assert.equal(results[0]!.status, 'COMMITTED')
    assert.deepEqual(results[1], results[0])
    assert.equal((await acceptedContributions(node)).length, 1)
    await node.dispose()
  })
})

test('concurrent distinct same-key acceptances allow exactly one durable D', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'concurrent conflict')
    const labour = labourRecord('labour-concurrent-conflict', [], [selected.id])
    const first = acceptanceRecord(
      'acceptance-race-1',
      REPO_KEY,
      labour.id,
      selected.id,
      OPERATOR_KEY,
    )
    const second = acceptanceRecord(
      'acceptance-race-2',
      REPO_KEY,
      labour.id,
      selected.id,
      SECOND_OPERATOR_KEY,
    )

    const results = await Promise.allSettled([
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: selected,
        labourRecord: labour,
        acceptanceRecord: first,
      }),
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: selected,
        labourRecord: labour,
        acceptanceRecord: second,
      }),
    ])

    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    )
    const rejected = results.find((result) => result.status === 'rejected')
    assert.ok(rejected && rejected.status === 'rejected')
    assert.ok(rejected.reason instanceof RepositoryContributionConflictError)

    const accepted = await acceptedContributions(node)
    assert.equal(accepted.length, 1)
    assert.ok(accepted[0]!.id === first.id || accepted[0]!.id === second.id)
    await node.dispose()
  })
})

test('selected Asset mismatch or corruption never accepts labour or D', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'selected validation')
    const labour = labourRecord('labour-asset-failure', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-asset-failure',
      REPO_KEY,
      labour.id,
      selected.id,
    )

    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: { ...selected, id: digest('different-asset') },
        labourRecord: labour,
        acceptanceRecord: acceptance,
      }),
      RepositoryContributionAssetMismatchError,
    )
    await assertRecordMissing(node, labour.id)
    await assertRecordMissing(node, acceptance.id)

    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: { ...selected, contentHash: digest('corrupt-content-hash') },
        labourRecord: labour,
        acceptanceRecord: acceptance,
      }),
      InvalidAsset,
    )
    await assertRecordMissing(node, labour.id)
    await assertRecordMissing(node, acceptance.id)
    assert.equal(
      await node.context[ASSET_STORAGE_SERVICE].has(selected.id),
      false,
    )

    await node.dispose()
  })
})

test('failure after selected Asset durability may leave A but never accepts D', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'partial asset')
    const labour = labourRecord('labour-ingress-conflict', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-ingress-conflict',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const conflictingLabour = {
      ...labour,
      data: {
        content: 'raw conflicting durable payload',
        duration: 1,
        references: [],
        assets: [selected.id],
      },
    }

    await node.context.recordJournal.accept(conflictingLabour)

    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: selected,
        labourRecord: labour,
        acceptanceRecord: acceptance,
      }),
      RecordJournalConflictError,
    )

    assert.equal(
      await node.context[ASSET_STORAGE_SERVICE].has(selected.id),
      true,
    )
    await assertRecordMissing(node, acceptance.id)
    await node.dispose()
  })
})

test('malformed acceptance ProtocolHash fails before durable contribution work', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'malformed protocol')
    const labour = labourRecord('labour-malformed', [], [selected.id])
    const acceptance = {
      ...acceptanceRecord(
        'acceptance-malformed',
        REPO_KEY,
        labour.id,
        selected.id,
      ),
      protocolHash: undefined,
    } as unknown as CoreRecordValue

    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
        asset: selected,
        labourRecord: labour,
        acceptanceRecord: acceptance,
      }),
      RepositoryContributionProtocolError,
    )
    await assert.rejects(
      node.context[ASSET_STORAGE_SERVICE].get(selected.id),
      AssetNotFoundError,
    )
    await assertRecordMissing(node, labour.id)
    await assertRecordMissing(node, 'acceptance-malformed')
    await node.dispose()
  })
})


test('staging failure happens before the first contribution durable mutation', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'staging failure')
    const labour = labourRecord('labour-staging-failure', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-staging-failure',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    await writeFile(join(root, 'staging'), 'not a directory')

    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE].submit({
        asset: selected,
        labourRecord: labour,
        acceptanceRecord: acceptance,
      }),
      ContributionStagingStorageError,
    )

    assert.equal(
      await node.context[ASSET_STORAGE_SERVICE].has(selected.id),
      false,
    )
    await assertRecordMissing(node, labour.id)
    await assertRecordMissing(node, acceptance.id)
    await node.dispose()
  })
})

test('restart recovery replays staged S0 without duplicate ingress', async () => {
  await withRoot(async (root) => {
    const first = await createNode(root)
    await establishBase(first)

    const selected = createAsset(first, 'recover S0')
    const labour = labourRecord('labour-recover-s0', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-recover-s0',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const request = {
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    }

    first.context[ASSET_STORAGE_SERVICE].preserve = async () => {
      throw new Error('simulated crash before A')
    }
    await assert.rejects(
      first.context[REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE].submit(request),
      /simulated crash before A/u,
    )
    assert.deepEqual(await stagedAcceptanceIds(first), [acceptance.id])
    assert.equal(
      await first.context[ASSET_STORAGE_SERVICE].has(selected.id),
      false,
    )
    await assertRecordMissing(first, labour.id)
    await assertRecordMissing(first, acceptance.id)
    await first.dispose()

    const second = await createNode(root)
    const recovered = await second.context[
      REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE
    ].recoverPending()
    assert.equal(recovered.length, 1)
    assert.equal(recovered[0]?.status, 'COMMITTED')
    assert.deepEqual(await stagedAcceptanceIds(second), [])
    assert.deepEqual(
      await second.context[ASSET_STORAGE_SERVICE].get(selected.id),
      selected,
    )
    assert.deepEqual(await second.context.recordJournal.get(labour.id), labour)
    assert.deepEqual(
      await second.context.recordJournal.get(acceptance.id),
      acceptance,
    )
    assert.equal((await acceptedContributions(second)).length, 1)
    await second.dispose()
  })
})

test('restart recovery reuses durable A in S1 and completes L then D', async () => {
  await withRoot(async (root) => {
    const first = await createNode(root)
    await establishBase(first)

    const selected = createAsset(first, 'recover S1')
    const labour = labourRecord('labour-recover-s1', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-recover-s1',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const request = {
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    }

    first.context[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord =
      async () => {
        throw new Error('simulated crash before L')
      }
    await assert.rejects(
      first.context[REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE].submit(request),
      /simulated crash before L/u,
    )
    assert.equal(
      await first.context[ASSET_STORAGE_SERVICE].has(selected.id),
      true,
    )
    await assertRecordMissing(first, labour.id)
    await assertRecordMissing(first, acceptance.id)
    assert.deepEqual(await stagedAcceptanceIds(first), [acceptance.id])
    await first.dispose()

    const second = await createNode(root)
    const recovered = await second.context[
      REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE
    ].recoverPending()
    assert.equal(recovered[0]?.status, 'COMMITTED')
    assert.deepEqual(await stagedAcceptanceIds(second), [])
    assert.deepEqual(await second.context.recordJournal.get(labour.id), labour)
    assert.deepEqual(
      await second.context.recordJournal.get(acceptance.id),
      acceptance,
    )
    assert.equal((await acceptedContributions(second)).length, 1)
    await second.dispose()
  })
})

test('restart recovery reuses durable A and L in S2 before publishing D', async () => {
  await withRoot(async (root) => {
    const first = await createNode(root)
    await establishBase(first)

    const selected = createAsset(first, 'recover S2')
    const labour = labourRecord('labour-recover-s2', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-recover-s2',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const request = {
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    }

    const database = first.context.runtimeRecordDatabase
    const originalRunExclusive:
      typeof database[typeof RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE] =
      database[RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE].bind(database)
    database[RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE] =
      async function <T>(
        operation: (
          database: RuntimeRecordDatabaseSession,
        ) => Promise<T>,
      ): Promise<T> {
        return originalRunExclusive(async (session) =>
          operation({
            ...session,
            accept: async (record) => {
              if (
                (record as Partial<CoreRecordValue>).protocol ===
                REPO_CONTRIBUTION_PROTOCOL_REFERENCE
              ) {
                throw new Error('simulated crash before D')
              }
              return session.accept(record)
            },
          }),
        )
      }

    await assert.rejects(
      first.context[REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE].submit(request),
      /simulated crash before D/u,
    )
    assert.equal(
      await first.context[ASSET_STORAGE_SERVICE].has(selected.id),
      true,
    )
    assert.deepEqual(await first.context.recordJournal.get(labour.id), labour)
    await assertRecordMissing(first, acceptance.id)
    assert.deepEqual(await stagedAcceptanceIds(first), [acceptance.id])
    await first.dispose()

    const second = await createNode(root)
    const recovered = await second.context[
      REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE
    ].recoverPending()
    assert.equal(recovered[0]?.status, 'COMMITTED')
    assert.deepEqual(await stagedAcceptanceIds(second), [])
    assert.deepEqual(
      await second.context.recordJournal.get(acceptance.id),
      acceptance,
    )
    assert.equal((await acceptedContributions(second)).length, 1)
    await second.dispose()
  })
})

test('D stays COMMITTED across cleanup failure and replay never heals missing Asset', async () => {
  await withRoot(async (root) => {
    const first = await createNode(root)
    await establishBase(first)

    const selected = createAsset(first, 'recover S3')
    const labour = labourRecord('labour-recover-s3', [], [selected.id])
    const acceptance = acceptanceRecord(
      'acceptance-recover-s3',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    const request = {
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: acceptance,
    }

    first.context[CONTRIBUTION_STAGING_SERVICE].remove = async () => {
      throw new Error('simulated cleanup interruption')
    }
    const committed = await first.context[
      REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE
    ].submit(request)
    assert.equal(committed.status, 'COMMITTED')
    assert.deepEqual(
      await first.context.recordJournal.get(acceptance.id),
      acceptance,
    )
    assert.deepEqual(await stagedAcceptanceIds(first), [acceptance.id])

    const storage = first.context[ASSET_STORAGE_SERVICE]
    const originalGet = storage.get.bind(storage)
    const originalPreserve = storage.preserve.bind(storage)
    let preserveCalls = 0
    storage.get = async (assetId) => {
      if (assetId === selected.id) throw new AssetNotFoundError(assetId)
      return originalGet(assetId)
    }
    storage.preserve = async (asset) => {
      preserveCalls += 1
      return originalPreserve(asset)
    }

    await assert.rejects(
      first.context[
        REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE
      ].recoverPending(),
      AssetNotFoundError,
    )
    assert.equal(preserveCalls, 0)
    assert.deepEqual(await stagedAcceptanceIds(first), [acceptance.id])
    assert.deepEqual(
      await first.context.recordJournal.get(acceptance.id),
      acceptance,
    )
    await first.dispose()

    const second = await createNode(root)
    const recovered = await second.context[
      REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE
    ].recoverPending()
    assert.deepEqual(recovered, [committed])
    assert.deepEqual(await stagedAcceptanceIds(second), [])
    assert.equal((await acceptedContributions(second)).length, 1)
    await second.dispose()
  })
})

test('distinct same-key conflict remains staged and cannot replace durable D', async () => {
  await withRoot(async (root) => {
    const node = await createNode(root)
    await establishBase(node)

    const selected = createAsset(node, 'recovery same-key conflict')
    const labour = labourRecord(
      'labour-recovery-same-key',
      [],
      [selected.id],
    )
    const accepted = acceptanceRecord(
      'acceptance-recovery-winner',
      REPO_KEY,
      labour.id,
      selected.id,
    )
    await node.context[REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE].submit({
      asset: selected,
      labourRecord: labour,
      acceptanceRecord: accepted,
    })

    const candidate = acceptanceRecord(
      'acceptance-recovery-conflict',
      REPO_KEY,
      labour.id,
      selected.id,
      SECOND_OPERATOR_KEY,
    )
    await assert.rejects(
      node.context[REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE].submit({
        asset: selected,
        labourRecord: labour,
        acceptanceRecord: candidate,
      }),
      RepositoryContributionConflictError,
    )

    assert.deepEqual(await stagedAcceptanceIds(node), [candidate.id])
    assert.deepEqual(
      await node.context.recordJournal.get(accepted.id),
      accepted,
    )
    await assertRecordMissing(node, candidate.id)
    assert.equal((await acceptedContributions(node)).length, 1)
    await node.dispose()
  })
})
