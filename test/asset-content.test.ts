import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { plugin as assetContentPlugin } from '../src/protocols/asset.content.ts'
import {
  ASSET_CONTENT_PROTOCOL_REFERENCE,
  ASSET_CONTENT_PROTOCOL_SERVICE,
  AssetContentProtocolConfigError,
  AssetContentTooLargeError,
  InvalidAsset,
  MAX_ASSET_CONTENT_BYTES,
  ProtocolReferenceMismatchError,
  createRepositoryNode,
  type Asset,
} from '../src/index.ts'

const PROTOCOL_HASH = 'a'.repeat(64)
const OTHER_PROTOCOL_HASH = 'b'.repeat(64)

function doubleSha256Hex(bytes: Uint8Array): string {
  const first = createHash('sha256').update(bytes).digest()
  return createHash('sha256').update(first).digest('hex')
}

function canonicalAsset(
  content: Uint8Array,
  protocol = ASSET_CONTENT_PROTOCOL_REFERENCE,
  protocolHash = PROTOCOL_HASH,
): Asset {
  const bytes = Uint8Array.from(content)
  const contentHash = doubleSha256Hex(bytes)
  const id = doubleSha256Hex(
    Buffer.from(
      JSON.stringify({ contentHash, protocol, protocolHash }),
      'utf8',
    ),
  )
  return { id, protocol, protocolHash, contentHash, content: bytes }
}

async function createAssetNode(protocolHash = PROTOCOL_HASH) {
  return createRepositoryNode({
    plugins: [
      { plugin: assetContentPlugin, config: { protocolHash } },
    ],
  })
}

test('Protocol artifact entry exports exactly one named plugin', async () => {
  const namespace = await import('../src/protocols/asset.content.ts')
  assert.deepEqual(Object.keys(namespace), ['plugin'])
  assert.equal(namespace.plugin.name, ASSET_CONTENT_PROTOCOL_REFERENCE)
  assert.equal(namespace.plugin.provide, ASSET_CONTENT_PROTOCOL_SERVICE)
  assert.deepEqual(namespace.plugin.inject, [])
})

test('reproduces the fixed Asset identity vector bit-exactly', async () => {
  const node = await createAssetNode()
  const asset = node.context[ASSET_CONTENT_PROTOCOL_SERVICE].createAsset(
    Buffer.from('hello', 'utf8'),
  )

  assert.equal(
    asset.contentHash,
    '9595c9df90075148eb06860365df33584b75bff782a510c6cd4883a419833d50',
  )
  assert.equal(
    asset.id,
    '976dcb1a1b5ff72b6e09d72042f1f1c57dccebd2748729f78601ed2eba70a4b8',
  )
  assert.equal(asset.protocol, ASSET_CONTENT_PROTOCOL_REFERENCE)
  assert.equal(asset.protocolHash, PROTOCOL_HASH)

  await node.dispose()
})

test('same content and exact Protocol derive the same AssetId', async () => {
  const node = await createAssetNode()
  const service = node.context[ASSET_CONTENT_PROTOCOL_SERVICE]
  const first = service.createAsset(Buffer.from('same'))
  const second = service.createAsset(Buffer.from('same'))

  assert.equal(second.contentHash, first.contentHash)
  assert.equal(second.id, first.id)
  await node.dispose()
})

test('content or exact ProtocolHash changes Asset identity', async () => {
  const firstNode = await createAssetNode(PROTOCOL_HASH)
  const first = firstNode.context[ASSET_CONTENT_PROTOCOL_SERVICE].createAsset(
    Buffer.from('asset'),
  )
  const changedContent = firstNode.context[
    ASSET_CONTENT_PROTOCOL_SERVICE
  ].createAsset(Buffer.from('asseu'))
  await firstNode.dispose()

  const secondNode = await createAssetNode(OTHER_PROTOCOL_HASH)
  const changedProtocol = secondNode.context[
    ASSET_CONTENT_PROTOCOL_SERVICE
  ].createAsset(Buffer.from('asset'))

  assert.notEqual(changedContent.contentHash, first.contentHash)
  assert.notEqual(changedContent.id, first.id)
  assert.equal(changedProtocol.contentHash, first.contentHash)
  assert.notEqual(changedProtocol.id, first.id)
  await secondNode.dispose()
})

test('rejects wrong claimed contentHash before claimed AssetId', async () => {
  const node = await createAssetNode()
  const service = node.context[ASSET_CONTENT_PROTOCOL_SERVICE]
  const valid = service.createAsset(Buffer.from('identity'))

  assert.throws(
    () =>
      service.validateAsset({
        ...valid,
        contentHash: 'f'.repeat(64),
        id: 'e'.repeat(64),
      }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidAsset)
      assert.match(error.message, /contentHash/u)
      return true
    },
  )

  await node.dispose()
})

test('rejects wrong claimed AssetId as InvalidAsset', async () => {
  const node = await createAssetNode()
  const service = node.context[ASSET_CONTENT_PROTOCOL_SERVICE]
  const valid = service.createAsset(Buffer.from('identity'))

  assert.throws(
    () => service.validateAsset({ ...valid, id: 'f'.repeat(64) }),
    InvalidAsset,
  )
  await node.dispose()
})

test('rejects canonical-valid human reference mismatch through the Protocol path', async () => {
  const node = await createAssetNode()
  const service = node.context[ASSET_CONTENT_PROTOCOL_SERVICE]
  const mismatching = canonicalAsset(
    Buffer.from('reference'),
    'asset.other@0.1.0',
    PROTOCOL_HASH,
  )

  assert.throws(
    () => service.validateAsset(mismatching),
    ProtocolReferenceMismatchError,
  )
  await node.dispose()
})

test('accepts exactly 16 MiB and rejects 16 MiB + 1 deterministically', async () => {
  const node = await createAssetNode()
  const service = node.context[ASSET_CONTENT_PROTOCOL_SERVICE]

  const boundary = service.createAsset(Buffer.alloc(MAX_ASSET_CONTENT_BYTES))
  assert.equal(boundary.content.byteLength, MAX_ASSET_CONTENT_BYTES)

  assert.throws(
    () => service.createAsset(Buffer.alloc(MAX_ASSET_CONTENT_BYTES + 1)),
    AssetContentTooLargeError,
  )
  await node.dispose()
})

test('fails mount without an exact ProtocolHash', () => {
  assert.throws(
    () => assetContentPlugin.apply({} as never, { protocolHash: 'not-a-hash' }),
    AssetContentProtocolConfigError,
  )
})
