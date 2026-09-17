import { Service, type Context } from '@deepseek-ai/cordis'
import {
  CORE_VALIDATION_SERVICE,
  type CoreRecord,
} from './core-validation.ts'
import {
  RECORD_JOURNAL_SERVICE,
  type JournalRecord,
} from './record-journal.ts'

export const REPO_SERVICE = 'repo' as const

export interface RepoProtocolIdentity {
  /** Human-readable signed Record.plugin declaration for this establishment protocol. */
  readonly plugin: string
  /** Exact Core PluginHash used as the machine protocol identity. */
  readonly pluginHash: string
}

export interface RepoServiceConfig {
  /** Exact protocol identity accepted as the Repo-establishment Record source. */
  readonly establishmentProtocol: RepoProtocolIdentity
}

export interface RepoEstablishmentData {
  readonly repo: string
}

export interface RepoView {
  /** Stable Repo identity using Core EntityPublicKey semantics. */
  readonly repo: string
  /** Initial MVP operator, derived only from establishment Record.createdBy. */
  readonly operator: string
  /** Exact durable establishment Record identity. */
  readonly establishmentRecordId: string
}

interface ValidatedEstablishment {
  readonly record: CoreRecord
  readonly repo: string
}

export class RepoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoError'
  }
}

export class RepoConfigError extends RepoError {
  constructor(message: string) {
    super(message)
    this.name = 'RepoConfigError'
  }
}

export class RepoIdentityError extends RepoError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoIdentityError'
  }
}

export class RepoInvalidEstablishmentError extends RepoError {
  readonly recordId?: string

  constructor(message: string, recordId?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoInvalidEstablishmentError'
    this.recordId = recordId
  }
}

export class RepoNotFoundError extends RepoError {
  readonly repo: string

  constructor(repo: string) {
    super(`Repo is not established: ${repo}`)
    this.name = 'RepoNotFoundError'
    this.repo = repo
  }
}

export class RepoAlreadyEstablishedError extends RepoError {
  readonly repo: string
  readonly existingRecordId: string
  readonly attemptedRecordId: string

  constructor(repo: string, existingRecordId: string, attemptedRecordId: string) {
    super(
      `Repo ${repo} is already established by Record ${existingRecordId}; `
      + `Record ${attemptedRecordId} cannot replace it.`,
    )
    this.name = 'RepoAlreadyEstablishedError'
    this.repo = repo
    this.existingRecordId = existingRecordId
    this.attemptedRecordId = attemptedRecordId
  }
}

export class RepoIndexCorruptionError extends RepoError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoIndexCorruptionError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    repo: RepoService
  }
}

function ownDataValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !('value' in descriptor)) return undefined
  return descriptor.value
}

function declaredProtocol(value: JournalRecord): { plugin?: unknown; pluginHash?: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return {
    plugin: ownDataValue(value, 'plugin'),
    pluginHash: ownDataValue(value, 'pluginHash'),
  }
}

function validateProtocolConfig(config: RepoServiceConfig): RepoProtocolIdentity {
  const protocol = config?.establishmentProtocol
  if (!protocol || typeof protocol.plugin !== 'string' || protocol.plugin.length === 0) {
    throw new RepoConfigError('Repo service requires a non-empty establishmentProtocol.plugin.')
  }
  if (typeof protocol.pluginHash !== 'string' || protocol.pluginHash.length === 0) {
    throw new RepoConfigError('Repo service requires a non-empty establishmentProtocol.pluginHash.')
  }
  return Object.freeze({
    plugin: protocol.plugin,
    pluginHash: protocol.pluginHash,
  })
}

/**
 * Repository-domain service for establishment and loading only.
 *
 * The service owns no key material, Record cryptography, Block state or
 * canonical chain store. It consumes Core validation and the durable Record
 * journal through Cordis services, while its Repo lookup Map remains derived.
 */
export class RepoService extends Service {
  static inject = [CORE_VALIDATION_SERVICE, RECORD_JOURNAL_SERVICE]

  private readonly context: Context
  private readonly protocol: RepoProtocolIdentity
  private index = new Map<string, string>()
  private indexReady: Promise<void> | undefined
  private operationTail: Promise<void> = Promise.resolve()

  constructor(ctx: Context, config: RepoServiceConfig) {
    super(ctx, REPO_SERVICE)
    this.context = ctx
    this.protocol = validateProtocolConfig(config)
  }

  /**
   * Durably establish one Repo from an already-created signed Record.
   * Re-submitting the identical establishment is idempotent.
   */
  establishRepo(value: unknown): Promise<RepoView> {
    return this.serialized(async () => {
      const establishment = await this.validateEstablishment(value)
      await this.ensureIndex()

      let existingRecordId = this.index.get(establishment.repo)
      if (!existingRecordId) {
        // The index is deliberately derived. Refresh before authorizing a new
        // identity so a stale in-memory miss cannot replace durable truth.
        await this.refreshIndex()
        existingRecordId = this.index.get(establishment.repo)
      }

      if (existingRecordId && existingRecordId !== establishment.record.id) {
        throw new RepoAlreadyEstablishedError(
          establishment.repo,
          existingRecordId,
          establishment.record.id,
        )
      }

      // Even an idempotent retry reaches the journal so its own durability and
      // exact-value conflict contract remains authoritative.
      await this.context.recordJournal.accept(establishment.record)
      this.index.set(establishment.repo, establishment.record.id)
      return this.toView(establishment)
    })
  }

  /** Load an already-established Repo; missing identities are never created. */
  loadRepo(repoIdentity: unknown): Promise<RepoView> {
    return this.serialized(async () => {
      const repo = this.validateRepoIdentity(repoIdentity)
      await this.ensureIndex()

      let recordId = this.index.get(repo)
      if (!recordId) {
        // A Runtime index miss is not authoritative. Rebuild from the durable
        // journal once before concluding that the Repo is absent.
        await this.refreshIndex()
        recordId = this.index.get(repo)
      }

      if (!recordId) throw new RepoNotFoundError(repo)

      const candidate = await this.context.recordJournal.get(recordId)
      const establishment = await this.validateEstablishment(candidate)
      if (establishment.repo !== repo || establishment.record.id !== recordId) {
        throw new RepoIndexCorruptionError(
          `Repo index entry ${repo} -> ${recordId} does not match its establishment Record.`,
        )
      }

      return this.toView(establishment)
    })
  }

  private toView(establishment: ValidatedEstablishment): RepoView {
    return {
      repo: establishment.repo,
      operator: establishment.record.createdBy,
      establishmentRecordId: establishment.record.id,
    }
  }

  private validateRepoIdentity(value: unknown): string {
    try {
      return this.context.coreValidation.validateEntityPublicKey(value)
    } catch (cause) {
      throw new RepoIdentityError('Invalid Repo identity according to Core EntityPublicKey semantics.', { cause })
    }
  }

  private async validateEstablishment(value: unknown): Promise<ValidatedEstablishment> {
    let record: CoreRecord
    try {
      record = this.context.coreValidation.validateRecord(value)
    } catch (cause) {
      throw new RepoInvalidEstablishmentError('Invalid Repo establishment Record according to Core.', undefined, { cause })
    }

    if (record.plugin !== this.protocol.plugin || record.pluginHash !== this.protocol.pluginHash) {
      throw new RepoInvalidEstablishmentError(
        'Record does not use the configured Repo establishment protocol identity.',
        record.id,
      )
    }

    let signatureValid: boolean
    try {
      signatureValid = await this.context.coreValidation.verifyRecordSignature(record)
    } catch (cause) {
      throw new RepoInvalidEstablishmentError(
        'Unable to verify Repo establishment Record signature through Core.',
        record.id,
        { cause },
      )
    }
    if (!signatureValid) {
      throw new RepoInvalidEstablishmentError('Repo establishment Record signature is invalid.', record.id)
    }

    const data = record.data
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new RepoInvalidEstablishmentError('Repo establishment data must be an object.', record.id)
    }

    const keys = Object.keys(data)
    const descriptor = Object.getOwnPropertyDescriptor(data, 'repo')
    if (
      keys.length !== 1
      || keys[0] !== 'repo'
      || !descriptor
      || !descriptor.enumerable
      || !('value' in descriptor)
    ) {
      throw new RepoInvalidEstablishmentError(
        'Repo establishment data must contain exactly one enumerable data property: repo.',
        record.id,
      )
    }

    let repo: string
    try {
      repo = this.context.coreValidation.validateEntityPublicKey(descriptor.value)
    } catch (cause) {
      throw new RepoInvalidEstablishmentError(
        'Repo establishment payload contains an invalid Core EntityPublicKey.',
        record.id,
        { cause },
      )
    }

    return { record, repo }
  }

  private declaresEstablishmentProtocol(value: JournalRecord): boolean {
    const declaration = declaredProtocol(value)
    return declaration.plugin === this.protocol.plugin
      && declaration.pluginHash === this.protocol.pluginHash
  }

  private async ensureIndex(): Promise<void> {
    if (!this.indexReady) this.indexReady = this.buildIndex()

    try {
      await this.indexReady
    } catch (cause) {
      this.indexReady = undefined
      throw cause
    }
  }

  private async refreshIndex(): Promise<void> {
    const refresh = this.buildIndex()
    this.indexReady = refresh
    try {
      await refresh
    } catch (cause) {
      if (this.indexReady === refresh) this.indexReady = undefined
      throw cause
    }
  }

  private async buildIndex(): Promise<void> {
    const next = new Map<string, string>()

    for await (const candidate of this.context.recordJournal.iterateAccepted()) {
      if (!this.declaresEstablishmentProtocol(candidate)) continue

      const establishment = await this.validateEstablishment(candidate)
      const existingRecordId = next.get(establishment.repo)
      if (existingRecordId && existingRecordId !== establishment.record.id) {
        throw new RepoAlreadyEstablishedError(
          establishment.repo,
          existingRecordId,
          establishment.record.id,
        )
      }
      next.set(establishment.repo, establishment.record.id)
    }

    this.index = next
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation)
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}
