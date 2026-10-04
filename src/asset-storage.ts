import { randomUUID } from 'node:crypto'
import { link, mkdir, open, readFile, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import {
  ASSET_CONTENT_PROTOCOL_REFERENCE,
  type AssetContentProtocolService,
} from './asset-content.ts'
import {
  InvalidAsset,
  validateAssetIdentity,
  type Asset,
} from './asset-identity.ts'
import {
  PROTOCOL_RESOLUTION_SERVICE,
  ProtocolReferenceMismatchError,
} from './protocol-resolution.ts'

export const ASSET_STORAGE_SERVICE = 'assetStorage' as const
export const ASSET_STORAGE_PLUGIN_NAME = 'runtime.asset-storage' as const

const ASSET_FILE_SUFFIX = '.asset'
const DIGEST_RE = /^[0-9a-f]{64}$/u
const STORED_DESCRIPTOR_KEYS = [
  'id',
  'protocol',
  'protocolHash',
  'contentHash',
] as const

export interface AssetStorageConfig {
  /** Persistent directory used by this Asset provider instance. */
  readonly directory: string
}

export class AssetStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AssetStorageError'
  }
}

export class AssetStorageConfigError extends AssetStorageError {
  constructor(message: string) {
    super(message)
    this.name = 'AssetStorageConfigError'
  }
}

export class AssetNotFoundError extends AssetStorageError {
  readonly assetId: string

  constructor(assetId: string) {
    super(`Asset is not present in durable storage: ${assetId}`)
    this.name = 'AssetNotFoundError'
    this.assetId = assetId
  }
}

export class AssetIdentityConflict extends AssetStorageError {
  readonly assetId: string

  constructor(assetId: string, options?: ErrorOptions) {
    super(
      `Durable Asset state conflicts with canonical AssetId: ${assetId}`,
      options,
    )
    this.name = 'AssetIdentityConflict'
    this.assetId = assetId
  }
}

export class AssetPersistenceError extends AssetStorageError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AssetPersistenceError'
  }
}

export class AssetRetrievalError extends AssetStorageError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AssetRetrievalError'
  }
}

export class AssetCorruptionError extends AssetStorageError {
  readonly file: string

  constructor(file: string, message: string, options?: ErrorOptions) {
    super(`${message}: ${file}`, options)
    this.name = 'AssetCorruptionError'
    this.file = file
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    assetStorage: AssetStorageService
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }
  const code = (error as NodeJS.ErrnoException).code
  return typeof code === 'string' ? code : undefined
}

function requireAssetId(assetId: string): string {
  if (typeof assetId !== 'string' || !DIGEST_RE.test(assetId)) {
    throw new InvalidAsset(
      'AssetId lookup key must be 64-character lowercase hexadecimal.',
    )
  }
  return assetId
}

function assetFilename(assetId: string): string {
  return `${assetId}${ASSET_FILE_SUFFIX}`
}

async function syncDirectory(directory: string): Promise<void> {
  if (process.platform === 'win32') return

  const handle = await open(directory, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function serializeAsset(asset: Asset): Uint8Array {
  const descriptor = Buffer.from(
    `${JSON.stringify({
      id: asset.id,
      protocol: asset.protocol,
      protocolHash: asset.protocolHash,
      contentHash: asset.contentHash,
    })}\n`,
    'utf8',
  )
  return Buffer.concat([descriptor, Buffer.from(asset.content)])
}

function parseStoredDescriptor(
  value: unknown,
  file: string,
): Omit<Asset, 'content'> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AssetCorruptionError(file, 'Stored Asset descriptor is not an object')
  }

  const ownKeys = Reflect.ownKeys(value)
  if (
    ownKeys.length !== STORED_DESCRIPTOR_KEYS.length ||
    ownKeys.some(
      (key) =>
        typeof key !== 'string' ||
        !STORED_DESCRIPTOR_KEYS.includes(key as never),
    )
  ) {
    throw new AssetCorruptionError(
      file,
      'Stored Asset descriptor contains unknown or missing fields',
    )
  }

  const descriptor = value as Record<string, unknown>
  for (const key of STORED_DESCRIPTOR_KEYS) {
    if (typeof descriptor[key] !== 'string') {
      throw new AssetCorruptionError(
        file,
        `Stored Asset descriptor field ${key} is not a string`,
      )
    }
  }

  return {
    id: descriptor.id as string,
    protocol: descriptor.protocol as string,
    protocolHash: descriptor.protocolHash as string,
    contentHash: descriptor.contentHash as string,
  }
}

function parseStoredAsset(bytes: Uint8Array, file: string): Asset {
  const buffer = Buffer.from(bytes)
  const separator = buffer.indexOf(0x0a)
  if (separator <= 0) {
    throw new AssetCorruptionError(
      file,
      'Stored Asset does not contain a complete descriptor boundary',
    )
  }

  let descriptorValue: unknown
  try {
    descriptorValue = JSON.parse(buffer.subarray(0, separator).toString('utf8'))
  } catch (cause) {
    throw new AssetCorruptionError(
      file,
      'Stored Asset descriptor is not valid JSON',
      { cause },
    )
  }

  const descriptor = parseStoredDescriptor(descriptorValue, file)
  const candidate = {
    ...descriptor,
    content: Uint8Array.from(buffer.subarray(separator + 1)),
  }

  try {
    return validateAssetIdentity(candidate)
  } catch (cause) {
    throw new AssetCorruptionError(
      file,
      'Stored Asset identity or content integrity is invalid',
      { cause },
    )
  }
}

function requireAssetProtocolService(value: unknown): AssetContentProtocolService {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Partial<AssetContentProtocolService>).validateAsset !==
      'function'
  ) {
    throw new AssetStorageError(
      `Resolved ${ASSET_CONTENT_PROTOCOL_REFERENCE} service does not expose validateAsset().`,
    )
  }
  return value as AssetContentProtocolService
}

/**
 * Minimum durable provider for complete immutable Assets.
 *
 * It owns only Asset bytes/state. Repository acceptance, Record durability,
 * lineage, Block confirmation and generic object-store behavior stay outside
 * this service.
 */
export class AssetStorageService {
  readonly directory: string
  private readonly ctx: Context

  constructor(ctx: Context, config: AssetStorageConfig) {
    if (!config || typeof config.directory !== 'string' || config.directory.length === 0) {
      throw new AssetStorageConfigError(
        'Asset storage requires a non-empty persistent directory.',
      )
    }

    this.ctx = ctx
    this.directory = resolve(config.directory)
  }

  /** Preserve one canonical-valid Asset without overwriting durable state. */
  async preserve(value: unknown): Promise<void> {
    // Steps 1-3: resource, contentHash and AssetId validation happen before
    // exact Protocol resolution and before touching durable provider state.
    const identity = validateAssetIdentity(value)

    // Step 4: exact ProtocolHash/reference authority comes from #7 resolution.
    const asset = await this.validateExactProtocol(identity)

    try {
      await mkdir(this.directory, { recursive: true })
    } catch (cause) {
      throw new AssetPersistenceError(
        `Unable to prepare Asset storage directory: ${this.directory}`,
        { cause },
      )
    }

    const target = join(this.directory, assetFilename(asset.id))
    const temporary = join(
      this.directory,
      `.asset-${process.pid}-${randomUUID()}.tmp`,
    )
    const serialized = serializeAsset(asset)
    let handle: Awaited<ReturnType<typeof open>> | undefined

    try {
      handle = await open(temporary, 'wx', 0o600)
      await handle.writeFile(serialized)
      await handle.sync()
      await handle.close()
      handle = undefined

      try {
        // Atomic non-overwriting publication: incomplete temporary data never
        // uses the finalized Asset filename observed by get()/has().
        await link(temporary, target)
      } catch (cause) {
        if (errorCode(cause) !== 'EEXIST') {
          throw new AssetPersistenceError(
            `Unable to publish Asset ${asset.id}.`,
            { cause },
          )
        }

        let existing: Asset
        try {
          existing = await this.readStored(asset.id, target, false)
        } catch (readCause) {
          if (readCause instanceof AssetCorruptionError) {
            throw new AssetIdentityConflict(asset.id, { cause: readCause })
          }
          throw new AssetPersistenceError(
            `Unable to verify existing durable Asset ${asset.id}.`,
            { cause: readCause },
          )
        }

        if (!isDeepStrictEqual(existing, asset)) {
          throw new AssetIdentityConflict(asset.id)
        }

        // A prior attempt may have published the finalized file but failed
        // before syncing the directory. Retry completes that durability edge.
        await this.syncPublication(asset.id)
        return
      }

      await this.syncPublication(asset.id)
    } catch (cause) {
      if (cause instanceof AssetStorageError) throw cause
      throw new AssetPersistenceError(
        `Unable to durably preserve Asset ${asset.id}.`,
        { cause },
      )
    } finally {
      if (handle) {
        await handle.close().catch(() => undefined)
      }
      await unlink(temporary).catch(() => undefined)
    }
  }

  /** Retrieve one complete, revalidated Asset by AssetId. */
  async get(assetId: string): Promise<Asset> {
    const id = requireAssetId(assetId)
    const target = join(this.directory, assetFilename(id))
    return this.readStored(id, target, true)
  }

  /** True only when a complete, valid, retrievable Asset exists. */
  async has(assetId: string): Promise<boolean> {
    try {
      await this.get(assetId)
      return true
    } catch (cause) {
      if (cause instanceof AssetNotFoundError) return false
      throw cause
    }
  }

  private async validateExactProtocol(asset: Asset): Promise<Asset> {
    const resolved = await this.ctx[PROTOCOL_RESOLUTION_SERVICE].resolve(
      asset.protocol,
      asset.protocolHash,
    )

    if (resolved.reference !== ASSET_CONTENT_PROTOCOL_REFERENCE) {
      throw new ProtocolReferenceMismatchError(
        ASSET_CONTENT_PROTOCOL_REFERENCE,
        resolved.reference,
      )
    }

    const service = requireAssetProtocolService(this.ctx.get(resolved.service))
    return service.validateAsset(asset)
  }

  private async readStored(
    assetId: string,
    target: string,
    missingIsNotFound: boolean,
  ): Promise<Asset> {
    let bytes: Uint8Array
    try {
      bytes = await readFile(target)
    } catch (cause) {
      if (missingIsNotFound && errorCode(cause) === 'ENOENT') {
        throw new AssetNotFoundError(assetId)
      }
      throw new AssetRetrievalError(
        `Unable to read Asset ${assetId} from durable storage.`,
        { cause },
      )
    }

    const asset = parseStoredAsset(bytes, target)
    if (asset.id !== assetId) {
      throw new AssetCorruptionError(
        target,
        `Stored AssetId ${asset.id} does not match requested AssetId ${assetId}`,
      )
    }

    try {
      return await this.validateExactProtocol(asset)
    } catch (cause) {
      if (
        cause instanceof InvalidAsset ||
        cause instanceof ProtocolReferenceMismatchError
      ) {
        throw new AssetCorruptionError(
          target,
          'Stored Asset no longer satisfies its exact Protocol identity',
          { cause },
        )
      }
      throw new AssetRetrievalError(
        `Unable to verify exact Protocol semantics for durable Asset ${assetId}.`,
        { cause },
      )
    }
  }

  private async syncPublication(assetId: string): Promise<void> {
    try {
      await syncDirectory(this.directory)
    } catch (cause) {
      throw new AssetPersistenceError(
        `Unable to sync Asset storage directory after preserving ${assetId}.`,
        { cause },
      )
    }
  }
}

export const assetStoragePlugin = {
  name: ASSET_STORAGE_PLUGIN_NAME,
  provide: ASSET_STORAGE_SERVICE,
  inject: [PROTOCOL_RESOLUTION_SERVICE],
  apply(ctx: Context, config: AssetStorageConfig): void {
    ctx.provide(
      ASSET_STORAGE_SERVICE,
      new AssetStorageService(ctx, config),
    )
  },
}
