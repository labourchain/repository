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
 * Core v0.1.0 deliberately leaves Host mount configuration outside Core
 * Protocol validity. Repository currently uses this minimal Host-to-Protocol
 * convention and should only widen it when a concrete runtime need appears.
 */
export interface MemberProtocolMountConfig {
  readonly protocolHash: string
}

export interface MemberView {
  readonly identity: string
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

export class MemberDeclarationError extends MemberError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MemberDeclarationError'
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
    throw new MemberDeclarationError('member.identity declaration data must be an empty plain object.')
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new MemberDeclarationError('member.identity declaration data must be an empty plain object.')
  }

  if (Reflect.ownKeys(value).length !== 0) {
    throw new MemberDeclarationError('member.identity declaration data must not duplicate identity or profile fields.')
  }
}

function memberView(identity: string): MemberView {
  return Object.freeze({ identity })
}

/**
 * Journal-backed current Member projection for member.identity.
 *
 * The durable Record journal remains the fact source. The in-memory Set is a
 * replaceable projection of whether at least one valid declaration exists.
 */
export class MemberIdentityService {
  private readonly ctx: Context
  readonly protocolHash: string
  private readonly members = new Set<string>()

  constructor(ctx: Context, protocolHash: string) {
    this.ctx = ctx
    this.protocolHash = protocolHash
  }

  async rebuild(): Promise<void> {
    const rebuilt = new Set<string>()

    for await (const journalRecord of this.ctx.recordJournal.iterateAccepted()) {
      if (!this.isCandidate(journalRecord)) continue
      const record = this.validateDeclaration(journalRecord)
      rebuilt.add(record.createdBy)
    }

    this.members.clear()
    for (const identity of rebuilt) {
      this.members.add(identity)
    }
  }

  async declareMember(record: unknown): Promise<MemberView> {
    const validated = this.validateDeclaration(record)
    await this.ctx.recordJournal.accept(validated)
    this.members.add(validated.createdBy)
    return memberView(validated.createdBy)
  }

  async requireMember(identity: unknown): Promise<MemberView> {
    let validatedIdentity: string
    try {
      validatedIdentity = this.ctx[CORE_ENTITY_PROTOCOL_SERVICE].validateEntityPublicKey(identity)
    } catch (cause) {
      throw new MemberDeclarationError('Member identity is not a valid Core EntityPublicKey.', { cause })
    }

    if (!this.members.has(validatedIdentity)) {
      await this.rebuild()
    }

    if (!this.members.has(validatedIdentity)) {
      throw new MemberNotFoundError(validatedIdentity)
    }

    return memberView(validatedIdentity)
  }

  private isCandidate(value: JournalRecord): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const record = value as Partial<CoreRecordValue>
    return record.protocol === MEMBER_PROTOCOL_REFERENCE && record.protocolHash === this.protocolHash
  }

  private validateDeclaration(value: unknown): CoreRecordValue {
    let record: CoreRecordValue
    try {
      record = this.ctx[CORE_RECORD_PROTOCOL_SERVICE].validateRecord(value)
    } catch (cause) {
      throw new MemberDeclarationError('Invalid Core Record for member.identity declaration.', { cause })
    }

    if (record.protocol !== MEMBER_PROTOCOL_REFERENCE) {
      throw new MemberDeclarationError(`Member declaration Record must reference ${MEMBER_PROTOCOL_REFERENCE}.`)
    }
    if (record.protocolHash !== this.protocolHash) {
      throw new MemberDeclarationError('Member declaration Record references a different ProtocolHash.')
    }

    try {
      this.ctx[CORE_ENTITY_PROTOCOL_SERVICE].validateEntityPublicKey(record.createdBy)
    } catch (cause) {
      throw new MemberDeclarationError('Member declaration author is not a valid Core EntityPublicKey.', { cause })
    }

    let signatureValid: boolean
    try {
      signatureValid = this.ctx[CORE_RECORD_PROTOCOL_SERVICE].verifySignature(record)
    } catch (cause) {
      throw new MemberDeclarationError('Unable to verify Member declaration signature.', { cause })
    }
    if (!signatureValid) {
      throw new MemberDeclarationError('Member declaration Record signature is invalid.')
    }

    requireEmptyPayload(record.data)
    return record
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
    provide: MEMBER_PROTOCOL_SERVICE,
    inject: [...MEMBER_PROTOCOL_INJECT],
    async apply(ctx: Context, config: MemberProtocolMountConfig): Promise<void> {
      const protocolHash = requireProtocolHash(config)
      const service = new MemberIdentityService(ctx, protocolHash)
      await service.rebuild()
      ctx.provide(MEMBER_PROTOCOL_SERVICE, service)
    },
  }
}
