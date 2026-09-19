import type { Context } from '@deepseek-ai/cordis'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_SERVICE,
  MemberNotFoundError,
  type CoreRecordValue,
} from './member.ts'
import {
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  type RepoView,
} from './repo.ts'
import type { JournalRecord } from './record-journal.ts'

export const MEMBERSHIP_PROTOCOL_NAME = 'repo.membership' as const
export const MEMBERSHIP_PROTOCOL_VERSION = '0.1.0' as const
export const MEMBERSHIP_PROTOCOL_REFERENCE =
  `${MEMBERSHIP_PROTOCOL_NAME}@${MEMBERSHIP_PROTOCOL_VERSION}` as const
export const MEMBERSHIP_PROTOCOL_SERVICE =
  `protocol:${MEMBERSHIP_PROTOCOL_REFERENCE}` as const

const DIGEST_RE = /^[0-9a-f]{64}$/u
const CANONICAL_UTC_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u

export type MembershipAction = 'add' | 'remove'

export interface MembershipMountConfig {
  readonly protocolHash: string
}

export interface MembershipView {
  readonly repo: string
  readonly member: string
  readonly active: boolean
  readonly latestRecordId: string | null
  readonly effectiveAt: string | null
}

interface MembershipPayload {
  readonly repo: string
  readonly member: string
  readonly action: MembershipAction
}

interface ValidatedMembershipFact {
  readonly record: CoreRecordValue
  readonly payload: MembershipPayload
  readonly effectiveTime: number
}

interface RelationState {
  readonly active: boolean
  readonly latestRecordId: string | null
  readonly effectiveAt: string | null
  readonly effectiveTime: number
}

export class MembershipError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MembershipError'
  }
}

export class MembershipProtocolConfigError extends MembershipError {
  constructor(message: string) {
    super(message)
    this.name = 'MembershipProtocolConfigError'
  }
}

export class MembershipFactError extends MembershipError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MembershipFactError'
  }
}

export class MembershipAuthorizationError extends MembershipError {
  readonly repo: string
  readonly actor: string

  constructor(repo: string, actor: string) {
    super(
      'Membership Record must be authored by the Repo identity: ' +
        actor +
        ' for Repo ' +
        repo,
    )
    this.name = 'MembershipAuthorizationError'
    this.repo = repo
    this.actor = actor
  }
}

export class MembershipTargetMemberError extends MembershipError {
  readonly member: string

  constructor(member: string, options?: ErrorOptions) {
    super('Membership target does not satisfy the Member capability: ' + member, options)
    this.name = 'MembershipTargetMemberError'
    this.member = member
  }
}

export class MembershipHistoryError extends MembershipError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MembershipHistoryError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    'protocol:repo.membership@0.1.0': MembershipService
  }
}

function requireProtocolHash(config: MembershipMountConfig): string {
  if (
    !config ||
    typeof config.protocolHash !== 'string' ||
    !DIGEST_RE.test(config.protocolHash)
  ) {
    throw new MembershipProtocolConfigError(
      'repo.membership requires the exact resolved ProtocolHash from the Host.',
    )
  }
  return config.protocolHash
}

function requirePayload(value: unknown): MembershipPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MembershipFactError(
      'repo.membership data must be a plain membership fact object.',
    )
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new MembershipFactError(
      'repo.membership data must be a plain membership fact object.',
    )
  }

  const expected = ['action', 'member', 'repo']
  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== expected.length ||
    keys.some((key) => typeof key !== 'string' || !expected.includes(key))
  ) {
    throw new MembershipFactError(
      'repo.membership data must contain exactly repo, member and action.',
    )
  }

  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (
      !descriptor ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      throw new MembershipFactError(
        'repo.membership data fields must be enumerable data properties.',
      )
    }
  }

  const data = value as Record<string, unknown>
  if (data.action !== 'add' && data.action !== 'remove') {
    throw new MembershipFactError(
      'repo.membership data.action must be add or remove.',
    )
  }

  return {
    repo: data.repo as string,
    member: data.member as string,
    action: data.action,
  }
}

function requireEffectiveTime(createdAt: string): number {
  if (!CANONICAL_UTC_TIME_RE.test(createdAt)) {
    throw new MembershipFactError(
      'repo.membership Record.createdAt must be canonical UTC ISO time.',
    )
  }

  const effectiveTime = Date.parse(createdAt)
  if (
    !Number.isFinite(effectiveTime) ||
    new Date(effectiveTime).toISOString() !== createdAt
  ) {
    throw new MembershipFactError(
      'repo.membership Record.createdAt must be canonical UTC ISO time.',
    )
  }

  return effectiveTime
}

function relationKey(repo: string, member: string): string {
  return repo + '\u0000' + member
}

function membershipView(
  repo: string,
  member: string,
  state: RelationState,
): MembershipView {
  return Object.freeze({
    repo,
    member,
    active: state.active,
    latestRecordId: state.latestRecordId,
    effectiveAt: state.effectiveAt,
  })
}

const EMPTY_RELATION: RelationState = Object.freeze({
  active: false,
  latestRecordId: null,
  effectiveAt: null,
  effectiveTime: Number.NEGATIVE_INFINITY,
})

/**
 * Repo-signed membership fact projection.
 *
 * Membership itself is not a causal chain. The durable facts are ordered by
 * their Repo-attested effective time for the current relation view. Labour /
 * Asset causality belongs to the corresponding domain Protocols instead.
 */
export class MembershipService {
  private readonly ctx: Context
  readonly protocolHash: string
  private readonly relations = new Map<string, RelationState>()
  private operationGate: Promise<void> = Promise.resolve()

  constructor(ctx: Context, protocolHash: string) {
    this.ctx = ctx
    this.protocolHash = protocolHash
  }

  async rebuild(): Promise<void> {
    return this.withOperationGate(() => this.rebuildUnlocked())
  }

  async applyMembership(value: unknown): Promise<MembershipView> {
    const validated = await this.validateFact(value)

    return this.withOperationGate(async () => {
      await this.rebuildUnlocked()

      const key = relationKey(
        validated.payload.repo,
        validated.payload.member,
      )
      const current = this.relations.get(key) ?? EMPTY_RELATION

      if (current.latestRecordId === validated.record.id) {
        await this.ctx.recordJournal.accept(validated.record)
        return membershipView(
          validated.payload.repo,
          validated.payload.member,
          current,
        )
      }

      if (validated.effectiveTime === current.effectiveTime) {
        throw new MembershipHistoryError(
          'Membership relation contains distinct facts with the same effective time.',
        )
      }

      await this.ctx.recordJournal.accept(validated.record)

      // A Repo may durably publish a historical membership fact after a newer
      // fact is already known. It remains a valid fact without replacing the
      // current view.
      if (validated.effectiveTime > current.effectiveTime) {
        const next: RelationState = {
          active: validated.payload.action === 'add',
          latestRecordId: validated.record.id,
          effectiveAt: validated.record.createdAt,
          effectiveTime: validated.effectiveTime,
        }
        this.relations.set(key, next)
        return membershipView(
          validated.payload.repo,
          validated.payload.member,
          next,
        )
      }

      return membershipView(
        validated.payload.repo,
        validated.payload.member,
        current,
      )
    })
  }

  async getMembership(repo: unknown, member: unknown): Promise<MembershipView> {
    const repoIdentity = await this.requireRepo(repo)
    const memberIdentity = await this.requireMember(member)

    return this.withOperationGate(async () => {
      await this.rebuildUnlocked()
      return membershipView(
        repoIdentity.identity,
        memberIdentity,
        this.relations.get(
          relationKey(repoIdentity.identity, memberIdentity),
        ) ?? EMPTY_RELATION,
      )
    })
  }

  async hasMember(repo: unknown, member: unknown): Promise<boolean> {
    return (await this.getMembership(repo, member)).active
  }

  async listMembers(repo: unknown): Promise<readonly string[]> {
    const repoIdentity = await this.requireRepo(repo)

    return this.withOperationGate(async () => {
      await this.rebuildUnlocked()

      const prefix = repoIdentity.identity + '\u0000'
      const members: string[] = []

      for (const [key, state] of this.relations) {
        if (!state.active || !key.startsWith(prefix)) continue
        members.push(key.slice(prefix.length))
      }

      members.sort()
      return Object.freeze(members)
    })
  }

  private async rebuildUnlocked(): Promise<void> {
    const rebuilt = new Map<string, RelationState>()

    for await (const journalRecord of this.ctx.recordJournal.iterateAccepted()) {
      if (!this.isCandidate(journalRecord)) continue

      const validated = await this.validateFact(journalRecord)
      const key = relationKey(validated.payload.repo, validated.payload.member)
      const current = rebuilt.get(key)

      if (current && validated.effectiveTime === current.effectiveTime) {
        if (validated.record.id !== current.latestRecordId) {
          throw new MembershipHistoryError(
            'Membership relation contains distinct facts with the same effective time.',
          )
        }
        continue
      }

      if (!current || validated.effectiveTime > current.effectiveTime) {
        rebuilt.set(key, {
          active: validated.payload.action === 'add',
          latestRecordId: validated.record.id,
          effectiveAt: validated.record.createdAt,
          effectiveTime: validated.effectiveTime,
        })
      }
    }

    this.relations.clear()
    for (const [key, state] of rebuilt) {
      this.relations.set(key, state)
    }
  }

  private async withOperationGate<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const previousGate = this.operationGate
    let release!: () => void
    this.operationGate = new Promise<void>((resolve) => {
      release = resolve
    })

    await previousGate
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
      record.protocol === MEMBERSHIP_PROTOCOL_REFERENCE &&
      record.protocolHash === this.protocolHash
    )
  }

  private validateIdentity(value: unknown, label: string): string {
    try {
      return this.ctx[CORE_ENTITY_PROTOCOL_SERVICE].validateEntityPublicKey(value)
    } catch (cause) {
      throw new MembershipFactError(
        label + ' is not a valid Core EntityPublicKey.',
        { cause },
      )
    }
  }

  private async requireRepo(value: unknown): Promise<RepoView> {
    return this.ctx[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].loadRepo(value)
  }

  private async requireMember(value: unknown): Promise<string> {
    const identity = this.validateIdentity(value, 'Membership target')
    try {
      const view = await this.ctx[MEMBER_PROTOCOL_SERVICE].requireMember(identity)
      return view.identity
    } catch (cause) {
      if (cause instanceof MemberNotFoundError) {
        throw new MembershipTargetMemberError(identity, { cause })
      }
      throw cause
    }
  }

  private async validateFact(
    value: unknown,
  ): Promise<ValidatedMembershipFact> {
    let record: CoreRecordValue
    try {
      record = this.ctx[CORE_RECORD_PROTOCOL_SERVICE].validateRecord(value)
    } catch (cause) {
      throw new MembershipFactError(
        'Invalid Core Record for repo.membership.',
        { cause },
      )
    }

    if (record.protocol !== MEMBERSHIP_PROTOCOL_REFERENCE) {
      throw new MembershipFactError(
        'Membership Record must reference ' +
          MEMBERSHIP_PROTOCOL_REFERENCE +
          '.',
      )
    }
    if (record.protocolHash !== this.protocolHash) {
      throw new MembershipFactError(
        'Membership Record references a different ProtocolHash.',
      )
    }

    let signatureValid: boolean
    try {
      signatureValid =
        this.ctx[CORE_RECORD_PROTOCOL_SERVICE].verifySignature(record)
    } catch (cause) {
      throw new MembershipFactError(
        'Unable to verify membership Record signature.',
        { cause },
      )
    }
    if (!signatureValid) {
      throw new MembershipFactError(
        'Membership Record signature is invalid.',
      )
    }

    const payload = requirePayload(record.data)
    const repo = this.validateIdentity(payload.repo, 'Membership Repo')
    const member = await this.requireMember(payload.member)
    await this.requireRepo(repo)

    if (record.createdBy !== repo) {
      throw new MembershipAuthorizationError(repo, record.createdBy)
    }

    return {
      record,
      payload: {
        repo,
        member,
        action: payload.action,
      },
      effectiveTime: requireEffectiveTime(record.createdAt),
    }
  }
}

export const MEMBERSHIP_PROTOCOL_INJECT = Object.freeze([
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_SERVICE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  'recordJournal',
] as const)

export function createMembershipProtocolPlugin() {
  return {
    name: MEMBERSHIP_PROTOCOL_REFERENCE,
    provide: MEMBERSHIP_PROTOCOL_SERVICE,
    inject: [...MEMBERSHIP_PROTOCOL_INJECT],
    async apply(
      ctx: Context,
      config: MembershipMountConfig,
    ): Promise<void> {
      const protocolHash = requireProtocolHash(config)
      const service = new MembershipService(ctx, protocolHash)
      await service.rebuild()
      ctx.provide(MEMBERSHIP_PROTOCOL_SERVICE, service)
    },
  }
}
