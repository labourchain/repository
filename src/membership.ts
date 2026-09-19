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

export type MembershipAction = 'add' | 'remove'

export interface MembershipMountConfig {
  readonly protocolHash: string
}

export interface MembershipView {
  readonly repo: string
  readonly member: string
  readonly active: boolean
  readonly headRecordId: string | null
}

interface MembershipPayload {
  readonly repo: string
  readonly member: string
  readonly action: MembershipAction
  readonly previousMutation: string | null
}

interface ValidatedMembershipMutation {
  readonly record: CoreRecordValue
  readonly payload: MembershipPayload
}

interface RelationState {
  readonly active: boolean
  readonly headRecordId: string | null
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

export class MembershipMutationError extends MembershipError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MembershipMutationError'
  }
}

export class MembershipAuthorizationError extends MembershipError {
  readonly repo: string
  readonly actor: string
  readonly operator: string

  constructor(repo: string, actor: string, operator: string) {
    super(
      'Membership mutation author is not the Repo operator: ' +
        actor +
        ' for Repo ' +
        repo,
    )
    this.name = 'MembershipAuthorizationError'
    this.repo = repo
    this.actor = actor
    this.operator = operator
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

export class MembershipStaleMutationError extends MembershipError {
  readonly repo: string
  readonly member: string
  readonly expectedPreviousMutation: string | null
  readonly actualPreviousMutation: string | null

  constructor(
    repo: string,
    member: string,
    expectedPreviousMutation: string | null,
    actualPreviousMutation: string | null,
  ) {
    super(
      'Membership mutation does not consume the current relation head for Repo ' +
        repo +
        ' and Member ' +
        member,
    )
    this.name = 'MembershipStaleMutationError'
    this.repo = repo
    this.member = member
    this.expectedPreviousMutation = expectedPreviousMutation
    this.actualPreviousMutation = actualPreviousMutation
  }
}

export class MembershipNoChangeError extends MembershipError {
  readonly repo: string
  readonly member: string
  readonly action: MembershipAction

  constructor(repo: string, member: string, action: MembershipAction) {
    super(
      'Membership mutation would not change the current relation state: ' +
        action +
        ' for Repo ' +
        repo +
        ' and Member ' +
        member,
    )
    this.name = 'MembershipNoChangeError'
    this.repo = repo
    this.member = member
    this.action = action
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
    throw new MembershipMutationError(
      'repo.membership data must be a plain membership mutation object.',
    )
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new MembershipMutationError(
      'repo.membership data must be a plain membership mutation object.',
    )
  }

  const expected = ['action', 'member', 'previousMutation', 'repo']
  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== expected.length ||
    keys.some((key) => typeof key !== 'string' || !expected.includes(key))
  ) {
    throw new MembershipMutationError(
      'repo.membership data must contain exactly repo, member, action and previousMutation.',
    )
  }

  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (
      !descriptor ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      throw new MembershipMutationError(
        'repo.membership data fields must be enumerable data properties.',
      )
    }
  }

  const data = value as Record<string, unknown>
  if (data.action !== 'add' && data.action !== 'remove') {
    throw new MembershipMutationError(
      'repo.membership data.action must be add or remove.',
    )
  }
  if (
    data.previousMutation !== null &&
    (typeof data.previousMutation !== 'string' || !DIGEST_RE.test(data.previousMutation))
  ) {
    throw new MembershipMutationError(
      'repo.membership data.previousMutation must be a Core RecordId or null.',
    )
  }

  return {
    repo: data.repo as string,
    member: data.member as string,
    action: data.action,
    previousMutation: data.previousMutation as string | null,
  }
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
    headRecordId: state.headRecordId,
  })
}

const EMPTY_RELATION: RelationState = Object.freeze({
  active: false,
  headRecordId: null,
})

export class MembershipService {
  private readonly ctx: Context
  readonly protocolHash: string
  private readonly relations = new Map<string, RelationState>()
  private readonly acceptedRecordIds = new Set<string>()
  private mutationGate: Promise<void> = Promise.resolve()

  constructor(ctx: Context, protocolHash: string) {
    this.ctx = ctx
    this.protocolHash = protocolHash
  }

  async rebuild(): Promise<void> {
    const groups = new Map<string, ValidatedMembershipMutation[]>()
    const acceptedRecordIds = new Set<string>()

    for await (const journalRecord of this.ctx.recordJournal.iterateAccepted()) {
      if (!this.isCandidate(journalRecord)) continue

      const validated = await this.validateMutation(journalRecord)
      if (acceptedRecordIds.has(validated.record.id)) {
        throw new MembershipHistoryError(
          'Membership history contains a duplicate RecordId: ' +
            validated.record.id,
        )
      }
      acceptedRecordIds.add(validated.record.id)

      const key = relationKey(validated.payload.repo, validated.payload.member)
      const group = groups.get(key)
      if (group) group.push(validated)
      else groups.set(key, [validated])
    }

    const rebuilt = new Map<string, RelationState>()

    for (const [key, records] of groups) {
      const byId = new Map<string, ValidatedMembershipMutation>()
      const childByPreviousMutation = new Map<string, ValidatedMembershipMutation>()
      let root: ValidatedMembershipMutation | undefined

      for (const mutation of records) {
        byId.set(mutation.record.id, mutation)
      }

      for (const mutation of records) {
        const previousMutation = mutation.payload.previousMutation
        if (previousMutation === null) {
          if (root) {
            throw new MembershipHistoryError(
              'Membership relation contains multiple initial mutations.',
            )
          }
          root = mutation
          continue
        }

        const predecessor = byId.get(previousMutation)
        if (!predecessor) {
          throw new MembershipHistoryError(
            'Membership mutation references a missing predecessor: ' + previousMutation,
          )
        }

        if (childByPreviousMutation.has(previousMutation)) {
          throw new MembershipHistoryError(
            'Membership relation contains a predecessor fork at RecordId: ' +
              previousMutation,
          )
        }
        childByPreviousMutation.set(previousMutation, mutation)
      }

      if (!root) {
        throw new MembershipHistoryError(
          'Membership relation does not contain an initial mutation.',
        )
      }
      if (root.payload.action !== 'add') {
        throw new MembershipHistoryError(
          'Membership relation must begin with an add mutation.',
        )
      }

      const visited = new Set<string>()
      let current = root
      let expectedAction: MembershipAction = 'add'

      while (true) {
        if (visited.has(current.record.id)) {
          throw new MembershipHistoryError(
            'Membership relation contains a predecessor cycle.',
          )
        }
        visited.add(current.record.id)

        if (current.payload.action !== expectedAction) {
          throw new MembershipHistoryError(
            'Membership relation contains a non-alternating mutation sequence.',
          )
        }

        const child = childByPreviousMutation.get(current.record.id)
        if (!child) {
          rebuilt.set(key, {
            active: current.payload.action === 'add',
            headRecordId: current.record.id,
          })
          break
        }

        current = child
        expectedAction = expectedAction === 'add' ? 'remove' : 'add'
      }

      if (visited.size !== records.length) {
        throw new MembershipHistoryError(
          'Membership relation contains disconnected or cyclic durable mutations.',
        )
      }
    }

    this.relations.clear()
    for (const [key, state] of rebuilt) this.relations.set(key, state)

    this.acceptedRecordIds.clear()
    for (const id of acceptedRecordIds) this.acceptedRecordIds.add(id)
  }

  async applyMembership(value: unknown): Promise<MembershipView> {
    const validated = await this.validateMutation(value)

    return this.withMutationGate(async () => {
      await this.rebuild()

      const key = relationKey(
        validated.payload.repo,
        validated.payload.member,
      )
      const current = this.relations.get(key) ?? EMPTY_RELATION

      if (this.acceptedRecordIds.has(validated.record.id)) {
        await this.ctx.recordJournal.accept(validated.record)
        return membershipView(
          validated.payload.repo,
          validated.payload.member,
          current,
        )
      }

      if (validated.payload.previousMutation !== current.headRecordId) {
        throw new MembershipStaleMutationError(
          validated.payload.repo,
          validated.payload.member,
          current.headRecordId,
          validated.payload.previousMutation,
        )
      }

      const desiredActive = validated.payload.action === 'add'
      if (current.active === desiredActive) {
        throw new MembershipNoChangeError(
          validated.payload.repo,
          validated.payload.member,
          validated.payload.action,
        )
      }

      await this.ctx.recordJournal.accept(validated.record)

      const next: RelationState = {
        active: desiredActive,
        headRecordId: validated.record.id,
      }
      this.relations.set(key, next)
      this.acceptedRecordIds.add(validated.record.id)

      return membershipView(
        validated.payload.repo,
        validated.payload.member,
        next,
      )
    })
  }

  async getMembership(repo: unknown, member: unknown): Promise<MembershipView> {
    const repoIdentity = await this.requireRepo(repo)
    const memberIdentity = await this.requireMember(member)
    const key = relationKey(repoIdentity.identity, memberIdentity)

    await this.rebuild()

    return membershipView(
      repoIdentity.identity,
      memberIdentity,
      this.relations.get(key) ?? EMPTY_RELATION,
    )
  }

  async hasMember(repo: unknown, member: unknown): Promise<boolean> {
    return (await this.getMembership(repo, member)).active
  }

  async listMembers(repo: unknown): Promise<readonly string[]> {
    const repoIdentity = await this.requireRepo(repo)

    await this.rebuild()

    const prefix = repoIdentity.identity + '\u0000'
    const members: string[] = []

    for (const [key, state] of this.relations) {
      if (!state.active || !key.startsWith(prefix)) continue
      members.push(key.slice(prefix.length))
    }

    members.sort()
    return Object.freeze(members)
  }

  private async withMutationGate<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const previousMutation = this.mutationGate
    let release!: () => void
    this.mutationGate = new Promise<void>((resolve) => {
      release = resolve
    })

    await previousMutation
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
      throw new MembershipMutationError(
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

  private async validateMutation(
    value: unknown,
  ): Promise<ValidatedMembershipMutation> {
    let record: CoreRecordValue
    try {
      record = this.ctx[CORE_RECORD_PROTOCOL_SERVICE].validateRecord(value)
    } catch (cause) {
      throw new MembershipMutationError(
        'Invalid Core Record for repo.membership.',
        { cause },
      )
    }

    if (record.protocol !== MEMBERSHIP_PROTOCOL_REFERENCE) {
      throw new MembershipMutationError(
        'Membership Record must reference ' +
          MEMBERSHIP_PROTOCOL_REFERENCE +
          '.',
      )
    }
    if (record.protocolHash !== this.protocolHash) {
      throw new MembershipMutationError(
        'Membership Record references a different ProtocolHash.',
      )
    }

    let signatureValid: boolean
    try {
      signatureValid =
        this.ctx[CORE_RECORD_PROTOCOL_SERVICE].verifySignature(record)
    } catch (cause) {
      throw new MembershipMutationError(
        'Unable to verify membership mutation signature.',
        { cause },
      )
    }
    if (!signatureValid) {
      throw new MembershipMutationError(
        'Membership mutation Record signature is invalid.',
      )
    }

    const payload = requirePayload(record.data)
    const repo = this.validateIdentity(payload.repo, 'Membership Repo')
    const member = await this.requireMember(payload.member)
    const repoView = await this.requireRepo(repo)

    if (record.createdBy !== repoView.operator) {
      throw new MembershipAuthorizationError(
        repo,
        record.createdBy,
        repoView.operator,
      )
    }

    return {
      record,
      payload: {
        repo,
        member,
        action: payload.action,
        previousMutation: payload.previousMutation,
      },
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
