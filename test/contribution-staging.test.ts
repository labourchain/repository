import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createAssetIdentity } from '../src/asset-identity.ts'
import {
  ASSET_CONTENT_PROTOCOL_REFERENCE,
  CONTRIBUTION_STAGING_SERVICE,
  ContributionStagingConflictError,
  ContributionStagingCorruptionError,
  ContributionStagingInputError,
  ContributionStagingStorageError,
  contributionStagingPlugin,
  createRepositoryNode,
  type ContributionRequest,
  type CoreRecordValue,
} from '../src/index.ts'

const PROTOCOL_HASH = 'a'.repeat(64)

function record(
  id: string,
  protocol: string,
  data: unknown,
): CoreRecordValue {
  return {
    id,
    protocol,
    protocolHash: PROTOCOL_HASH,
    createdBy: 'test-entity',
    createdAt: '2026-10-06T00:00:00Z',
    signature: 'test-signature',
    data,
  }
}

function request(
  acceptanceRecordId = 'acceptance-staged',
): ContributionRequest {
  const asset = createAssetIdentity(
    Buffer.from('staged exact bytes', 'utf8'),
    ASSET_CONTENT_PROTOCOL_REFERENCE,
    PROTOCOL_HASH,
  )
  const labourRecord = record(
    'labour-staged',
    'labour.record@0.1.0',
    { assets: [asset.id] },
  )
  const acceptanceRecord = record(
    acceptanceRecordId,
    'repo.contribution@0.1.0',
    {
      labourRecordId: labourRecord.id,
      assetId: asset.id,
      operator: 'operator-key',
    },
  )
  return { asset, labourRecord, acceptanceRecord }
}

async function createNode(directory: string) {
  return createRepositoryNode({
    plugins: [
      {
        plugin: contributionStagingPlugin,
        config: { directory },
      },
    ],
  })
}

async function staged(
  node: Awaited<ReturnType<typeof createRepositoryNode>>,
): Promise<ContributionRequest[]> {
  const requests: ContributionRequest[] = []
  for await (
    const request of node.context[
      CONTRIBUTION_STAGING_SERVICE
    ].iterateStaged()
  ) {
    requests.push(request)
  }
  return requests
}

test('durably stages one exact request and survives restart', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-staging-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'staging')
  const expected = request()

  const first = await createNode(directory)
  await first.context[CONTRIBUTION_STAGING_SERVICE].stage(expected)
  await first.context[CONTRIBUTION_STAGING_SERVICE].stage({
    asset: {
      ...expected.asset,
      content: Uint8Array.from(expected.asset.content),
    },
    labourRecord: JSON.parse(JSON.stringify(expected.labourRecord)),
    acceptanceRecord: JSON.parse(
      JSON.stringify(expected.acceptanceRecord),
    ),
  })
  assert.equal((await staged(first)).length, 1)

  const files = await readdir(directory)
  const finalized = files.filter((name) =>
    name.endsWith('.contribution.json'),
  )
  assert.deepEqual(finalized, [
    Buffer.from(expected.acceptanceRecord.id, 'utf8').toString('hex') +
      '.contribution.json',
  ])
  assert.deepEqual(
    files.filter((name) => name.endsWith('.tmp')),
    [],
  )
  await first.dispose()

  const second = await createNode(directory)
  const [loaded] = await staged(second)
  assert.ok(loaded)
  assert.deepEqual(loaded.asset, expected.asset)
  assert.deepEqual(loaded.labourRecord, expected.labourRecord)
  assert.deepEqual(loaded.acceptanceRecord, expected.acceptanceRecord)
  await second.dispose()
})

test('stages null-prototype Record data as the same durable JSON value', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-staging-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const expected = request('null-prototype-data')
  const labourData = Object.assign(
    Object.create(null),
    expected.labourRecord.data,
  )
  const exact = {
    ...expected,
    labourRecord: {
      ...expected.labourRecord,
      data: labourData,
    },
  }
  assert.equal(Object.getPrototypeOf(exact.labourRecord.data), null)

  const first = await createNode(root)
  await first.context[CONTRIBUTION_STAGING_SERVICE].stage(exact)
  await first.dispose()

  const second = await createNode(root)
  const [loaded] = await staged(second)
  assert.equal(loaded?.labourRecord.id, exact.labourRecord.id)
  assert.equal(
    loaded?.acceptanceRecord.id,
    exact.acceptanceRecord.id,
  )
  assert.deepEqual(loaded?.labourRecord.data, {
    assets: [expected.asset.id],
  })
  await second.dispose()
})

test('rejects Record data when JSON persistence would lose a value', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-staging-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const expected = request('lossy-record-data')
  const node = await createNode(root)

  await assert.rejects(
    node.context[CONTRIBUTION_STAGING_SERVICE].stage({
      ...expected,
      labourRecord: {
        ...expected.labourRecord,
        data: {
          ...(expected.labourRecord.data as Record<string, unknown>),
          droppedByJson: undefined,
        },
      },
    }),
    ContributionStagingInputError,
  )
  assert.deepEqual(await staged(node), [])
  await node.dispose()
})

test('same acceptance RecordId never overwrites non-equivalent staging', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-staging-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const node = await createNode(root)
  const first = request('same-staging-key')
  await node.context[CONTRIBUTION_STAGING_SERVICE].stage(first)

  await assert.rejects(
    node.context[CONTRIBUTION_STAGING_SERVICE].stage({
      ...first,
      acceptanceRecord: {
        ...first.acceptanceRecord,
        data: {
          ...(first.acceptanceRecord.data as Record<string, unknown>),
          operator: 'different-operator',
        },
      },
    }),
    ContributionStagingConflictError,
  )

  const [loaded] = await staged(node)
  assert.deepEqual(loaded?.acceptanceRecord, first.acceptanceRecord)
  await node.dispose()
})

test('interrupted temporary staging is never enumerated', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-staging-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(root, { recursive: true })
  await writeFile(
    join(root, '.contribution-interrupted.tmp'),
    '{"incomplete":true',
  )

  const node = await createNode(root)
  assert.deepEqual(await staged(node), [])
  await node.dispose()
})

test('corrupt finalized staging fails explicitly', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-staging-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const node = await createNode(root)
  await node.context[CONTRIBUTION_STAGING_SERVICE].stage(request())

  const file = (await readdir(root)).find((name) =>
    name.endsWith('.contribution.json'),
  )
  assert.ok(file)
  await writeFile(join(root, file), '{"asset":')

  await assert.rejects(
    async () => {
      for await (
        const _request of node.context[
          CONTRIBUTION_STAGING_SERVICE
        ].iterateStaged()
      ) {
        assert.fail('corrupt staging must not yield a request')
      }
    },
    ContributionStagingCorruptionError,
  )
  await node.dispose()
})

test('remove is idempotent and publication failures stay operational', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-staging-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'staging')
  const expected = request('remove-idempotently')
  const node = await createNode(directory)

  await node.context[CONTRIBUTION_STAGING_SERVICE].stage(expected)
  await node.context[CONTRIBUTION_STAGING_SERVICE].remove(
    expected.acceptanceRecord.id,
  )
  await node.context[CONTRIBUTION_STAGING_SERVICE].remove(
    expected.acceptanceRecord.id,
  )
  assert.deepEqual(await staged(node), [])
  await node.dispose()

  const blocked = join(root, 'blocked')
  await writeFile(blocked, 'not a directory')
  const broken = await createNode(blocked)
  await assert.rejects(
    broken.context[CONTRIBUTION_STAGING_SERVICE].stage(request('blocked')),
    ContributionStagingStorageError,
  )
  await broken.dispose()
})
