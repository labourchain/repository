import { createHash } from 'node:crypto'

export const ASSET_CONTENT_PROTOCOL_NAME = 'asset.content' as const
export const ASSET_CONTENT_PROTOCOL_VERSION = '0.1.0' as const
export const ASSET_CONTENT_PROTOCOL_REFERENCE =
  `${ASSET_CONTENT_PROTOCOL_NAME}@${ASSET_CONTENT_PROTOCOL_VERSION}` as const
export const MAX_ASSET_CONTENT_BYTES = 16 * 1024 * 1024

const DIGEST_RE = /^[0-9a-f]{64}$/u
const ASSET_KEYS = [
  'id',
  'protocol',
  'protocolHash',
  'contentHash',
  'content',
] as const

export type AssetId = string
export type ContentHash = string

export interface Asset {
  readonly id: AssetId
  readonly protocol: string
  readonly protocolHash: string
  readonly contentHash: ContentHash
  readonly content: Uint8Array
}

export class AssetError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AssetError'
  }
}

export class AssetContentTooLargeError extends AssetError {
  readonly actualBytes: number
  readonly maxBytes = MAX_ASSET_CONTENT_BYTES

  constructor(actualBytes: number) {
    super(
      `Asset content exceeds the ${MAX_ASSET_CONTENT_BYTES} byte limit: ${actualBytes}`,
    )
    this.name = 'AssetContentTooLargeError'
    this.actualBytes = actualBytes
  }
}

export class InvalidAsset extends AssetError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'InvalidAsset'
  }
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function requireAssetObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidAsset('Asset must be a plain object.')
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new InvalidAsset('Asset must be a plain object.')
  }

  const ownKeys = Reflect.ownKeys(value)
  if (
    ownKeys.length !== ASSET_KEYS.length ||
    ownKeys.some(
      (key) => typeof key !== 'string' || !ASSET_KEYS.includes(key as never),
    )
  ) {
    throw new InvalidAsset('Asset contains unknown or missing fields.')
  }

  for (const key of ASSET_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !hasOwn(descriptor, 'value')
    ) {
      throw new InvalidAsset(
        `Asset.${key} must be an enumerable own data property.`,
      )
    }
  }

  return value as Record<string, unknown>
}

function requireRawContent(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new InvalidAsset('Asset.content must be a Uint8Array.')
  }
  if (value.byteLength > MAX_ASSET_CONTENT_BYTES) {
    throw new AssetContentTooLargeError(value.byteLength)
  }
  return value
}

function requireIncomingContent(value: unknown): Uint8Array {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidAsset('Asset must be a plain object.')
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, 'content')
  if (
    descriptor === undefined ||
    descriptor.enumerable !== true ||
    !hasOwn(descriptor, 'value')
  ) {
    throw new InvalidAsset(
      'Asset.content must be an enumerable own data property.',
    )
  }

  return requireRawContent(descriptor.value)
}

function copyContent(value: Uint8Array): Uint8Array {
  return Uint8Array.from(value)
}

function requireDigest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    throw new InvalidAsset(
      `${label} must be 64-character lowercase hexadecimal.`,
    )
  }
  return value
}

function requireIdentityString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidAsset(`${label} must be a non-empty string.`)
  }

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        throw new InvalidAsset(`${label} contains invalid Unicode data.`)
      }
      index += 1
      continue
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new InvalidAsset(`${label} contains invalid Unicode data.`)
    }
  }

  return value
}

function doubleSha256Hex(bytes: Uint8Array): string {
  const first = createHash('sha256').update(bytes).digest()
  return createHash('sha256').update(first).digest('hex')
}

function canonicalIdentity(
  protocol: string,
  protocolHash: string,
  contentHash: string,
): Uint8Array {
  // These three fixed string fields are already in RFC 8785 UTF-16 key order.
  // Keeping this serializer local avoids inventing a generic JCS layer merely
  // for the Asset identity shape.
  return Buffer.from(
    JSON.stringify({ contentHash, protocol, protocolHash }),
    'utf8',
  )
}

function derivedAssetId(
  protocol: string,
  protocolHash: string,
  contentHash: string,
): AssetId {
  return doubleSha256Hex(canonicalIdentity(protocol, protocolHash, contentHash))
}

function freezeAsset(asset: Asset): Asset {
  return Object.freeze(asset)
}

export function createAssetIdentity(
  content: Uint8Array,
  protocol: string,
  protocolHash: string,
): Asset {
  const bytes = copyContent(requireRawContent(content))
  const reference = requireIdentityString(protocol, 'Asset.protocol')
  const exactProtocolHash = requireDigest(
    protocolHash,
    'Asset.protocolHash',
  )
  const contentHash = doubleSha256Hex(bytes)

  return freezeAsset({
    id: derivedAssetId(reference, exactProtocolHash, contentHash),
    protocol: reference,
    protocolHash: exactProtocolHash,
    contentHash,
    content: bytes,
  })
}

/**
 * Validate only the deterministic Asset value and identity.
 *
 * Exact Protocol/reference resolution is deliberately performed by the Runtime
 * after this function succeeds, preserving the accepted validation order.
 */
export function validateAssetIdentity(value: unknown): Asset {
  // Step 1: inspect the raw content data property first so oversize content is
  // rejected before the remaining Asset shape, hashing or provider lookup.
  const rawContent = requireIncomingContent(value)
  const asset = requireAssetObject(value)
  const content = copyContent(rawContent)

  // Step 2: exact content integrity.
  const contentHash = requireDigest(asset.contentHash, 'Asset.contentHash')
  const calculatedContentHash = doubleSha256Hex(content)
  if (contentHash !== calculatedContentHash) {
    throw new InvalidAsset('Asset.contentHash does not match exact content bytes.')
  }

  // Step 3: AssetId integrity. Protocol/reference authority itself is checked
  // only after this identity step by exact Protocol resolution.
  const id = requireDigest(asset.id, 'Asset.id')
  const protocol = requireIdentityString(asset.protocol, 'Asset.protocol')
  const protocolHash = requireDigest(asset.protocolHash, 'Asset.protocolHash')
  const calculatedId = derivedAssetId(protocol, protocolHash, contentHash)
  if (id !== calculatedId) {
    throw new InvalidAsset('Asset.id does not match the derived AssetId.')
  }

  return freezeAsset({
    id,
    protocol,
    protocolHash,
    contentHash,
    content,
  })
}
