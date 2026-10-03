import type { Context } from '@deepseek-ai/cordis'
import { ProtocolReferenceMismatchError } from './protocol-resolution.ts'
import {
  ASSET_CONTENT_PROTOCOL_REFERENCE,
  InvalidAsset,
  createAssetIdentity,
  validateAssetIdentity,
  type Asset,
} from './asset-identity.ts'

export {
  ASSET_CONTENT_PROTOCOL_NAME,
  ASSET_CONTENT_PROTOCOL_REFERENCE,
  ASSET_CONTENT_PROTOCOL_VERSION,
  MAX_ASSET_CONTENT_BYTES,
  AssetContentTooLargeError,
  AssetError,
  InvalidAsset,
  type Asset,
  type AssetId,
  type ContentHash,
} from './asset-identity.ts'

export const ASSET_CONTENT_PROTOCOL_SERVICE =
  `protocol:${ASSET_CONTENT_PROTOCOL_REFERENCE}` as const

const DIGEST_RE = /^[0-9a-f]{64}$/u

export interface AssetContentMountConfig {
  readonly protocolHash: string
}

export interface AssetContentProtocolService {
  readonly protocolHash: string
  createAsset(content: Uint8Array): Asset
  validateAsset(value: unknown): Asset
}

export class AssetContentProtocolConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssetContentProtocolConfigError'
  }
}

function requireProtocolHash(config: AssetContentMountConfig): string {
  if (
    !config ||
    typeof config.protocolHash !== 'string' ||
    !DIGEST_RE.test(config.protocolHash)
  ) {
    throw new AssetContentProtocolConfigError(
      'asset.content requires the exact resolved ProtocolHash from the Host.',
    )
  }
  return config.protocolHash
}

export class AssetContentService implements AssetContentProtocolService {
  readonly protocolHash: string

  constructor(protocolHash: string) {
    this.protocolHash = protocolHash
  }

  createAsset(content: Uint8Array): Asset {
    return createAssetIdentity(
      content,
      ASSET_CONTENT_PROTOCOL_REFERENCE,
      this.protocolHash,
    )
  }

  validateAsset(value: unknown): Asset {
    const asset = validateAssetIdentity(value)

    if (asset.protocol !== ASSET_CONTENT_PROTOCOL_REFERENCE) {
      throw new ProtocolReferenceMismatchError(
        ASSET_CONTENT_PROTOCOL_REFERENCE,
        asset.protocol,
      )
    }
    if (asset.protocolHash !== this.protocolHash) {
      throw new InvalidAsset(
        'Asset.protocolHash does not match this exact asset.content implementation.',
      )
    }

    return asset
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    'protocol:asset.content@0.1.0': AssetContentService
  }
}

export function createAssetContentProtocolPlugin() {
  return {
    name: ASSET_CONTENT_PROTOCOL_REFERENCE,
    provide: ASSET_CONTENT_PROTOCOL_SERVICE,
    inject: [] as string[],
    apply(ctx: Context, config: AssetContentMountConfig): void {
      const protocolHash = requireProtocolHash(config)
      ctx.provide(
        ASSET_CONTENT_PROTOCOL_SERVICE,
        new AssetContentService(protocolHash),
      )
    },
  }
}
