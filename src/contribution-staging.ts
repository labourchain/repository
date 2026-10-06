import { randomUUID } from 'node:crypto'
import {
  link,
  mkdir,
  open,
  readFile,
  readdir,
  unlink,
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import {
  validateAssetIdentity,
  type Asset,
} from './asset-identity.ts'
import type { ContributionRequest } from './contribution.ts'
import type { CoreRecordValue } from './member.ts'

export const CONTRIBUTION_STAGING_SERVICE = 'contributionStaging' as const
export const CONTRIBUTION_STAGING_PLUGIN_NAME =
  'runtime.contribution-staging' as const

const STAGED_FILE_SUFFIX = '.contribution.json'
const STAGED_KEYS = ['asset', 'labourRecord', 'acceptanceRecord'] as const
const STAGED_ASSET_KEYS = [
  'id',
  'protocol',
  'protocolHash',
  'contentHash',
  'content',
] as const

export interface ContributionStagingConfig {
  readonly directory: string
}

export class ContributionStagingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ContributionStagingError'
  }
}

export class ContributionStagingInputError extends ContributionStagingError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ContributionStagingInputError'
  }
}

export class ContributionStagingConflictError extends ContributionStagingError {
  readonly acceptanceRecordId: string

  constructor(acceptanceRecordId: string) {
    super(
      'A non-equivalent staged request already exists for acceptance RecordId: ' +
        acceptanceRecordId,
    )
    this.name = 'ContributionStagingConflictError'
    this.acceptanceRecordId = acceptanceRecordId
  }
}

export class ContributionStagingCorruptionError
  extends ContributionStagingError {
  readonly file: string

  constructor(file: string, message: string, options?: ErrorOptions) {
    super(`${message}: ${file}`, options)
    this.name = 'ContributionStagingCorruptionError'
    this.file = file
  }
}

export class ContributionStagingStorageError extends ContributionStagingError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ContributionStagingStorageError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    contributionStaging: ContributionStagingService
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }
  const code = (error as NodeJS.ErrnoException).code
  return typeof code === 'string' ? code : undefined
}

function requireRecordId(value: unknown, label: string): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContributionStagingInputError(label + ' must be an object.')
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, 'id')
  if (
    descriptor === undefined ||
    !('value' in descriptor) ||
    typeof descriptor.value !== 'string' ||
    descriptor.value.length === 0
  ) {
    throw new ContributionStagingInputError(
      label + ' must contain a non-empty own data-property id.',
    )
  }
  return descriptor.value
}

function snapshotRecord(
  value: CoreRecordValue,
  label: string,
): CoreRecordValue {
  let serialized: string
  try {
    const result = JSON.stringify(value)
    if (result === undefined) throw new TypeError('serialization returned undefined')
    serialized = result
  } catch (cause) {
    throw new ContributionStagingInputError(
      label + ' cannot be persisted as exact JSON.',
      { cause },
    )
  }

  const snapshot = JSON.parse(serialized) as CoreRecordValue
  requireRecordId(snapshot, label)
  if (!isDeepStrictEqual(snapshot, value)) {
    throw new ContributionStagingInputError(
      label + ' is not exactly representable as durable JSON.',
    )
  }
  return snapshot
}

function stagedFilename(acceptanceRecordId: string): string {
  return (
    Buffer.from(acceptanceRecordId, 'utf8').toString('hex') +
    STAGED_FILE_SUFFIX
  )
}

function compareNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
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

function snapshotRequest(request: ContributionRequest): ContributionRequest {
  const asset = validateAssetIdentity(request.asset)
  const labourRecord = snapshotRecord(request.labourRecord, 'labourRecord')
  const acceptanceRecord = snapshotRecord(
    request.acceptanceRecord,
    'acceptanceRecord',
  )
  requireRecordId(acceptanceRecord, 'acceptanceRecord')

  return Object.freeze({
    asset,
    labourRecord,
    acceptanceRecord,
  })
}

function serializeRequest(request: ContributionRequest): string {
  return (
    JSON.stringify({
      asset: {
        id: request.asset.id,
        protocol: request.asset.protocol,
        protocolHash: request.asset.protocolHash,
        contentHash: request.asset.contentHash,
        content: Buffer.from(request.asset.content).toString('base64'),
      },
      labourRecord: request.labourRecord,
      acceptanceRecord: request.acceptanceRecord,
    }) + '\n'
  )
}

function requireExactKeys(
  value: unknown,
  expected: readonly string[],
  file: string,
  label: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContributionStagingCorruptionError(
      file,
      label + ' is not an object',
    )
  }
  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== expected.length ||
    keys.some(
      (key) =>
        typeof key !== 'string' ||
        !expected.includes(key),
    )
  ) {
    throw new ContributionStagingCorruptionError(
      file,
      label + ' contains unknown or missing fields',
    )
  }
  return value as Record<string, unknown>
}

function parseRequest(serialized: string, file: string): ContributionRequest {
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch (cause) {
    throw new ContributionStagingCorruptionError(
      file,
      'Staged contribution is not valid JSON',
      { cause },
    )
  }

  const payload = requireExactKeys(
    value,
    STAGED_KEYS,
    file,
    'Staged contribution',
  )
  const storedAsset = requireExactKeys(
    payload.asset,
    STAGED_ASSET_KEYS,
    file,
    'Staged Asset',
  )

  if (typeof storedAsset.content !== 'string') {
    throw new ContributionStagingCorruptionError(
      file,
      'Staged Asset content is not base64 text',
    )
  }
  const content = Buffer.from(storedAsset.content, 'base64')
  if (content.toString('base64') !== storedAsset.content) {
    throw new ContributionStagingCorruptionError(
      file,
      'Staged Asset content is not canonical base64',
    )
  }

  let asset: Asset
  try {
    asset = validateAssetIdentity({
      id: storedAsset.id,
      protocol: storedAsset.protocol,
      protocolHash: storedAsset.protocolHash,
      contentHash: storedAsset.contentHash,
      content: Uint8Array.from(content),
    })
  } catch (cause) {
    throw new ContributionStagingCorruptionError(
      file,
      'Staged Asset identity is invalid',
      { cause },
    )
  }

  let labourRecord: CoreRecordValue
  let acceptanceRecord: CoreRecordValue
  try {
    labourRecord = snapshotRecord(
      payload.labourRecord as CoreRecordValue,
      'labourRecord',
    )
    acceptanceRecord = snapshotRecord(
      payload.acceptanceRecord as CoreRecordValue,
      'acceptanceRecord',
    )
  } catch (cause) {
    throw new ContributionStagingCorruptionError(
      file,
      'Staged Record payload is invalid',
      { cause },
    )
  }

  return Object.freeze({
    asset,
    labourRecord,
    acceptanceRecord,
  })
}

/**
 * Durable Repo-local staging for one exact supplied contribution request.
 *
 * The acceptance RecordId is only the local lookup key. Staging is mutable
 * operational state and never becomes Repository acceptance or Protocol truth.
 */
export class ContributionStagingService {
  readonly directory: string

  constructor(config: ContributionStagingConfig) {
    if (
      !config ||
      typeof config.directory !== 'string' ||
      config.directory.length === 0
    ) {
      throw new ContributionStagingInputError(
        'Contribution staging requires a non-empty persistent directory.',
      )
    }
    this.directory = resolve(config.directory)
  }

  async stage(request: ContributionRequest): Promise<void> {
    const snapshot = snapshotRequest(request)
    const acceptanceRecordId = requireRecordId(
      snapshot.acceptanceRecord,
      'acceptanceRecord',
    )
    const serialized = serializeRequest(snapshot)

    try {
      await mkdir(this.directory, { recursive: true })
    } catch (cause) {
      throw new ContributionStagingStorageError(
        'Unable to prepare contribution staging directory: ' + this.directory,
        { cause },
      )
    }

    const target = join(
      this.directory,
      stagedFilename(acceptanceRecordId),
    )
    const temporary = join(
      this.directory,
      `.contribution-${process.pid}-${randomUUID()}.tmp`,
    )
    let handle: Awaited<ReturnType<typeof open>> | undefined

    try {
      handle = await open(temporary, 'wx', 0o600)
      await handle.writeFile(serialized, 'utf8')
      await handle.sync()
      await handle.close()
      handle = undefined

      try {
        await link(temporary, target)
      } catch (cause) {
        if (errorCode(cause) !== 'EEXIST') {
          throw new ContributionStagingStorageError(
            'Unable to publish staged contribution ' +
              acceptanceRecordId +
              '.',
            { cause },
          )
        }

        const existing = await this.readStored(target)
        if (!isDeepStrictEqual(existing, snapshot)) {
          throw new ContributionStagingConflictError(acceptanceRecordId)
        }
        await this.syncPublication(acceptanceRecordId)
        return
      }

      await this.syncPublication(acceptanceRecordId)
    } catch (cause) {
      if (cause instanceof ContributionStagingError) throw cause
      throw new ContributionStagingStorageError(
        'Unable to durably stage contribution ' +
          acceptanceRecordId +
          '.',
        { cause },
      )
    } finally {
      if (handle) await handle.close().catch(() => undefined)
      await unlink(temporary).catch(() => undefined)
    }
  }

  async *iterateStaged(): AsyncIterableIterator<ContributionRequest> {
    let entries
    try {
      entries = await readdir(this.directory, { withFileTypes: true })
    } catch (cause) {
      if (errorCode(cause) === 'ENOENT') return
      throw new ContributionStagingStorageError(
        'Unable to enumerate contribution staging directory: ' +
          this.directory,
        { cause },
      )
    }

    const files = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(STAGED_FILE_SUFFIX),
      )
      .map((entry) => entry.name)
      .sort(compareNames)

    for (const name of files) {
      const file = join(this.directory, name)
      const request = await this.readStored(file)
      const acceptanceRecordId = requireRecordId(
        request.acceptanceRecord,
        'acceptanceRecord',
      )
      if (stagedFilename(acceptanceRecordId) !== name) {
        throw new ContributionStagingCorruptionError(
          file,
          'Staged acceptance RecordId does not match its filename',
        )
      }
      yield request
    }
  }

  async remove(acceptanceRecordId: string): Promise<void> {
    if (
      typeof acceptanceRecordId !== 'string' ||
      acceptanceRecordId.length === 0
    ) {
      throw new ContributionStagingInputError(
        'Staging lookup key must be a non-empty acceptance RecordId.',
      )
    }
    const target = join(
      this.directory,
      stagedFilename(acceptanceRecordId),
    )

    try {
      await unlink(target)
    } catch (cause) {
      if (errorCode(cause) === 'ENOENT') return
      throw new ContributionStagingStorageError(
        'Unable to remove staged contribution ' +
          acceptanceRecordId +
          '.',
        { cause },
      )
    }

    try {
      await syncDirectory(this.directory)
    } catch (cause) {
      throw new ContributionStagingStorageError(
        'Unable to sync contribution staging after removing ' +
          acceptanceRecordId +
          '.',
        { cause },
      )
    }
  }

  private async readStored(file: string): Promise<ContributionRequest> {
    let serialized: string
    try {
      serialized = await readFile(file, 'utf8')
    } catch (cause) {
      throw new ContributionStagingStorageError(
        'Unable to read staged contribution: ' + file,
        { cause },
      )
    }
    return parseRequest(serialized, file)
  }

  private async syncPublication(
    acceptanceRecordId: string,
  ): Promise<void> {
    try {
      await syncDirectory(this.directory)
    } catch (cause) {
      throw new ContributionStagingStorageError(
        'Unable to sync contribution staging after publishing ' +
          acceptanceRecordId +
          '.',
        { cause },
      )
    }
  }
}

export const contributionStagingPlugin = {
  name: CONTRIBUTION_STAGING_PLUGIN_NAME,
  provide: CONTRIBUTION_STAGING_SERVICE,
  inject: [],
  apply(ctx: Context, config: ContributionStagingConfig): void {
    ctx.provide(
      CONTRIBUTION_STAGING_SERVICE,
      new ContributionStagingService(config),
    )
  },
}
