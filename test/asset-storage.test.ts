import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import type { Context } from '@deepseek-ai/cordis'
import * as assetContentNamespace from '../src/protocols/asset.content.ts'
import {
  ASSET_CONTENT_PROTOCOL_REFERENCE,
  ASSET_STORAGE_SERVICE,
  AssetContentTooLargeError,
  AssetCorruptionError,
  AssetIdentityConflict,
  AssetNotFoundError,
  AssetPersistenceError,
  AssetRetrievalError,
  CORE_PROTOCOL_PROTOCOL_SERVICE,
  InvalidAsset,
  MAX_ASSET_CONTENT_BYTES,
  ProtocolReferenceMismatchError,
  assetStoragePlugin,
  createRepositoryNode,
  protocolResolutionPlugin,
  type Asset,
  type CoreProtocolService,
  type ProtocolArtifactResolution,
  type ProtocolDescriptor,
  type ProtocolResolutionHost,
} from '../src/index.ts'

const PROTOCOL_HASH = 'a'.repeat(64)
const ARTIFACT = gzipSync(Buffer.from('export const plugin = {}', 'utf8'))

function descriptor(): ProtocolDescriptor {
  return {
    name: 'asset.content',
    version: '0.1.0',
    runtime: { kind: 'cordis-js-esm', abi: 1 },
    dependencies: [],
    artifactHash: 'f'.repeat(64),
  }
}

function coreProtocolProvider(ctx: Context) {
  const service: CoreProtocolService = {
    validateProtocol(value: unknown) {
      return value as ProtocolDescriptor
    },
    verifyArtifact(_protocol, bytes, expectedProtocolHash) {
      assert.ok(bytes.byteLength > 0)
      return expectedProtocolHash ?? PROTOCOL_HASH
    },
    verifyEmbeddedArtifact() {
      throw new Error('test descriptor uses an external artifact')
    },
  }
  ctx.provide(CORE_PROTOCOL_PROTOCOL_SERVICE, service)
}

function host(resolveCount?: { value: number }): ProtocolResolutionHost {
  return {
    async resolveArtifact(protocolHash): Promise<ProtocolArtifactResolution | undefined> {
      if (resolveCount) resolveCount.value += 1
      if (protocolHash !== PROTOCOL_HASH) return undefined
      return { protocol: descriptor(), artifact: ARTIFACT }
    },
    async evaluateRuntime() {
      return assetContentNamespace
    },
  }
}

function doubleSha256Hex(bytes: Uint8Array): string {
  const first = createHash('sha256').update(bytes).digest()
  return createHash('sha256').update(first).digest('hex')
}

function canonicalAsset(
  content: Uint8Array,
  protocol: string = ASSET_CONTENT_PROTOCOL_REFERENCE,
  protocolHash: string = PROTOCOL_HASH,
): Asset {
  const bytes = Uint8Array.from(content)
  const contentHash = doubleSha256Hex(bytes)
  const id = doubleSha256Hex(
    Buffer.from(JSON.stringify({ contentHash, protocol, protocolHash }), 'utf8'),
  )
  return { id, protocol, protocolHash, contentHash, content: bytes }
}

async function tempDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'labourchain-asset-storage-'))
}

async function createAssetStorageNode(
  directory: string,
  resolveCount?: { value: number },
) {
  return createRepositoryNode({
    plugins: [
      { plugin: assetStoragePlugin, config: { directory } },
      { plugin: protocolResolutionPlugin, config: { host: host(resolveCount) } },
      { plugin: coreProtocolProvider },
    ],
  })
}

async function finalizedAssetFile(directory: string): Promise<string> {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.asset'))
  assert.equal(files.length, 1)
  return join(directory, files[0]!)
}

test('preserves, gets and reports one complete Asset', async (t) => {
  const directory = await tempDirectory()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const node = await createAssetStorageNode(directory)
  const asset = canonicalAsset(Buffer.from('durable asset'))

  await node.context[ASSET_STORAGE_SERVICE].preserve(asset)
  const loaded = await node.context[ASSET_STORAGE_SERVICE].get(asset.id)

  assert.equal(loaded.id, asset.id)
  assert.equal(loaded.protocol, asset.protocol)
  assert.equal(loaded.protocolHash, asset.protocolHash)
  assert.equal(loaded.contentHash, asset.contentHash)
  assert.deepEqual(loaded.content, asset.content)
  assert.equal(await node.context[ASSET_STORAGE_SERVICE].has(asset.id), true)
  await node.dispose()
})

test('distinguishes missing Asset from provider failure', async (t) => {
  const root = await tempDirectory()
  t.after(() => rm(root, { recursive: true, force: true }))

  const missingDirectory = join(root, 'missing')
  const node = await createAssetStorageNode(missingDirectory)
  const missingId = 'b'.repeat(64)
  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].get(missingId),
    AssetNotFoundError,
  )
  assert.equal(await node.context[ASSET_STORAGE_SERVICE].has(missingId), false)
  await node.dispose()

  const blocked = join(root, 'not-a-directory')
  await writeFile(blocked, 'file')
  const broken = await createAssetStorageNode(blocked)
  await assert.rejects(
    broken.context[ASSET_STORAGE_SERVICE].get(missingId),
    AssetRetrievalError,
  )
  await broken.dispose()
})

test('exact duplicate preservation is idempotent and creates one logical Asset', async (t) => {
  const directory = await tempDirectory()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const node = await createAssetStorageNode(directory)
  const asset = canonicalAsset(Buffer.from('duplicate'))

  await Promise.all([
    node.context[ASSET_STORAGE_SERVICE].preserve(asset),
    node.context[ASSET_STORAGE_SERVICE].preserve(canonicalAsset(Buffer.from('duplicate'))),
  ])

  const entries = await readdir(directory)
  assert.equal(entries.filter((name) => name.endsWith('.asset')).length, 1)
  assert.deepEqual(entries.filter((name) => name.endsWith('.tmp')), [])
  assert.deepEqual(
    (await node.context[ASSET_STORAGE_SERVICE].get(asset.id)).content,
    asset.content,
  )
  await node.dispose()
})

test('invalid contentHash and AssetId fail before exact Protocol or durable lookup', async (t) => {
  const root = await tempDirectory()
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'never-created')
  const counter = { value: 0 }
  const node = await createAssetStorageNode(directory, counter)
  const valid = canonicalAsset(Buffer.from('identity'))

  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].preserve({
      ...valid,
      contentHash: 'f'.repeat(64),
    }),
    InvalidAsset,
  )
  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].preserve({
      ...valid,
      id: 'e'.repeat(64),
    }),
    InvalidAsset,
  )

  assert.equal(counter.value, 0)
  await assert.rejects(readdir(directory), { code: 'ENOENT' })
  await node.dispose()
})

test('canonical-valid human reference mismatch uses exact Protocol resolution before storage', async (t) => {
  const root = await tempDirectory()
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'never-created')
  const node = await createAssetStorageNode(directory)
  const mismatching = canonicalAsset(
    Buffer.from('reference'),
    'asset.other@0.1.0',
    PROTOCOL_HASH,
  )

  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].preserve(mismatching),
    ProtocolReferenceMismatchError,
  )
  await assert.rejects(readdir(directory), { code: 'ENOENT' })
  await node.dispose()
})

test('canonical-valid incoming Asset fails closed on incompatible durable state', async (t) => {
  const directory = await tempDirectory()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const node = await createAssetStorageNode(directory)
  const asset = canonicalAsset(Buffer.from('original'))

  await node.context[ASSET_STORAGE_SERVICE].preserve(asset)
  const file = await finalizedAssetFile(directory)
  const injected = Buffer.from('{"id":"corrupt"}\ncompeting durable state')
  await writeFile(file, injected)

  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].preserve(asset),
    AssetIdentityConflict,
  )
  assert.deepEqual(await readFile(file), injected)
  await node.dispose()
})

test('persistence failure before publication exposes no successful Asset', async (t) => {
  const root = await tempDirectory()
  t.after(() => rm(root, { recursive: true, force: true }))
  const blocked = join(root, 'not-a-directory')
  await writeFile(blocked, 'file')
  const node = await createAssetStorageNode(blocked)
  const asset = canonicalAsset(Buffer.from('cannot persist'))

  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].preserve(asset),
    AssetPersistenceError,
  )
  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].has(asset.id),
    AssetRetrievalError,
  )
  await node.dispose()
})

test('durable corruption is explicit and never returned as a valid Asset', async (t) => {
  const directory = await tempDirectory()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const node = await createAssetStorageNode(directory)
  const asset = canonicalAsset(Buffer.from('integrity'))

  await node.context[ASSET_STORAGE_SERVICE].preserve(asset)
  const file = await finalizedAssetFile(directory)
  const bytes = await readFile(file)
  const lastByte = bytes.length - 1
  bytes[lastByte] = bytes[lastByte]! ^ 0x01
  await writeFile(file, bytes)

  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].get(asset.id),
    AssetCorruptionError,
  )
  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].has(asset.id),
    AssetCorruptionError,
  )
  await node.dispose()
})

test('raw content oversize rejection occurs before hashing, resolution or visibility', async (t) => {
  const root = await tempDirectory()
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'never-created')
  const counter = { value: 0 }
  const node = await createAssetStorageNode(directory, counter)

  await assert.rejects(
    node.context[ASSET_STORAGE_SERVICE].preserve({
      id: 'a'.repeat(64),
      protocol: ASSET_CONTENT_PROTOCOL_REFERENCE,
      protocolHash: PROTOCOL_HASH,
      contentHash: 'b'.repeat(64),
      content: Buffer.alloc(MAX_ASSET_CONTENT_BYTES + 1),
    }),
    AssetContentTooLargeError,
  )

  assert.equal(counter.value, 0)
  await assert.rejects(readdir(directory), { code: 'ENOENT' })
  await node.dispose()
})
