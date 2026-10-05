import { isDeepStrictEqual } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import {
  ASSET_CONTENT_PROTOCOL_REFERENCE,
  type AssetContentProtocolService,
} from './asset-content.ts'
import {
  ASSET_STORAGE_SERVICE,
  AssetIdentityConflict,
} from './asset-storage.ts'
import {
  validateAssetIdentity,
  type Asset,
} from './asset-identity.ts'
import {
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  type LabourRecordService,
} from './labour-record.ts'
import type { CoreRecordValue } from './member.ts'
import {
  PROTOCOL_RESOLUTION_SERVICE,
  ProtocolBuildConflictError,
  ProtocolReferenceMismatchError,
} from './protocol-resolution.ts'
import {
  REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
  type RepoContributionProtocolService,
  type RepoContributionView,
  type ValidatedRepoContributionRecord,
} from './repo-contribution.ts'
import {
  RecordJournalNotFoundError,
  type JournalRecord,
} from './record-journal.ts'
import {
  RUNTIME_RECORD_DATABASE_SERVICE,
  type RuntimeRecordDatabaseSession,
} from './runtime-record-database.ts'
import {
  RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE,
} from './internal-publication.ts'

export const REPOSITORY_CONTRIBUTION_SERVICE =
  'repositoryContribution' as const
export const REPOSITORY_CONTRIBUTION_PLUGIN_NAME =
  'runtime.repository-contribution' as const

export interface ContributionRequest {
  readonly asset: Asset
  readonly labourRecord: CoreRecordValue
  readonly acceptanceRecord: CoreRecordValue
}

export interface RepositoryContributionCommit extends RepoContributionView {
  readonly status: 'COMMITTED'
}

export class RepositoryContributionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepositoryContributionError'
  }
}

export class RepositoryContributionProtocolError
  extends RepositoryContributionError {
  constructor(message: string) {
    super(message)
    this.name = 'RepositoryContributionProtocolError'
  }
}

export class RepositoryContributionAssetMismatchError
  extends RepositoryContributionError {
  readonly expectedAssetId: string
  readonly actualAssetId: string | undefined

  constructor(expectedAssetId: string, actualAssetId: string | undefined) {
    super(
      'Submitted selected AssetId does not match Repo acceptance: expected ' +
        expectedAssetId +
        ', got ' +
        (actualAssetId ?? '<missing>'),
    )
    this.name = 'RepositoryContributionAssetMismatchError'
    this.expectedAssetId = expectedAssetId
    this.actualAssetId = actualAssetId
  }
}

export class RepositoryContributionConflictError
  extends RepositoryContributionError {
  readonly repoIdentity: string
  readonly labourRecordId: string
  readonly assetId: string
  readonly acceptedRecordId: string
  readonly candidateRecordId: string

  constructor(
    candidate: ValidatedRepoContributionRecord,
    acceptedRecordId: string,
  ) {
    super(
      'A distinct Repo contribution acceptance already exists for the logical key: ' +
        acceptedRecordId,
    )
    this.name = 'RepositoryContributionConflictError'
    this.repoIdentity = candidate.createdBy
    this.labourRecordId = candidate.data.labourRecordId
    this.assetId = candidate.data.assetId
    this.acceptedRecordId = acceptedRecordId
    this.candidateRecordId = candidate.id
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    repositoryContribution: RepositoryContributionService
  }
}

function requireProtocolHash(record: CoreRecordValue): string {
  if (
    typeof record !== 'object' ||
    record === null ||
    typeof record.protocolHash !== 'string'
  ) {
    throw new RepositoryContributionProtocolError(
      'Contribution acceptance Record must expose an exact ProtocolHash.',
    )
  }
  return record.protocolHash
}

function requireSelectedAssetId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const id = (value as { readonly id?: unknown }).id
  return typeof id === 'string' ? id : undefined
}

function requireAssetProtocolService(
  value: unknown,
): AssetContentProtocolService {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Partial<AssetContentProtocolService>).validateAsset !==
      'function'
  ) {
    throw new RepositoryContributionProtocolError(
      'Resolved asset.content service does not expose semantic validation.',
    )
  }
  return value as AssetContentProtocolService
}

function requireLabourRecordService(
  value: unknown,
): LabourRecordService {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Partial<LabourRecordService>)
      .acceptLabourRecord !== 'function'
  ) {
    throw new RepositoryContributionProtocolError(
      'Resolved labour.record service does not expose durable acceptance.',
    )
  }
  return value as LabourRecordService
}

function requireProtocolService(value: unknown): RepoContributionProtocolService {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Partial<RepoContributionProtocolService>)
      .validateAcceptance !== 'function' ||
    typeof (value as Partial<RepoContributionProtocolService>)
      .validateRelation !== 'function'
  ) {
    throw new RepositoryContributionProtocolError(
      'Resolved repo.contribution service does not expose the required semantic validators.',
    )
  }
  return value as RepoContributionProtocolService
}

function isContributionCandidate(
  record: JournalRecord,
): boolean {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return false
  }
  const candidate = record as Partial<CoreRecordValue>
  return candidate.protocol === REPO_CONTRIBUTION_PROTOCOL_REFERENCE
}

function requireDurableContributionProtocolHash(
  record: JournalRecord,
): string {
  const protocolHash = (record as Partial<CoreRecordValue>).protocolHash
  if (
    typeof protocolHash !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(protocolHash)
  ) {
    throw new RepositoryContributionProtocolError(
      'Durable repo.contribution Record has an invalid ProtocolHash: ' +
        record.id,
    )
  }
  return protocolHash
}

function sameLogicalKey(
  left: ValidatedRepoContributionRecord,
  right: ValidatedRepoContributionRecord,
): boolean {
  return (
    left.createdBy === right.createdBy &&
    left.data.labourRecordId === right.data.labourRecordId &&
    left.data.assetId === right.data.assetId
  )
}

function committed(view: RepoContributionView): RepositoryContributionCommit {
  return Object.freeze({
    status: 'COMMITTED',
    ...view,
  })
}

export class RepositoryContributionService {
  private readonly ctx: Context

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  async commit(
    request: ContributionRequest,
  ): Promise<RepositoryContributionCommit> {
    const resolver = this.ctx[PROTOCOL_RESOLUTION_SERVICE]
    const protocolHash = requireProtocolHash(request.acceptanceRecord)
    const validated = await resolver.withExactService(
      REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
      protocolHash,
      async (service) => {
        const protocol = requireProtocolService(service)
        const acceptance = await protocol.validateAcceptance(
          request.acceptanceRecord,
        )
        const relation = await protocol.validateRelation(
          acceptance,
          request.labourRecord,
        )
        return { acceptance, relation }
      },
    )
    const { acceptance, relation } = validated

    const selectedAssetId = requireSelectedAssetId(request.asset)
    if (selectedAssetId !== relation.assetId) {
      throw new RepositoryContributionAssetMismatchError(
        relation.assetId,
        selectedAssetId,
      )
    }

    const incomingAsset = validateAssetIdentity(request.asset)
    if (incomingAsset.protocol !== ASSET_CONTENT_PROTOCOL_REFERENCE) {
      throw new ProtocolReferenceMismatchError(
        ASSET_CONTENT_PROTOCOL_REFERENCE,
        incomingAsset.protocol,
      )
    }
    await resolver.withExactService(
      ASSET_CONTENT_PROTOCOL_REFERENCE,
      incomingAsset.protocolHash,
      (service) => {
        requireAssetProtocolService(service).validateAsset(incomingAsset)
      },
    )

    const replay = await this.loadExactReplay(acceptance, protocolHash)
    if (replay !== undefined) {
      const durableAsset = await this.ctx[ASSET_STORAGE_SERVICE].get(
        replay.assetId,
      )
      if (!isDeepStrictEqual(durableAsset, incomingAsset)) {
        throw new AssetIdentityConflict(replay.assetId)
      }
      return committed(replay)
    }

    await this.ctx[ASSET_STORAGE_SERVICE].preserve(incomingAsset)
    await this.ctx[ASSET_STORAGE_SERVICE].get(relation.assetId)

    const labourProtocolHash = requireProtocolHash(request.labourRecord)
    await resolver.withExactService(
      LABOUR_RECORD_PROTOCOL_REFERENCE,
      labourProtocolHash,
      async (service) => {
        const labourProtocol = requireLabourRecordService(service)
        await labourProtocol.acceptLabourRecord(request.labourRecord)
      },
    )

    await resolver.withExactService(
      REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
      protocolHash,
      async (service) => {
        const protocol = requireProtocolService(service)
        await this.ctx[RUNTIME_RECORD_DATABASE_SERVICE][
          RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE
        ](async (database) => {
          await this.assertNoLogicalKeyConflict(
            database,
            protocol,
            acceptance,
          )
          await database.accept(acceptance)
        })
      },
    )

    return committed(relation)
  }

  private async loadExactReplay(
    acceptance: ValidatedRepoContributionRecord,
    protocolHash: string,
  ): Promise<RepoContributionView | undefined> {
    return this.ctx[PROTOCOL_RESOLUTION_SERVICE].withExactService(
      REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
      protocolHash,
      async (service) => {
        const protocol = requireProtocolService(service)
        return this.ctx[RUNTIME_RECORD_DATABASE_SERVICE][
          RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE
        ](async (database) => {
          try {
            await database.get(acceptance.id)
          } catch (cause) {
            if (cause instanceof RecordJournalNotFoundError) return undefined
            throw cause
          }

          await this.assertNoLogicalKeyConflict(
            database,
            protocol,
            acceptance,
          )
          await database.accept(acceptance)
          const labourRecord = await database.get(
            acceptance.data.labourRecordId,
          )
          return protocol.validateRelation(acceptance, labourRecord)
        })
      },
    )
  }

  private async assertNoLogicalKeyConflict(
    database: RuntimeRecordDatabaseSession,
    protocol: RepoContributionProtocolService,
    candidate: ValidatedRepoContributionRecord,
  ): Promise<void> {
    for await (const record of database.iterateAccepted()) {
      if (!isContributionCandidate(record)) continue

      const acceptedProtocolHash =
        requireDurableContributionProtocolHash(record)
      if (acceptedProtocolHash !== candidate.protocolHash) {
        throw new ProtocolBuildConflictError(
          REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
          acceptedProtocolHash,
          candidate.protocolHash,
        )
      }

      const accepted = await protocol.validateAcceptance(record)
      if (
        accepted.id !== candidate.id &&
        sameLogicalKey(accepted, candidate)
      ) {
        throw new RepositoryContributionConflictError(
          candidate,
          accepted.id,
        )
      }
    }
  }
}

export const REPOSITORY_CONTRIBUTION_INJECT = Object.freeze([
  PROTOCOL_RESOLUTION_SERVICE,
  ASSET_STORAGE_SERVICE,
  RUNTIME_RECORD_DATABASE_SERVICE,
] as const)

export const repositoryContributionPlugin = {
  name: REPOSITORY_CONTRIBUTION_PLUGIN_NAME,
  provide: REPOSITORY_CONTRIBUTION_SERVICE,
  inject: [...REPOSITORY_CONTRIBUTION_INJECT],
  apply(ctx: Context): void {
    ctx.provide(
      REPOSITORY_CONTRIBUTION_SERVICE,
      new RepositoryContributionService(ctx),
    )
  },
}
