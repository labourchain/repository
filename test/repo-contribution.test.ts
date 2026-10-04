import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { plugin as labourRecordPlugin } from '../src/protocols/labour.record.ts'
import { plugin as memberIdentityPlugin } from '../src/protocols/member.identity.ts'
import { plugin as repoContributionPlugin } from '../src/protocols/repo.contribution.ts'
import { plugin as repoEstablishmentPlugin } from '../src/protocols/repo.establishment.ts'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  LABOUR_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
  REPO_CONTRIBUTION_PROTOCOL_SERVICE,
  REPO_CONTRIBUTION_PROTOCOL_INJECT,
  REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  RecordJournalService,
  RepoContributionProtocolConfigError,
  RepoContributionRelationError,
  RepoContributionRepoNotEstablishedError,
  RepoContributionValidationError,
  createRepositoryNode,
  runtimeRecordDatabasePlugin,
  type CoreRecordProtocolService,
  type CoreRecordValue,
} from '../src/index.ts'

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const MEMBER_PROTOCOL_HASH = digest('test/member.identity')
const REPO_PROTOCOL_HASH = digest('test/repo.establishment')
const LABOUR_PROTOCOL_HASH = digest('test/labour.record')
const CONTRIBUTION_PROTOCOL_HASH = digest('test/repo.contribution')

const MEMBER_KEY = 'member-key'
const REPO_KEY = 'repo-key'
const OTHER_REPO_KEY = 'other-repo-key'
const OPERATOR_KEY = 'operator-key'
const OTHER_OPERATOR_KEY = 'other-operator-key'

const VALID_KEYS = new Set([
  MEMBER_KEY,
  REPO_KEY,
  OTHER_REPO_KEY,
  OPERATOR_KEY,
  OTHER_OPERATOR_KEY,
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

function repoRecord(): CoreRecordValue {
  return {
    id: 'repo-establishment',
    protocol: REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
    protocolHash: REPO_PROTOCOL_HASH,
    createdBy: MEMBER_KEY,
    createdAt: '2026-10-04T00:00:01Z',
    signature: 'sig:' + MEMBER_KEY,
    data: { publicKey: REPO_KEY },
  }
}

function labourRecord(
  id = 'labour-1',
  assetId = digest('asset/result'),
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
      content: '实现 repo contribution vertical slice',
      duration: 1,
      references: [digest('asset/upstream')],
      assets: [assetId],
    },
    ...overrides,
  }
}

function acceptanceRecord(
  id = 'acceptance-1',
  labourRecordId = 'labour-1',
  assetId = digest('asset/result'),
  overrides: Partial<CoreRecordValue> = {},
): CoreRecordValue {
  return {
    id,
    protocol: REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
    protocolHash: CONTRIBUTION_PROTOCOL_HASH,
    createdBy: REPO_KEY,
    createdAt: '2026-10-04T00:02:00Z',
    signature: 'sig:' + REPO_KEY,
    data: {
      labourRecordId,
      assetId,
      operator: OPERATOR_KEY,
    },
    ...overrides,
  }
}

async function withDirectory<T>(run: (directory: string) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), 'labourchain-repo-contribution-'))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function composition(directory: string) {
  return [
    {
      plugin: repoContributionPlugin,
      config: { protocolHash: CONTRIBUTION_PROTOCOL_HASH },
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
    { plugin: coreEntityProvider },
    { plugin: coreRecordProvider },
    { plugin: runtimeRecordDatabasePlugin },
    { plugin: RecordJournalService, config: { directory } },
  ]
}

async function prepare(node: Awaited<ReturnType<typeof createRepositoryNode>>) {
  await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(memberRecord())
  await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(
    repoRecord(),
  )
}

test('Protocol artifact entry exports only the semantic plugin boundary', async () => {
  const namespace = await import('../src/protocols/repo.contribution.ts')
  assert.deepEqual(Object.keys(namespace), ['plugin'])
  assert.equal(namespace.plugin.name, REPO_CONTRIBUTION_PROTOCOL_REFERENCE)
  assert.equal(namespace.plugin.provide, REPO_CONTRIBUTION_PROTOCOL_SERVICE)
  assert.deepEqual(namespace.plugin.inject, REPO_CONTRIBUTION_PROTOCOL_INJECT)
  const inject = namespace.plugin.inject as readonly string[]
  assert.equal(inject.includes('assetStorage'), false)
  assert.equal(inject.includes('runtimeRecordDatabase'), false)
})

test('validates a Repo-signed acceptance and D -> L relation', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await prepare(node)

    const assetId = digest('asset/result')
    const labour = labourRecord('labour-1', assetId)
    const acceptance = acceptanceRecord('acceptance-1', labour.id, assetId)

    const service = node.context[REPO_CONTRIBUTION_PROTOCOL_SERVICE]
    const validated = await service.validateAcceptance(acceptance)
    assert.equal(validated.data.operator, OPERATOR_KEY)

    assert.deepEqual(await service.validateRelation(validated, labour), {
      recordId: acceptance.id,
      repoIdentity: REPO_KEY,
      labourRecordId: labour.id,
      assetId,
      operator: OPERATOR_KEY,
      contributor: MEMBER_KEY,
    })

    await node.dispose()
  })
})

test('rejects invalid Core/signature, exact Protocol identity and Repo author', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await prepare(node)
    const service = node.context[REPO_CONTRIBUTION_PROTOCOL_SERVICE]

    await assert.rejects(
      service.validateAcceptance(null),
      RepoContributionValidationError,
    )
    await assert.rejects(
      service.validateAcceptance(
        acceptanceRecord('bad-signature', 'labour-1', digest('asset/result'), {
          signature: 'bad',
        }),
      ),
      RepoContributionValidationError,
    )
    await assert.rejects(
      service.validateAcceptance(
        acceptanceRecord('wrong-reference', 'labour-1', digest('asset/result'), {
          protocol: 'repo.other@0.1.0',
        }),
      ),
      RepoContributionValidationError,
    )
    await assert.rejects(
      service.validateAcceptance(
        acceptanceRecord('wrong-hash', 'labour-1', digest('asset/result'), {
          protocolHash: digest('wrong/repo.contribution'),
        }),
      ),
      RepoContributionValidationError,
    )
    await assert.rejects(
      service.validateAcceptance(
        acceptanceRecord('unestablished', 'labour-1', digest('asset/result'), {
          createdBy: OTHER_REPO_KEY,
          signature: 'sig:' + OTHER_REPO_KEY,
        }),
      ),
      RepoContributionRepoNotEstablishedError,
    )

    await node.dispose()
  })
})

test('requires exactly three data fields and a valid operator', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await prepare(node)
    const service = node.context[REPO_CONTRIBUTION_PROTOCOL_SERVICE]
    const base = acceptanceRecord()

    const invalidData: unknown[] = [
      null,
      [],
      { labourRecordId: 'labour-1', assetId: digest('asset/result') },
      {
        labourRecordId: 'labour-1',
        assetId: digest('asset/result'),
        operator: OPERATOR_KEY,
        repo: REPO_KEY,
      },
      {
        labourRecordId: '',
        assetId: digest('asset/result'),
        operator: OPERATOR_KEY,
      },
      {
        labourRecordId: 'labour-1',
        assetId: '',
        operator: OPERATOR_KEY,
      },
      {
        labourRecordId: 'labour-1',
        assetId: digest('asset/result'),
        operator: 'not-a-valid-key',
      },
    ]

    for (const [index, data] of invalidData.entries()) {
      await assert.rejects(
        service.validateAcceptance({
          ...base,
          id: 'invalid-data-' + index,
          data,
        }),
        RepoContributionValidationError,
      )
    }

    await node.dispose()
  })
})

test('relation validation rejects invalid labour, wrong labour id and absent result Asset', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await prepare(node)
    const service = node.context[REPO_CONTRIBUTION_PROTOCOL_SERVICE]
    const selected = digest('asset/result')

    await assert.rejects(
      service.validateRelation(
        acceptanceRecord('d-invalid-l', 'labour-invalid', selected),
        labourRecord('labour-invalid', selected, { signature: 'bad' }),
      ),
      RepoContributionRelationError,
    )

    await assert.rejects(
      service.validateRelation(
        acceptanceRecord('d-wrong-l', 'labour-other', selected),
        labourRecord('labour-actual', selected),
      ),
      RepoContributionRelationError,
    )

    await assert.rejects(
      service.validateRelation(
        acceptanceRecord('d-wrong-a', 'labour-1', selected),
        labourRecord('labour-1', digest('asset/other')),
      ),
      RepoContributionRelationError,
    )

    await node.dispose()
  })
})

test('fails mount without an exact ProtocolHash', () => {
  assert.throws(
    () =>
      repoContributionPlugin.apply({} as Context, {
        protocolHash: 'not-a-hash',
      }),
    RepoContributionProtocolConfigError,
  )
})
