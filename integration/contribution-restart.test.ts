import assert from 'node:assert/strict'
import {
  generateKeyPairSync,
  sign,
  type KeyObject,
} from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { test } from 'node:test'
import type { Plugin } from '@deepseek-ai/cordis'
import { build } from 'tsdown'
import {
  ASSET_CONTENT_PROTOCOL_SERVICE,
  ASSET_STORAGE_SERVICE,
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_PROTOCOL_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  PROTOCOL_RESOLUTION_SERVICE,
  REPOSITORY_CONTRIBUTION_SERVICE,
  REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
  REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  RecordJournalService,
  RepositoryContributionConflictError,
  assetStoragePlugin,
  createRepositoryNode,
  protocolResolutionPlugin,
  repositoryContributionPlugin,
  runtimeRecordDatabasePlugin,
  type AssetContentProtocolService,
  type CoreEntityProtocolService,
  type CoreProtocolService,
  type CoreRecordProtocolService,
  type CoreRecordValue,
  type ProtocolArtifactResolution,
  type ProtocolDependency,
  type ProtocolDescriptor,
  type ProtocolResolutionHost,
} from '../src/index.ts'

const CORE_RELEASE = 'v0.1.0'
const CORE_VERSION = '0.1.0'
const CORE_RELEASE_BASE =
  'https://github.com/labourchain/core-protocols/releases/download/' +
  CORE_RELEASE

const CORE_PROTOCOL_PROTOCOL_HASH =
  '19b39e1f09682fed5b8648835a6c0dc9753ed0b60d9efc9397388a2ee9dfb198'
const CORE_ENTITY_PROTOCOL_HASH =
  'c507745d8e17760f25d852f3889381ca9053b0197f418bdc0f0a5e9e0f19ae9c'
const CORE_RECORD_PROTOCOL_HASH =
  '752efeba281ee962b87f6fa69623c8e207dbed5f3a695cfc6871c9fc8a841df1'

interface ReleasedProtocolDescriptor {
  readonly protocolHash: string
  readonly protocol: ProtocolDescriptor & { readonly artifact?: string }
}

interface CoreProtocolRuntimeService extends CoreProtocolService {
  artifactHash(bytes: Uint8Array): string
  protocolHash(protocol: unknown): string
}

interface CoreEntityRuntimeService extends CoreEntityProtocolService {
  encodeBase58btc(bytes: Uint8Array): string
}

interface CoreRecordRuntimeService extends CoreRecordProtocolService {
  recordId(value: unknown): string
  signingPayload(recordId: string): Uint8Array
}

interface BuiltProtocol {
  readonly protocolHash: string
  readonly protocol: ProtocolDescriptor & { readonly artifact: string }
}

async function fetchReleasedDescriptor(
  name: 'core.protocol' | 'core.entity' | 'core.record',
  expectedProtocolHash: string,
): Promise<ReleasedProtocolDescriptor> {
  const url =
    CORE_RELEASE_BASE + '/' + name + '-' + CORE_VERSION + '.json'
  const response = await fetch(url, { redirect: 'follow' })
  assert.equal(
    response.ok,
    true,
    'unable to fetch released Core descriptor ' +
      url +
      ': HTTP ' +
      response.status,
  )
  const descriptor = (await response.json()) as ReleasedProtocolDescriptor
  assert.equal(descriptor.protocolHash, expectedProtocolHash)
  assert.equal(descriptor.protocol.name, name)
  assert.equal(descriptor.protocol.version, CORE_VERSION)
  assert.equal(typeof descriptor.protocol.artifact, 'string')
  return descriptor
}

async function loadReleasedCoreProtocolPlugin(
  descriptor: ReleasedProtocolDescriptor,
  root: string,
  suffix: string,
): Promise<Plugin> {
  const runtime = gunzipSync(
    Buffer.from(descriptor.protocol.artifact as string, 'base64'),
  )
  const runtimePath = join(root, 'core-protocol-' + suffix + '.mjs')
  await writeFile(runtimePath, runtime)
  const namespace = await import(
    pathToFileURL(runtimePath).href + '?' + suffix
  )
  assert.deepEqual(Object.keys(namespace), ['plugin'])
  return namespace.plugin as Plugin
}

function canonicalGzip(bytes: Uint8Array): Buffer {
  const compressed = Buffer.from(gzipSync(bytes, { level: 9 }))
  assert.ok(compressed.byteLength >= 18)
  assert.equal(compressed[0], 0x1f)
  assert.equal(compressed[1], 0x8b)
  assert.equal(compressed[2], 0x08)
  assert.equal(compressed[3], 0x00)
  compressed.fill(0, 4, 8)
  compressed[9] = 0xff
  return compressed
}

async function bundleProtocolEntry(
  entry: string,
  root: string,
  name: string,
): Promise<Uint8Array> {
  const outDir = join(root, 'bundle-' + name.replaceAll('.', '-'))
  await build({
    entry: { runtime: entry },
    outDir,
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    dts: false,
    clean: true,
    sourcemap: false,
    minify: false,
    logLevel: 'silent',
    deps: {
      neverBundle: ['@deepseek-ai/cordis'],
    },
  })

  const output = (await readdir(outDir))
    .filter((file) => file === 'runtime.js' || file === 'runtime.mjs')
  assert.equal(output.length, 1)
  return readFile(join(outDir, output[0]!))
}

async function buildProtocolArtifact(
  core: CoreProtocolRuntimeService,
  root: string,
  name: string,
  entry: string,
  dependencies: readonly ProtocolDependency[],
): Promise<BuiltProtocol> {
  const runtimeBytes = await bundleProtocolEntry(entry, root, name)
  const artifactBytes = canonicalGzip(runtimeBytes)
  const protocol = {
    name,
    version: '0.1.0',
    runtime: { kind: 'cordis-js-esm' as const, abi: 1 },
    dependencies: [...dependencies],
    artifactHash: core.artifactHash(artifactBytes),
    artifact: artifactBytes.toString('base64'),
  }
  const protocolHash = core.protocolHash(protocol)
  assert.equal(core.verifyEmbeddedArtifact(protocol, protocolHash), protocolHash)
  return { protocolHash, protocol }
}

function dependency(
  name: string,
  protocolHash: string,
): ProtocolDependency {
  return { name, version: '0.1.0', protocolHash }
}

function artifactHost(
  values: ReadonlyMap<string, ProtocolArtifactResolution>,
  root: string,
  instance: string,
): ProtocolResolutionHost {
  return {
    async resolveArtifact(protocolHash) {
      return values.get(protocolHash)
    },
    async evaluateRuntime(_protocol, runtimeBytes, protocolHash) {
      const file = join(
        root,
        'resolved-' + instance + '-' + protocolHash + '.mjs',
      )
      await writeFile(file, runtimeBytes)
      return import(pathToFileURL(file).href + '?' + instance + protocolHash)
    },
  }
}

function entityIdentity(
  service: CoreEntityRuntimeService,
  publicKey: KeyObject,
): string {
  const der = publicKey.export({
    format: 'der',
    type: 'spki',
  }) as Buffer
  return service.encodeBase58btc(der.subarray(der.byteLength - 32))
}

function signedRecord(
  service: CoreRecordRuntimeService,
  privateKey: KeyObject,
  raw: Omit<CoreRecordValue, 'id' | 'signature'>,
): CoreRecordValue {
  const id = service.recordId(raw)
  return {
    id,
    ...raw,
    signature: sign(
      null,
      service.signingPayload(id),
      privateKey,
    ).toString('hex'),
  }
}

test(
  'real repo.contribution artifact commits and reconstructs from durable facts after restart',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'labourchain-contribution-real-'))
    const journalDirectory = join(root, 'journal')
    const assetDirectory = join(root, 'assets')
    await mkdir(journalDirectory)
    await mkdir(assetDirectory)

    try {
      const [
        coreProtocolDescriptor,
        coreEntityDescriptor,
        coreRecordDescriptor,
      ] = await Promise.all([
        fetchReleasedDescriptor(
          'core.protocol',
          CORE_PROTOCOL_PROTOCOL_HASH,
        ),
        fetchReleasedDescriptor(
          'core.entity',
          CORE_ENTITY_PROTOCOL_HASH,
        ),
        fetchReleasedDescriptor(
          'core.record',
          CORE_RECORD_PROTOCOL_HASH,
        ),
      ])

      const builderCorePlugin = await loadReleasedCoreProtocolPlugin(
        coreProtocolDescriptor,
        root,
        'builder',
      )
      const builderNode = await createRepositoryNode({
        plugins: [{ plugin: builderCorePlugin }],
      })
      const core = builderNode.context[
        CORE_PROTOCOL_PROTOCOL_SERVICE
      ] as CoreProtocolRuntimeService

      const member = await buildProtocolArtifact(
        core,
        root,
        'member.identity',
        resolve('src/protocols/member.identity.ts'),
        [
          dependency('core.entity', CORE_ENTITY_PROTOCOL_HASH),
          dependency('core.record', CORE_RECORD_PROTOCOL_HASH),
        ],
      )
      const repo = await buildProtocolArtifact(
        core,
        root,
        'repo.establishment',
        resolve('src/protocols/repo.establishment.ts'),
        [
          dependency('core.entity', CORE_ENTITY_PROTOCOL_HASH),
          dependency('core.record', CORE_RECORD_PROTOCOL_HASH),
          dependency('member.identity', member.protocolHash),
        ],
      )
      const labour = await buildProtocolArtifact(
        core,
        root,
        'labour.record',
        resolve('src/protocols/labour.record.ts'),
        [
          dependency('core.record', CORE_RECORD_PROTOCOL_HASH),
          dependency('member.identity', member.protocolHash),
        ],
      )
      const asset = await buildProtocolArtifact(
        core,
        root,
        'asset.content',
        resolve('src/protocols/asset.content.ts'),
        [],
      )
      const contribution = await buildProtocolArtifact(
        core,
        root,
        'repo.contribution',
        resolve('src/protocols/repo.contribution.ts'),
        [
          dependency('core.entity', CORE_ENTITY_PROTOCOL_HASH),
          dependency('core.record', CORE_RECORD_PROTOCOL_HASH),
          dependency('repo.establishment', repo.protocolHash),
          dependency('labour.record', labour.protocolHash),
        ],
      )
      await builderNode.dispose()

      assert.match(contribution.protocolHash, /^[0-9a-f]{64}$/u)
      assert.equal(
        coreProtocolDescriptor.protocolHash,
        CORE_PROTOCOL_PROTOCOL_HASH,
      )

      const artifacts = new Map<string, ProtocolArtifactResolution>([
        [
          CORE_ENTITY_PROTOCOL_HASH,
          { protocol: coreEntityDescriptor.protocol },
        ],
        [
          CORE_RECORD_PROTOCOL_HASH,
          { protocol: coreRecordDescriptor.protocol },
        ],
        [member.protocolHash, { protocol: member.protocol }],
        [repo.protocolHash, { protocol: repo.protocol }],
        [labour.protocolHash, { protocol: labour.protocol }],
        [asset.protocolHash, { protocol: asset.protocol }],
        [
          contribution.protocolHash,
          { protocol: contribution.protocol },
        ],
      ])

      const memberKeys = generateKeyPairSync('ed25519')
      const repoKeys = generateKeyPairSync('ed25519')
      const operatorKeys = generateKeyPairSync('ed25519')
      const secondOperatorKeys = generateKeyPairSync('ed25519')

      async function createRuntime(instance: string) {
        const corePlugin = await loadReleasedCoreProtocolPlugin(
          coreProtocolDescriptor,
          root,
          'runtime-' + instance,
        )
        return createRepositoryNode({
          plugins: [
            { plugin: repositoryContributionPlugin },
            {
              plugin: assetStoragePlugin,
              config: { directory: assetDirectory },
            },
            {
              plugin: protocolResolutionPlugin,
              config: {
                host: artifactHost(artifacts, root, instance),
              },
            },
            { plugin: corePlugin },
            { plugin: runtimeRecordDatabasePlugin },
            {
              plugin: RecordJournalService,
              config: { directory: journalDirectory },
            },
          ],
        })
      }

      const first = await createRuntime('first')
      const resolver = first.context[PROTOCOL_RESOLUTION_SERVICE]
      await resolver.resolve(
        'core.entity@0.1.0',
        CORE_ENTITY_PROTOCOL_HASH,
      )
      await resolver.resolve(
        'core.record@0.1.0',
        CORE_RECORD_PROTOCOL_HASH,
      )

      const entityService = first.context[
        CORE_ENTITY_PROTOCOL_SERVICE
      ] as CoreEntityRuntimeService
      const recordService = first.context[
        CORE_RECORD_PROTOCOL_SERVICE
      ] as CoreRecordRuntimeService
      const memberIdentity = entityIdentity(
        entityService,
        memberKeys.publicKey,
      )
      const repoIdentity = entityIdentity(
        entityService,
        repoKeys.publicKey,
      )
      const operatorIdentity = entityIdentity(
        entityService,
        operatorKeys.publicKey,
      )
      const secondOperatorIdentity = entityIdentity(
        entityService,
        secondOperatorKeys.publicKey,
      )

      await resolver.resolve(MEMBER_PROTOCOL_REFERENCE, member.protocolHash)
      const memberDeclaration = signedRecord(
        recordService,
        memberKeys.privateKey,
        {
          protocol: MEMBER_PROTOCOL_REFERENCE,
          protocolHash: member.protocolHash,
          createdBy: memberIdentity,
          createdAt: '2026-10-04T01:00:00.000Z',
          data: {},
        },
      )
      await first.context[MEMBER_PROTOCOL_SERVICE].declareMember(
        memberDeclaration,
      )

      await resolver.resolve(
        REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
        repo.protocolHash,
      )
      const establishment = signedRecord(
        recordService,
        memberKeys.privateKey,
        {
          protocol: REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
          protocolHash: repo.protocolHash,
          createdBy: memberIdentity,
          createdAt: '2026-10-04T01:00:01.000Z',
          data: { publicKey: repoIdentity },
        },
      )
      await first.context[
        REPO_ESTABLISHMENT_PROTOCOL_SERVICE
      ].establishRepo(establishment)

      await resolver.resolve(
        'asset.content@0.1.0',
        asset.protocolHash,
      )
      const assetService = first.context[
        ASSET_CONTENT_PROTOCOL_SERVICE
      ] as AssetContentProtocolService
      const upstream = assetService.createAsset(
        Buffer.from('upstream is intentionally absent', 'utf8'),
      )
      const selected = assetService.createAsset(
        Buffer.from('durable contribution result', 'utf8'),
      )

      const labourRecord = signedRecord(
        recordService,
        memberKeys.privateKey,
        {
          protocol: LABOUR_RECORD_PROTOCOL_REFERENCE,
          protocolHash: labour.protocolHash,
          createdBy: memberIdentity,
          createdAt: '2026-10-04T01:01:00.000Z',
          data: {
            content: '实现 Repository Contribution 最小闭环',
            duration: 1,
            references: [upstream.id],
            assets: [selected.id],
          },
        },
      )
      const acceptance = signedRecord(
        recordService,
        repoKeys.privateKey,
        {
          protocol: REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
          protocolHash: contribution.protocolHash,
          createdBy: repoIdentity,
          createdAt: '2026-10-04T01:02:00.000Z',
          data: {
            labourRecordId: labourRecord.id,
            assetId: selected.id,
            operator: operatorIdentity,
          },
        },
      )
      const conflictingAcceptance = signedRecord(
        recordService,
        repoKeys.privateKey,
        {
          protocol: REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
          protocolHash: contribution.protocolHash,
          createdBy: repoIdentity,
          createdAt: '2026-10-04T01:02:01.000Z',
          data: {
            labourRecordId: labourRecord.id,
            assetId: selected.id,
            operator: secondOperatorIdentity,
          },
        },
      )

      assert.equal(
        await first.context[ASSET_STORAGE_SERVICE].has(upstream.id),
        false,
      )

      const request = {
        asset: selected,
        labourRecord,
        acceptanceRecord: acceptance,
      }
      assert.match(labourRecord.id, /^[0-9a-f]{64}$/u)
      assert.match(acceptance.id, /^[0-9a-f]{64}$/u)

      const committed = await first.context[
        REPOSITORY_CONTRIBUTION_SERVICE
      ].commit(request)

      assert.deepEqual(committed, {
        status: 'COMMITTED',
        recordId: acceptance.id,
        repoIdentity,
        labourRecordId: labourRecord.id,
        assetId: selected.id,
        operator: operatorIdentity,
        contributor: memberIdentity,
      })
      assert.equal('blockConfirmed' in committed, false)
      assert.equal('chainStatus' in committed, false)
      assert.equal(
        await first.context[ASSET_STORAGE_SERVICE].has(upstream.id),
        false,
      )
      assert.deepEqual(
        (
          await first.context[ASSET_STORAGE_SERVICE].get(selected.id)
        ).content,
        selected.content,
      )
      assert.deepEqual(
        await first.context.recordJournal.get(labourRecord.id),
        labourRecord,
      )
      assert.deepEqual(
        await first.context.recordJournal.get(acceptance.id),
        acceptance,
      )

      await first.dispose()

      const second = await createRuntime('second')
      const replayed = await second.context[
        REPOSITORY_CONTRIBUTION_SERVICE
      ].commit(request)
      assert.deepEqual(replayed, committed)

      assert.deepEqual(
        await second.context.recordJournal.get(labourRecord.id),
        labourRecord,
      )
      assert.deepEqual(
        await second.context.recordJournal.get(acceptance.id),
        acceptance,
      )
      assert.deepEqual(
        (
          await second.context[ASSET_STORAGE_SERVICE].get(selected.id)
        ).content,
        selected.content,
      )

      await assert.rejects(
        second.context[REPOSITORY_CONTRIBUTION_SERVICE].commit({
          asset: selected,
          labourRecord,
          acceptanceRecord: conflictingAcceptance,
        }),
        RepositoryContributionConflictError,
      )

      await second.dispose()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)
