import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
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
  ASSET_CONTENT_PROTOCOL_SERVICE,
  ASSET_STORAGE_SERVICE,
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  PROTOCOL_RESOLUTION_SERVICE,
  REPOSITORY_CONTRIBUTION_SERVICE,
  REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
  REPO_CONTRIBUTION_PROTOCOL_SERVICE,
  REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  AssetNotFoundError,
  InvalidAsset,
  RecordJournalConflictError,
  RecordJournalNotFoundError,
  RecordJournalService,
  RepositoryContributionAssetMismatchError,
  RepositoryContributionConflictError,
  RepositoryContributionProtocolError,
  assetStoragePlugin,
  createRepositoryNode,
  repositoryContributionPlugin,
  runtimeRecordDatabasePlugin,
  type Asset,
  type CoreRecordProtocolService,
  type CoreRecordValue,
} from '../src/index.ts'

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const MEMBER_PROTOCOL_HASH = digest('test/member.identity')
const REPO_PROTOCOL_HASH = digest('test/repo.establishment')
const LABOUR_PROTOCOL_HASH = digest('test/labour.record')
const ASSET_PROTOCOL_HASH = digest('test/asset.content')
const CONTRIBUTION_PROTOCOL_HASH = digest('test/repo.contribution')

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

function coreEntityProvider(ctx: Context) {
  ctx.provide(CORE_ENTITY_PROTOCOL_SERVICE, {
    validateEntityPublicKey(value: unknown) {
      if (typeof value !== 'string' || !VALID_KEYS.has(value)) {
        throw new Error('invalid test EntityPublicKey')
      }
      return value
    },
    validateEntity(value: unknown) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('invalid test Entity')
      }
      const data = value as Record<string, unknown>
      return { publicKey: this.validateEntityPublicKey(data.publicKey) }
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

function exactResolutionProvider(ctx: Context) {
  ctx.provide(PROTOCOL_RESOLUTION_SERVICE, {
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
        reference === REPO_CONTRIBUTION_PROTOCOL_REFERENCE &&
        protocolHash === CONTRIBUTION_PROTOCOL_HASH
      ) {
        return {
          protocolHash,
          reference,
          service: REPO_CONTRIBUTION_PROTOCOL_SERVICE,
        }
      }
      throw new Error('unexpected exact Protocol resolution')
    },
  } as never)
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

function composition(root: string) {
  return [
    { plugin: repositoryContributionPlugin },
    { plugin: assetStoragePlugin, config: { directory: join(root, 'assets') } },
    {
      plugin: repoContributionPlugin,
      config: { protocolHash: CONTRIBUTION_PROTOCOL_HASH },
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
    { plugin: exactResolutionProvider },
    { plugin: coreEntityProvider },
    { plugin: coreRecordProvider },
    { plugin: runtimeRecordDatabasePlugin },
    {
      plugin: RecordJournalService,
      config: { directory: join(root, 'journal') },
    },
  ]
}

async function createNode(root: string) {
  return createRepositoryNode({ plugins: composition(root) })
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
