import type { Context } from '@deepseek-ai/cordis'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  type CoreRecordValue,
} from './member.ts'
import {
  LABOUR_RECORD_PROTOCOL_SERVICE,
  type ValidatedLabourRecord,
} from './labour-record.ts'
import {
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
} from './repo.ts'

export const REPO_CONTRIBUTION_PROTOCOL_NAME = 'repo.contribution' as const
export const REPO_CONTRIBUTION_PROTOCOL_VERSION = '0.1.0' as const
export const REPO_CONTRIBUTION_PROTOCOL_REFERENCE =
  'repo.contribution@0.1.0' as const
export const REPO_CONTRIBUTION_PROTOCOL_SERVICE =
  'protocol:repo.contribution@0.1.0' as const

const DIGEST_RE = /^[0-9a-f]{64}$/u
const DATA_KEYS = ['labourRecordId', 'assetId', 'operator'] as const
const DATA_KEY_SET = new Set<string>(DATA_KEYS)

export interface RepoContributionData {
  readonly labourRecordId: string
  readonly assetId: string
  readonly operator: string
}

export interface ValidatedRepoContributionRecord extends CoreRecordValue {
  readonly data: RepoContributionData
}

export interface RepoContributionMountConfig {
  readonly protocolHash: string
}

export interface RepoContributionView {
  readonly recordId: string
  readonly repoIdentity: string
  readonly labourRecordId: string
  readonly assetId: string
  readonly operator: string
  readonly contributor: string
}

export class RepoContributionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoContributionError'
  }
}

export class RepoContributionProtocolConfigError extends RepoContributionError {
  constructor(message: string) {
    super(message)
    this.name = 'RepoContributionProtocolConfigError'
  }
}

export class RepoContributionValidationError extends RepoContributionError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoContributionValidationError'
  }
}

export class RepoContributionRepoNotEstablishedError
  extends RepoContributionValidationError {
  readonly repoIdentity: string

  constructor(repoIdentity: string, options?: ErrorOptions) {
    super('Repo contribution author is not an established Repo: ' + repoIdentity, options)
    this.name = 'RepoContributionRepoNotEstablishedError'
    this.repoIdentity = repoIdentity
  }
}

export class RepoContributionRelationError extends RepoContributionError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoContributionRelationError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    'protocol:repo.contribution@0.1.0': RepoContributionProtocolService
  }
}

function isRepoNotFoundError(value: unknown, identity: string): boolean {
  if (typeof value !== 'object' || value === null) return false
  const error = value as { readonly name?: unknown; readonly identity?: unknown }
  return error.name === 'RepoNotFoundError' && error.identity === identity
}

function requireProtocolHash(config: RepoContributionMountConfig): string {
  if (
    !config ||
    typeof config.protocolHash !== 'string' ||
    !DIGEST_RE.test(config.protocolHash)
  ) {
    throw new RepoContributionProtocolConfigError(
      'repo.contribution requires the exact resolved ProtocolHash from the Host.',
    )
  }
  return config.protocolHash
}

function requireData(value: unknown): RepoContributionData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RepoContributionValidationError(
      'repo.contribution data must be a plain object.',
    )
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RepoContributionValidationError(
      'repo.contribution data must be a plain object.',
    )
  }

  const data = value as Record<string, unknown>
  const keys = Reflect.ownKeys(data)
  if (
    keys.length !== DATA_KEYS.length ||
    keys.some((key) => typeof key !== 'string' || !DATA_KEY_SET.has(key))
  ) {
    throw new RepoContributionValidationError(
      'repo.contribution data must contain exactly labourRecordId, assetId and operator.',
    )
  }

  if (
    typeof data.labourRecordId !== 'string' ||
    data.labourRecordId.length === 0
  ) {
    throw new RepoContributionValidationError(
      'repo.contribution labourRecordId must be a non-empty string.',
    )
  }
  if (typeof data.assetId !== 'string' || data.assetId.length === 0) {
    throw new RepoContributionValidationError(
      'repo.contribution assetId must be a non-empty string.',
    )
  }

  return {
    labourRecordId: data.labourRecordId,
    assetId: data.assetId,
    operator: data.operator as string,
  }
}

function view(
  acceptance: ValidatedRepoContributionRecord,
  labour: ValidatedLabourRecord,
): RepoContributionView {
  return Object.freeze({
    recordId: acceptance.id,
    repoIdentity: acceptance.createdBy,
    labourRecordId: acceptance.data.labourRecordId,
    assetId: acceptance.data.assetId,
    operator: acceptance.data.operator,
    contributor: labour.createdBy,
  })
}

export class RepoContributionProtocolService {
  private readonly ctx: Context
  readonly protocolHash: string

  constructor(ctx: Context, protocolHash: string) {
    this.ctx = ctx
    this.protocolHash = protocolHash
  }

  async validateAcceptance(
    value: unknown,
  ): Promise<ValidatedRepoContributionRecord> {
    let record: CoreRecordValue
    try {
      record = this.ctx[CORE_RECORD_PROTOCOL_SERVICE].validateRecord(value)
    } catch (cause) {
      throw new RepoContributionValidationError(
        'Invalid Core Record for repo.contribution.',
        { cause },
      )
    }

    if (record.protocol !== REPO_CONTRIBUTION_PROTOCOL_REFERENCE) {
      throw new RepoContributionValidationError(
        'Repo contribution Record must reference ' +
          REPO_CONTRIBUTION_PROTOCOL_REFERENCE +
          '.',
      )
    }
    if (record.protocolHash !== this.protocolHash) {
      throw new RepoContributionValidationError(
        'Repo contribution Record references a different ProtocolHash.',
      )
    }

    let signatureValid: boolean
    try {
      signatureValid =
        this.ctx[CORE_RECORD_PROTOCOL_SERVICE].verifySignature(record)
    } catch (cause) {
      throw new RepoContributionValidationError(
        'Unable to verify Repo contribution signature.',
        { cause },
      )
    }
    if (!signatureValid) {
      throw new RepoContributionValidationError(
        'Repo contribution Record signature is invalid.',
      )
    }

    try {
      await this.ctx[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].loadRepo(
        record.createdBy,
      )
    } catch (cause) {
      if (isRepoNotFoundError(cause, record.createdBy)) {
        throw new RepoContributionRepoNotEstablishedError(
          record.createdBy,
          { cause },
        )
      }
      throw cause
    }

    const rawData = requireData(record.data)
    let operator: string
    try {
      operator = this.ctx[CORE_ENTITY_PROTOCOL_SERVICE]
        .validateEntityPublicKey(rawData.operator)
    } catch (cause) {
      throw new RepoContributionValidationError(
        'repo.contribution operator must be a valid Core EntityPublicKey.',
        { cause },
      )
    }

    const data = Object.freeze({
      labourRecordId: rawData.labourRecordId,
      assetId: rawData.assetId,
      operator,
    })

    return Object.freeze({ ...record, data })
  }

  async validateRelation(
    acceptanceValue: unknown,
    labourRecordValue: unknown,
  ): Promise<RepoContributionView> {
    const acceptance = await this.validateAcceptance(acceptanceValue)
    let labour: ValidatedLabourRecord
    try {
      labour = await this.ctx[
        LABOUR_RECORD_PROTOCOL_SERVICE
      ].validateLabourRecord(labourRecordValue)
    } catch (cause) {
      throw new RepoContributionRelationError(
        'Referenced labour Record is invalid.',
        { cause },
      )
    }

    if (acceptance.data.labourRecordId !== labour.id) {
      throw new RepoContributionRelationError(
        'Repo contribution labourRecordId does not match the supplied labour Record.',
      )
    }

    if (!labour.data.assets?.includes(acceptance.data.assetId)) {
      throw new RepoContributionRelationError(
        'Repo contribution selected Asset is absent from labour Record assets.',
      )
    }

    return view(acceptance, labour)
  }
}

export const REPO_CONTRIBUTION_PROTOCOL_INJECT = Object.freeze([
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  LABOUR_RECORD_PROTOCOL_SERVICE,
] as const)

export function createRepoContributionProtocolPlugin() {
  return {
    name: REPO_CONTRIBUTION_PROTOCOL_REFERENCE,
    provide: REPO_CONTRIBUTION_PROTOCOL_SERVICE,
    inject: [...REPO_CONTRIBUTION_PROTOCOL_INJECT],
    apply(ctx: Context, config: RepoContributionMountConfig): void {
      const protocolHash = requireProtocolHash(config)
      ctx.provide(
        REPO_CONTRIBUTION_PROTOCOL_SERVICE,
        new RepoContributionProtocolService(ctx, protocolHash),
      )
    },
  }
}
