import type { Context } from '@deepseek-ai/cordis'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_SERVICE,
  MemberNotFoundError,
  type CoreRecordValue,
} from './member.ts'
import type { JournalRecord } from './record-journal.ts'

export const REPO_ESTABLISHMENT_PROTOCOL_NAME = 'repo.establishment' as const
export const REPO_ESTABLISHMENT_PROTOCOL_VERSION = '0.1.0' as const
export const REPO_ESTABLISHMENT_PROTOCOL_REFERENCE =
  `${REPO_ESTABLISHMENT_PROTOCOL_NAME}@${REPO_ESTABLISHMENT_PROTOCOL_VERSION}` as const
export const REPO_ESTABLISHMENT_PROTOCOL_SERVICE =
  `protocol:${REPO_ESTABLISHMENT_PROTOCOL_REFERENCE}` as const

const DIGEST_RE = /^[0-9a-f]{64}$/u

export interface RepoEstablishmentMountConfig {
  readonly protocolHash: string
}

export interface RepoView {
  readonly identity: string
  readonly operator: string
  readonly establishmentRecordId: string
}

export class RepoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoError'
  }
}

export class RepoProtocolConfigError extends RepoError {
  constructor(message: string) {
    super(message)
    this.name = 'RepoProtocolConfigError'
  }
}

export class RepoEstablishmentError extends RepoError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoEstablishmentError'
  }
}

export class RepoEstablishingMemberError extends RepoError {
  readonly identity: string

  constructor(identity: string, options?: ErrorOptions) {
    super(
      'Repo establishment author does not satisfy the Member capability: ' +
        identity,
      options,
    )
    this.name = 'RepoEstablishingMemberError'
    this.identity = identity
  }
}

export class RepoNotFoundError extends RepoError {
  readonly identity: string

  constructor(identity: string) {
    super('Repo is not established: ' + identity)
    this.name = 'RepoNotFoundError'
    this.identity = identity
  }
}

export class RepoAlreadyEstablishedError extends RepoError {
  readonly identity: string
  readonly establishmentRecordId: string

  constructor(identity: string, establishmentRecordId: string) {
    super(
      'Repo identity is already established by Record ' +
        establishmentRecordId +
        ': ' +
        identity,
    )
    this.name = 'RepoAlreadyEstablishedError'
    this.identity = identity
    this.establishmentRecordId = establishmentRecordId
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    'protocol:repo.establishment@0.1.0': RepoEstablishmentService
  }
}

function requireProtocolHash(config: RepoEstablishmentMountConfig): string {
  if (
    !config ||
    typeof config.protocolHash !== 'string' ||
    !DIGEST_RE.test(config.protocolHash)
  ) {
    throw new RepoProtocolConfigError(
      'repo.establishment requires the exact resolved ProtocolHash from the Host.',
    )
  }
  return config.protocolHash
}

function requireRepoPayload(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RepoEstablishmentError(
      'repo.establishment data must be a plain object containing only repo.',
    )
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RepoEstablishmentError(
      'repo.establishment data must be a plain object containing only repo.',
    )
  }

  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== 1 ||
    keys[0] !== 'repo' ||
    !Object.prototype.propertyIsEnumerable.call(value, 'repo')
  ) {
    throw new RepoEstablishmentError(
      'repo.establishment data must contain exactly one enumerable repo field.',
    )
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, 'repo')
  if (!descriptor || !('value' in descriptor)) {
    throw new RepoEstablishmentError(
      'repo.establishment data.repo must be an enumerable data property.',
    )
  }

  return descriptor.value
}

function repoView(record: CoreRecordValue, identity: string): RepoView {
  return Object.freeze({
    identity,
    operator: record.createdBy,
    establishmentRecordId: record.id,
  })
}

/**
 * Current Repo establishment projection.
 *
 * The exact accepted establishment Record remains the domain source. This
 * in-memory map is only a replaceable lookup index rebuilt from recordJournal.
 */
export class RepoEstablishmentService {
  private readonly ctx: Context
  readonly protocolHash: string
  private readonly establishments = new Map<string, string>()
  private establishmentGate: Promise<void> = Promise.resolve()

  constructor(ctx: Context, protocolHash: string) {
    this.ctx = ctx
    this.protocolHash = protocolHash
  }

  async rebuild(): Promise<void> {
    const rebuilt = new Map<string, string>()

    for await (const journalRecord of this.ctx.recordJournal.iterateAccepted()) {
      if (!this.isCandidate(journalRecord)) continue

      const validated = await this.validateEstablishment(journalRecord)
      const existing = rebuilt.get(validated.repoIdentity)

      if (existing !== undefined && existing !== validated.record.id) {
        throw new RepoAlreadyEstablishedError(
          validated.repoIdentity,
          existing,
        )
      }

      rebuilt.set(validated.repoIdentity, validated.record.id)
    }

    this.establishments.clear()
    for (const [identity, recordId] of rebuilt) {
      this.establishments.set(identity, recordId)
    }
  }

  async establishRepo(value: unknown): Promise<RepoView> {
    const validated = await this.validateEstablishment(value)

    return this.withEstablishmentGate(async () => {
      // Durable facts, not the replaceable in-memory index, decide whether the
      // Repo identity has already been established.
      await this.rebuild()

      const existing = this.establishments.get(validated.repoIdentity)
      if (existing !== undefined && existing !== validated.record.id) {
        throw new RepoAlreadyEstablishedError(
          validated.repoIdentity,
          existing,
        )
      }

      // Exact replay still goes through the journal so non-equivalent content
      // under one RecordId cannot bypass journal conflict detection.
      await this.ctx.recordJournal.accept(validated.record)
      this.establishments.set(validated.repoIdentity, validated.record.id)

      return repoView(validated.record, validated.repoIdentity)
    })
  }

  async loadRepo(identity: unknown): Promise<RepoView> {
    const repoIdentity = this.validateRepoIdentity(identity)

    let recordId = this.establishments.get(repoIdentity)
    if (recordId === undefined) {
      await this.rebuild()
      recordId = this.establishments.get(repoIdentity)
    }

    if (recordId === undefined) {
      throw new RepoNotFoundError(repoIdentity)
    }

    const stored = await this.ctx.recordJournal.get(recordId)
    const validated = await this.validateEstablishment(stored)

    if (validated.repoIdentity !== repoIdentity) {
      throw new RepoEstablishmentError(
        'Repo lookup index does not match the durable establishment Record.',
      )
    }

    return repoView(validated.record, repoIdentity)
  }

  private async withEstablishmentGate<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.establishmentGate
    let release!: () => void
    this.establishmentGate = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }

  private isCandidate(value: JournalRecord): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false
    }

    const record = value as Partial<CoreRecordValue>
    return (
      record.protocol === REPO_ESTABLISHMENT_PROTOCOL_REFERENCE &&
      record.protocolHash === this.protocolHash
    )
  }

  private validateRepoIdentity(value: unknown): string {
    try {
      return this.ctx[CORE_ENTITY_PROTOCOL_SERVICE].validateEntityPublicKey(value)
    } catch (cause) {
      throw new RepoEstablishmentError(
        'Repo identity is not a valid Core EntityPublicKey.',
        { cause },
      )
    }
  }

  private async validateEstablishment(
    value: unknown,
  ): Promise<{ record: CoreRecordValue; repoIdentity: string }> {
    let record: CoreRecordValue
    try {
      record = this.ctx[CORE_RECORD_PROTOCOL_SERVICE].validateRecord(value)
    } catch (cause) {
      throw new RepoEstablishmentError(
        'Invalid Core Record for repo.establishment.',
        { cause },
      )
    }

    if (record.protocol !== REPO_ESTABLISHMENT_PROTOCOL_REFERENCE) {
      throw new RepoEstablishmentError(
        'Repo establishment Record must reference ' +
          REPO_ESTABLISHMENT_PROTOCOL_REFERENCE +
          '.',
      )
    }
    if (record.protocolHash !== this.protocolHash) {
      throw new RepoEstablishmentError(
        'Repo establishment Record references a different ProtocolHash.',
      )
    }

    let signatureValid: boolean
    try {
      signatureValid =
        this.ctx[CORE_RECORD_PROTOCOL_SERVICE].verifySignature(record)
    } catch (cause) {
      throw new RepoEstablishmentError(
        'Unable to verify Repo establishment signature.',
        { cause },
      )
    }
    if (!signatureValid) {
      throw new RepoEstablishmentError(
        'Repo establishment Record signature is invalid.',
      )
    }

    const payloadRepo = requireRepoPayload(record.data)
    const repoIdentity = this.validateRepoIdentity(payloadRepo)

    try {
      await this.ctx[MEMBER_PROTOCOL_SERVICE].requireMember(record.createdBy)
    } catch (cause) {
      if (cause instanceof MemberNotFoundError) {
        throw new RepoEstablishingMemberError(record.createdBy, { cause })
      }
      throw cause
    }

    return { record, repoIdentity }
  }
}

export const REPO_ESTABLISHMENT_PROTOCOL_INJECT = Object.freeze([
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_SERVICE,
  'recordJournal',
] as const)

export function createRepoEstablishmentProtocolPlugin() {
  return {
    name: REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
    provide: REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
    inject: [...REPO_ESTABLISHMENT_PROTOCOL_INJECT],
    async apply(
      ctx: Context,
      config: RepoEstablishmentMountConfig,
    ): Promise<void> {
      const protocolHash = requireProtocolHash(config)
      const service = new RepoEstablishmentService(ctx, protocolHash)
      await service.rebuild()
      ctx.provide(REPO_ESTABLISHMENT_PROTOCOL_SERVICE, service)
    },
  }
}
