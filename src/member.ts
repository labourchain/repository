import type { Context } from '@deepseek-ai/cordis'
import type { JournalRecord } from './record-journal.ts'

export const MEMBER_PROTOCOL_NAME = 'member.identity' as const
export const MEMBER_PROTOCOL_VERSION = '0.1.0' as const
export const MEMBER_PROTOCOL_REFERENCE = `${MEMBER_PROTOCOL_NAME}@${MEMBER_PROTOCOL_VERSION}` as const
export const MEMBER_PROTOCOL_SERVICE = `protocol:${MEMBER_PROTOCOL_REFERENCE}` as const

export const CORE_ENTITY_PROTOCOL_SERVICE = 'protocol:core.entity@0.1.0' as const
export const CORE_RECORD_PROTOCOL_SERVICE = 'protocol:core.record@0.1.0' as const

const DIGEST_RE = /^[0-9a-f]{64}$/u

export interface CoreEntityProtocolService {
  validateEntityPublicKey(value: unknown): string
}

export interface CoreRecordValue extends JournalRecord {
  readonly protocol: string
  readonly protocolHash: string
  readonly createdBy: string
  readonly createdAt: string
  readonly signature: string
  readonly data: unknown
}

export interface CoreRecordProtocolService {
  validateRecord(value: unknown): CoreRecordValue
  verifySignature(value: unknown): boolean
}

/**
 * Host-supplied identity for the exact verified Protocol implementation being
 * mounted. ProtocolHash cannot be embedded in the artifact that it hashes.
 *
 * This is intentionally narrow until core-protocols #31 fixes the generic Host
 * mount-config contract.
 */
export interface MemberProtocolMountConfig {
  readonly protocolHash: string
}

export interface MemberView {
  readonly identity: string
  readonly establishmentRecordId: string
}

export class MemberError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MemberError'
  }
}

export class MemberProtocolConfigError extends MemberError {
  constructor(message: string) {
    super(message)
    this.name = 'MemberProtocolConfigError'
  }
}

export class MemberEstablishmentError extends MemberError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MemberEstablishmentError'
  }
}

export class MemberNotFoundError extends MemberError {
  readonly identity: string

  constructor(identity: string) {
    super(`Entity is not an established Member: ${identity}`)
    this.name = 'MemberNotFoundError'
    this.identity = identity
  }
}

export class MemberConflictError extends MemberError {
  readonly identity: string
  readonly existingRecordId: string
  readonly conflictingRecordId: string

  constructor(identity: string, existingRecordId: string, conflictingRecordId: string) {
    super(`Member identity ${identity} already has establishment Record ${existingRecordId}; conflicting Record ${conflictingRecordId} cannot replace it.`)
    this.name = 'MemberConflictError'
    this.identity = identity
    this.existingRecordId = existingRecordId
    this.conflictingRecordId = conflictingRecordId
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    'protocol:core.entity@0.1.0': CoreEntityProtocolService
    'protocol:core.record@0.1.0': CoreRecordProtocolService
    'protocol:member.identity@0.1.0': MemberIdentityService
  }
}

function requireProtocolHash(config: MemberProtocolMountConfig): string {
  if (!config || typeof config.protocolHash !== 'string' || !DIGEST_RE.test(config.protocolHash)) {
    throw new MemberProtocolConfigError('member.identity requires the exact resolved ProtocolHash from the Host.')
  }
  return config.protocolHash
}

function requireEmptyPayload(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MemberEstablishmentError('member.identity establishment data must be an empty plain object.')
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new MemberEstablishmentError('member.identity establishment data must be an empty plain object.')
  }

  if (Reflect.ownKeys(value).length !== 0) {
    throw new MemberEstablishmentError('member.identity establishment data must not duplicate identity or profile fields.')
  }
}

function memberView(identity: string, establishmentRecordId: string): MemberView {
  return Object.freeze({ identity, establishmentRecordId })
}

/**
 * Journal-backed current Member projection for member.identity.
 *
 * The durable Record journal remains the fact source. This in-memory map is a
 * replaceable projection and is rebuilt whenever absence would authorize a new
 * Member establishment.
 */
export class MemberIdentityService {
  private readonly members = new Map<string, string>()
  private serialTail: Promise<void> = Promise.resolve()

  constructor(
    private readonly ctx: Context,
    readonly protocolHash: string,
  ) {}

  async rebuild(): Promise<void> {
    const rebuilt = new Map<string, string>()

    for await (const journalRecord of this.ctx.recordJournal.iterateAccepted()) {
      if (!this.isCandidate(journalRecord)) continue
      const record = this.validateEstablishment(journalRecord)
      const existing = rebuilt.get(record.createdBy)
      if (existing !== undefined && existing !== record.id) {
        throw new MemberConflictError(record.createdBy, existing, record.id)
      }
      rebuilt.set(record.createdBy, record.id)
    }

    this.members.clear()
    for (const [identity, recordId] of rebuilt) {
      this.members.set(identity, recordId)
    }
  }

  establishMember(record: unknown): Promise<MemberView> {
    return this.serial(async () => {
      const validated = this.validateEstablishment(record)

      // Durable facts may have changed outside this projection. Refresh before
      // absence is used to authorize a new establishment.
      await this.rebuild()

      const existing = this.members.get(validated.createdBy)
      if (existing !== undefined && existing !== validated.id) {
        throw new MemberConflictError(validated.createdBy, existing, validated.id)
      }

      await this.ctx.recordJournal.accept(validated)
      this.members.set(validated.createdBy, validated.id)
      return memberView(validated.createdBy, validated.id)
    })
  }

  async requireMember(identity: unknown): Promise<MemberView> {
    let validatedIdentity: string
    try {
      validatedIdentity = this.ctx[CORE_ENTITY_PROTOCOL_SERVICE].validateEntityPublicKey(identity)
    } catch (cause) {
      throw new MemberEstablishmentError('Member identity is not a valid Core EntityPublicKey.', { cause })
    }

    let recordId = this.members.get(validatedIdentity)
    if (recordId === undefined) {
      await this.rebuild()
      recordId = this.members.get(validatedIdentity)
    }

    if (recordId === undefined) {
      throw new MemberNotFoundError(validatedIdentity)
    }

    return memberView(validatedIdentity, recordId)
  }

  private isCandidate(value: JournalRecord): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const record = value as Partial<CoreRecordValue>
    return record.protocol === MEMBER_PROTOCOL_REFERENCE && record.protocolHash === this.protocolHash
  }

  private validateEstablishment(value: unknown): CoreRecordValue {
    let record: CoreRecordValue
    try {
      record = this.ctx[CORE_RECORD_PROTOCOL_SERVICE].validateRecord(value)
    } catch (cause) {
      throw new MemberEstablishmentError('Invalid Core Record for member.identity establishment.', { cause })
    }

    if (record.protocol !== MEMBER_PROTOCOL_REFERENCE) {
      throw new MemberEstablishmentError(`Member establishment Record must reference ${MEMBER_PROTOCOL_REFERENCE}.`)
    }
    if (record.protocolHash !== this.protocolHash) {
      throw new MemberEstablishmentError('Member establishment Record references a different ProtocolHash.')
    }

    try {
      this.ctx[CORE_ENTITY_PROTOCOL_SERVICE].validateEntityPublicKey(record.createdBy)
    } catch (cause) {
      throw new MemberEstablishmentError('Member establishment author is not a valid Core EntityPublicKey.', { cause })
    }

    let signatureValid: boolean
    try {
      signatureValid = this.ctx[CORE_RECORD_PROTOCOL_SERVICE].verifySignature(record)
    } catch (cause) {
      throw new MemberEstablishmentError('Unable to verify Member establishment signature.', { cause })
    }
    if (!signatureValid) {
      throw new MemberEstablishmentError('Member establishment Record signature is invalid.')
    }

    requireEmptyPayload(record.data)
    return record
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.serialTail.then(operation, operation)
    this.serialTail = run.then(() => undefined, () => undefined)
    return run
  }
}

export const MEMBER_PROTOCOL_INJECT = Object.freeze([
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  'recordJournal',
] as const)

/**
 * Create the Cordis object Plugin that is the runtime implementation of the
 * member.identity Protocol. The artifact entry re-exports only this object as
 * the named `plugin` export required by core-protocols #31.
 */
export function createMemberProtocolPlugin() {
  return {
    name: MEMBER_PROTOCOL_REFERENCE,
    inject: [...MEMBER_PROTOCOL_INJECT],
    async apply(ctx: Context, config: MemberProtocolMountConfig): Promise<void> {
      const protocolHash = requireProtocolHash(config)
      const service = new MemberIdentityService(ctx, protocolHash)
      await service.rebuild()
      ctx.provide(MEMBER_PROTOCOL_SERVICE, service)
    },
  }
}
