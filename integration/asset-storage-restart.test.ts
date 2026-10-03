import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
  CORE_PROTOCOL_PROTOCOL_SERVICE,
  MAX_ASSET_CONTENT_BYTES,
  RecordJournalService,
  assetStoragePlugin,
  createRepositoryNode,
  protocolResolutionPlugin,
  type Asset,
  type CoreProtocolService,
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

const host: ProtocolResolutionHost = {
  async resolveArtifact(protocolHash) {
    if (protocolHash !== PROTOCOL_HASH) return undefined
    return { protocol: descriptor(), artifact: ARTIFACT }
  },
  async evaluateRuntime() {
    return assetContentNamespace
  },
}

function doubleSha256Hex(bytes: Uint8Array): string {
  const first = createHash('sha256').update(bytes).digest()
  return createHash('sha256').update(first).digest('hex')
}

function canonicalAsset(content: Uint8Array): Asset {
  const bytes = Uint8Array.from(content)
  const contentHash = doubleSha256Hex(bytes)
  const protocol = ASSET_CONTENT_PROTOCOL_REFERENCE
  const protocolHash = PROTOCOL_HASH
  const id = doubleSha256Hex(
    Buffer.from(JSON.stringify({ contentHash, protocol, protocolHash }), 'utf8'),
  )
  return { id, protocol, protocolHash, contentHash, content: bytes }
}

function composition(assetDirectory: string, journalDirectory: string) {
  return [
    { plugin: assetStoragePlugin, config: { directory: assetDirectory } },
    { plugin: protocolResolutionPlugin, config: { host } },
    { plugin: coreProtocolProvider },
    { plugin: RecordJournalService, config: { directory: journalDirectory } },
  ]
}

test('Asset durability, duplicate/conflict semantics and Record joins survive restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-asset-restart-'))
  const assetDirectory = join(root, 'assets')
  const journalDirectory = join(root, 'records')

  try {
    const asset = canonicalAsset(Buffer.from('restart-exact-bytes'))
    const labourRecord = {
      id: 'labour-asset-join',
      protocol: 'labour.record@0.1.0',
      protocolHash: 'c'.repeat(64),
      createdBy: 'member-key',
      createdAt: '2026-10-03T00:00:00Z',
      signature: 'd'.repeat(128),
      data: {
        content: 'Use one durable AssetId from a labour Record',
        duration: 0.5,
        references: [asset.id],
        assets: [asset.id],
      },
    }

    const first = await createRepositoryNode({
      plugins: composition(assetDirectory, journalDirectory),
    })
    await first.context[ASSET_STORAGE_SERVICE].preserve(asset)
    await first.context.recordJournal.accept(labourRecord)
    await first.dispose()

    const second = await createRepositoryNode({
      plugins: composition(assetDirectory, journalDirectory),
    })
    const reopened = await second.context[ASSET_STORAGE_SERVICE].get(asset.id)
    assert.equal(reopened.id, asset.id)
    assert.deepEqual(reopened.content, asset.content)
    assert.equal(await second.context[ASSET_STORAGE_SERVICE].has(asset.id), true)

    const reopenedRecord = await second.context.recordJournal.get(labourRecord.id)
    const data = (reopenedRecord as typeof labourRecord).data
    assert.equal(data.references[0], reopened.id)
    assert.equal(data.assets[0], reopened.id)

    await second.context[ASSET_STORAGE_SERVICE].preserve(asset)

    const boundary = canonicalAsset(Buffer.alloc(MAX_ASSET_CONTENT_BYTES))
    await second.context[ASSET_STORAGE_SERVICE].preserve(boundary)
    assert.equal(
      await second.context[ASSET_STORAGE_SERVICE].has(boundary.id),
      true,
    )
    await assert.rejects(
      second.context[ASSET_STORAGE_SERVICE].preserve({
        id: 'a'.repeat(64),
        protocol: ASSET_CONTENT_PROTOCOL_REFERENCE,
        protocolHash: PROTOCOL_HASH,
        contentHash: 'b'.repeat(64),
        content: Buffer.alloc(MAX_ASSET_CONTENT_BYTES + 1),
      }),
      AssetContentTooLargeError,
    )
    await second.dispose()

    const file = join(assetDirectory, `${asset.id}.asset`)
    const persisted = await readFile(file)
    const lastByte = persisted.length - 1
    persisted[lastByte] = persisted[lastByte]! ^ 0x01
    await writeFile(file, persisted)
    const corrupted = await readFile(file)

    const third = await createRepositoryNode({
      plugins: composition(assetDirectory, journalDirectory),
    })
    await assert.rejects(
      third.context[ASSET_STORAGE_SERVICE].get(asset.id),
      AssetCorruptionError,
    )
    await assert.rejects(
      third.context[ASSET_STORAGE_SERVICE].preserve(asset),
      AssetIdentityConflict,
    )
    assert.deepEqual(await readFile(file), corrupted)
    await third.dispose()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
