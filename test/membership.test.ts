import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { plugin as memberIdentityPlugin } from '../src/protocols/member.identity.ts'
import { plugin as repoEstablishmentPlugin } from '../src/protocols/repo.establishment.ts'
import { plugin as membershipPlugin } from '../src/protocols/repo.membership.ts'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  MEMBERSHIP_PROTOCOL_REFERENCE,
  MEMBERSHIP_PROTOCOL_SERVICE,
  REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  BootstrapStartupError,
  MembershipAuthorizationError,
  MembershipHistoryError,
  MembershipMutationError,
  MembershipProtocolConfigError,
  MembershipTargetMemberError,
  RecordJournalNotFoundError,
  RecordJournalService,
  RepoNotFoundError,
  createRepositoryNode,
  type CoreRecordProtocolService,
  type CoreRecordValue,
} from '../src/index.ts'

const MEMBER_PROTOCOL_HASH = 'a'.repeat(64)
const REPO_PROTOCOL_HASH = 'b'.repeat(64)
const MEMBERSHIP_PROTOCOL_HASH = 'c'.repeat(64)

const OPERATOR_KEY = 'operator-key'
const MEMBER_KEY = 'member-key'
const SECOND_MEMBER_KEY = 'second-member-key'
const OTHER_ACTOR_KEY = 'other-actor-key'
const NON_MEMBER_KEY = 'non-member-key'
const REPO_KEY = 'repo-key'

const VALID_KEYS = new Set([
  OPERATOR_KEY,
  MEMBER_KEY,
  SECOND_MEMBER_KEY,
  OTHER_ACTOR_KEY,
  NON_MEMBER_KEY,
  REPO_KEY,
])

function recordId(label: string): string {
  return createHash('sha256').update(label).digest('hex')
}

function coreEntityProvider(ctx: Context) {
  ctx.provide(CORE_ENTITY_PROTOCOL_SERVICE, {
    validateEntityPublicKey(value: unknown) {
      if (typeof value !== 'string' || !VALID_KEYS.has(value)) {
        throw new Error('invalid test EntityPublicKey')
      }
      return value
    },
  })
}

const coreRecordService: CoreRecordProtocolService = {
  validateRecord(value: unknown): CoreRecordValue {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('invalid test Record')
    }

    const record = value as Partial<CoreRecordValue>
    if (
      typeof record.id !== 'string' ||
      typeof record.protocol !== 'string' ||
      typeof record.protocolHash !== 'string' ||
      typeof record.createdBy !== 'string' ||
      typeof record.createdAt !== 'string' ||
      typeof record.signature !== 'string' ||
      !Object.prototype.hasOwnProperty.call(record, 'data')
    ) {
      throw new Error('invalid test Record')
    }

    return record as CoreRecordValue
  },

  verifySignature(value: unknown) {
    return (value as Partial<CoreRecordValue>)?.signature === 'valid-signature'
  },
}

function coreRecordProvider(ctx: Context) {
  ctx.provide(CORE_RECORD_PROTOCOL_SERVICE, coreRecordService)
}

function memberRecord(identity: string): CoreRecordValue {
  return {
    id: recordId('member-' + identity),
    protocol: MEMBER_PROTOCOL_REFERENCE,
    protocolHash: MEMBER_PROTOCOL_HASH,
    createdBy: identity,
    createdAt: '2026-09-19T00:00:00.000Z',
    signature: 'valid-signature',
    data: {},
  }
}

function repoRecord(): CoreRecordValue {
  return {
    id: recordId('repo-establishment'),
    protocol: REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
    protocolHash: REPO_PROTOCOL_HASH,
    createdBy: OPERATOR_KEY,
    createdAt: '2026-09-19T00:00:01.000Z',
    signature: 'valid-signature',
    data: { repo: REPO_KEY },
  }
}

function membershipRecord(
  label: string,
  action: 'add' | 'remove',
  member = MEMBER_KEY,
  createdAt = '2026-09-19T00:00:02.000Z',
  createdBy = REPO_KEY,
  overrides: Partial<CoreRecordValue> = {},
): CoreRecordValue {
  return {
    id: recordId(label),
    protocol: MEMBERSHIP_PROTOCOL_REFERENCE,
    protocolHash: MEMBERSHIP_PROTOCOL_HASH,
    createdBy,
    createdAt,
    signature: 'valid-signature',
    data: {
      repo: REPO_KEY,
      member,
      action,
    },
    ...overrides,
  }
}

async function withDirectory<T>(
  run: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'labourchain-membership-test-'))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function composition(directory: string) {
  return [
    {
      plugin: membershipPlugin,
      config: { protocolHash: MEMBERSHIP_PROTOCOL_HASH },
    },
    {
      plugin: repoEstablishmentPlugin,
      config: { protocolHash: REPO_PROTOCOL_HASH },
    },
    {
      plugin: memberIdentityPlugin,
      config: { protocolHash: MEMBER_PROTOCOL_HASH },
    },
    { plugin: coreEntityProvider },
    { plugin: coreRecordProvider },
    { plugin: RecordJournalService, config: { directory } },
  ]
}

async function setupRepo(
  node: Awaited<ReturnType<typeof createRepositoryNode>>,
): Promise<void> {
  await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
    memberRecord(OPERATOR_KEY),
  )
  await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
    memberRecord(MEMBER_KEY),
  )
  await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
    memberRecord(SECOND_MEMBER_KEY),
  )
  await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(
    repoRecord(),
  )
}

function hasCause(
  error: unknown,
  constructor: new (...args: any[]) => Error,
): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if (current instanceof constructor) return true
    current = (current as Error).cause
  }
  return false
}

test('Membership Protocol artifact entry exports exactly one named plugin', async () => {
  const namespace = await import('../src/protocols/repo.membership.ts')

  assert.deepEqual(Object.keys(namespace), ['plugin'])
  assert.equal(namespace.plugin.name, MEMBERSHIP_PROTOCOL_REFERENCE)
  assert.equal(namespace.plugin.provide, MEMBERSHIP_PROTOCOL_SERVICE)
  assert.deepEqual(namespace.plugin.inject, [
    CORE_ENTITY_PROTOCOL_SERVICE,
    CORE_RECORD_PROTOCOL_SERVICE,
    MEMBER_PROTOCOL_SERVICE,
    REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
    'recordJournal',
  ])
})

test('Membership Protocol service follows the Cordis Plugin Fiber lifecycle', async () => {
  await withDirectory(async (directory) => {
    const context = new Context()

    const entityFiber = context.plugin(coreEntityProvider)
    const recordFiber = context.plugin(coreRecordProvider)
    const journalFiber = context.plugin(RecordJournalService, { directory })
    await Promise.all([
      entityFiber.await(),
      recordFiber.await(),
      journalFiber.await(),
    ])

    const memberFiber = context.plugin(memberIdentityPlugin, {
      protocolHash: MEMBER_PROTOCOL_HASH,
    })
    await memberFiber.await()

    const repoFiber = context.plugin(repoEstablishmentPlugin, {
      protocolHash: REPO_PROTOCOL_HASH,
    })
    await repoFiber.await()

    const membershipFiber = context.plugin(membershipPlugin, {
      protocolHash: MEMBERSHIP_PROTOCOL_HASH,
    })
    await membershipFiber.await()

    assert.ok(context.get(MEMBER_PROTOCOL_SERVICE))
    assert.ok(context.get(REPO_ESTABLISHMENT_PROTOCOL_SERVICE))
    assert.ok(context.get(MEMBERSHIP_PROTOCOL_SERVICE))

    await membershipFiber.dispose()

    assert.ok(context.get(MEMBER_PROTOCOL_SERVICE))
    assert.ok(context.get(REPO_ESTABLISHMENT_PROTOCOL_SERVICE))
    assert.equal(context.get(MEMBERSHIP_PROTOCOL_SERVICE), undefined)

    await context.fiber.dispose()
  })
})

test('Repo-signed add, check, list and later remove derive current membership', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const add = membershipRecord(
      'membership-add',
      'add',
      MEMBER_KEY,
      '2026-09-19T00:00:02.000Z',
    )
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: true,
        latestRecordId: add.id,
        effectiveAt: add.createdAt,
      },
    )
    assert.equal(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].hasMember(
        REPO_KEY,
        MEMBER_KEY,
      ),
      true,
    )
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].listMembers(REPO_KEY),
      [MEMBER_KEY],
    )

    const remove = membershipRecord(
      'membership-remove',
      'remove',
      MEMBER_KEY,
      '2026-09-19T00:00:03.000Z',
    )
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(remove),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: false,
        latestRecordId: remove.id,
        effectiveAt: remove.createdAt,
      },
    )
    assert.equal(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].hasMember(
        REPO_KEY,
        MEMBER_KEY,
      ),
      false,
    )

    assert.deepEqual(await node.context.recordJournal.get(add.id), add)
    assert.deepEqual(await node.context.recordJournal.get(remove.id), remove)
    await node.dispose()
  })
})

test('membership Record must be signed by the Repo identity', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const record = membershipRecord(
      'operator-signed-membership',
      'add',
      MEMBER_KEY,
      '2026-09-19T00:00:02.000Z',
      OPERATOR_KEY,
    )

    await assert.rejects(
      node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(record),
      MembershipAuthorizationError,
    )
    await assert.rejects(
      node.context.recordJournal.get(record.id),
      RecordJournalNotFoundError,
    )

    await node.dispose()
  })
})

test('non-Member Entity cannot become a Repo member', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const record = membershipRecord(
      'non-member-add',
      'add',
      NON_MEMBER_KEY,
    )

    await assert.rejects(
      node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(record),
      MembershipTargetMemberError,
    )

    await node.dispose()
  })
})

test('repeated membership facts remain set-like without a predecessor chain', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const first = membershipRecord(
      'repeated-add-a',
      'add',
      MEMBER_KEY,
      '2026-09-19T00:00:02.000Z',
    )
    const second = membershipRecord(
      'repeated-add-b',
      'add',
      MEMBER_KEY,
      '2026-09-19T00:00:03.000Z',
    )

    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(first)
    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(second)

    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].listMembers(REPO_KEY),
      [MEMBER_KEY],
    )
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].getMembership(
        REPO_KEY,
        MEMBER_KEY,
      ),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: true,
        latestRecordId: second.id,
        effectiveAt: second.createdAt,
      },
    )

    await node.dispose()
  })
})

test('exact accepted membership Record replay is idempotent', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const add = membershipRecord('replay-add', 'add')
    const first =
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add)
    const second =
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add)

    assert.deepEqual(second, first)
    await node.dispose()
  })
})

test('latest effective time wins regardless of journal enumeration order', async () => {
  await withDirectory(async (directory) => {
    const journalNode = await createRepositoryNode({
      plugins: [
        { plugin: coreEntityProvider },
        { plugin: coreRecordProvider },
        { plugin: RecordJournalService, config: { directory } },
      ],
    })

    await journalNode.context.recordJournal.accept(memberRecord(OPERATOR_KEY))
    await journalNode.context.recordJournal.accept(memberRecord(MEMBER_KEY))
    await journalNode.context.recordJournal.accept(repoRecord())

    const later = membershipRecord(
      'time-order-later',
      'remove',
      MEMBER_KEY,
      '2026-09-19T00:00:04.000Z',
      REPO_KEY,
      { id: '0'.repeat(64) },
    )
    const earlier = membershipRecord(
      'time-order-earlier',
      'add',
      MEMBER_KEY,
      '2026-09-19T00:00:02.000Z',
      REPO_KEY,
      { id: 'f'.repeat(64) },
    )

    await journalNode.context.recordJournal.accept(later)
    await journalNode.context.recordJournal.accept(earlier)
    await journalNode.dispose()

    const node = await createRepositoryNode({ plugins: composition(directory) })

    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].getMembership(
        REPO_KEY,
        MEMBER_KEY,
      ),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: false,
        latestRecordId: later.id,
        effectiveAt: later.createdAt,
      },
    )

    await node.dispose()
  })
})

test('older historical fact is retained without replacing current membership', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const current = membershipRecord(
      'current-remove',
      'remove',
      MEMBER_KEY,
      '2026-09-19T00:00:04.000Z',
    )
    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(current)

    const historical = membershipRecord(
      'historical-add',
      'add',
      MEMBER_KEY,
      '2026-09-19T00:00:02.000Z',
    )
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(historical),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: false,
        latestRecordId: current.id,
        effectiveAt: current.createdAt,
      },
    )
    assert.deepEqual(
      await node.context.recordJournal.get(historical.id),
      historical,
    )

    await node.dispose()
  })
})

test('distinct membership facts at the same effective time fail closed', async () => {
  await withDirectory(async (directory) => {
    const first = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(first)

    const add = membershipRecord(
      'same-time-add',
      'add',
      MEMBER_KEY,
      '2026-09-19T00:00:02.000Z',
    )
    await first.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add)
    await first.dispose()

    const journal = await createRepositoryNode({
      plugins: [{ plugin: RecordJournalService, config: { directory } }],
    })
    await journal.context.recordJournal.accept(
      membershipRecord(
        'same-time-remove',
        'remove',
        MEMBER_KEY,
        '2026-09-19T00:00:02.000Z',
      ),
    )
    await journal.dispose()

    await assert.rejects(
      createRepositoryNode({ plugins: composition(directory) }),
      (error: unknown) => {
        assert.ok(error instanceof BootstrapStartupError)
        assert.equal(hasCause(error, MembershipHistoryError), true)
        return true
      },
    )
  })
})

test('membership current view survives restart from durable facts', async () => {
  await withDirectory(async (directory) => {
    const first = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(first)

    const add = membershipRecord(
      'restart-add',
      'add',
      MEMBER_KEY,
      '2026-09-19T00:00:02.000Z',
    )
    const remove = membershipRecord(
      'restart-remove',
      'remove',
      MEMBER_KEY,
      '2026-09-19T00:00:03.000Z',
    )

    await first.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add)
    await first.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(remove)
    await first.dispose()

    const second = await createRepositoryNode({ plugins: composition(directory) })
    assert.deepEqual(
      await second.context[MEMBERSHIP_PROTOCOL_SERVICE].getMembership(
        REPO_KEY,
        MEMBER_KEY,
      ),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: false,
        latestRecordId: remove.id,
        effectiveAt: remove.createdAt,
      },
    )
    await second.dispose()
  })
})

test('membership reads refresh from durable journal facts', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const add = membershipRecord(
      'refresh-add',
      'add',
      MEMBER_KEY,
      '2026-09-19T00:00:02.000Z',
    )
    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add)

    const remove = membershipRecord(
      'refresh-remove',
      'remove',
      MEMBER_KEY,
      '2026-09-19T00:00:03.000Z',
    )
    await node.context.recordJournal.accept(remove)

    assert.equal(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].hasMember(
        REPO_KEY,
        MEMBER_KEY,
      ),
      false,
    )

    await node.dispose()
  })
})

test('Repo lookup errors are not reclassified as membership absence', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    await assert.rejects(
      node.context[MEMBERSHIP_PROTOCOL_SERVICE].getMembership(
        NON_MEMBER_KEY,
        MEMBER_KEY,
      ),
      RepoNotFoundError,
    )

    await node.dispose()
  })
})

test('membership rejects invalid Protocol, signature, payload and effective time', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)
    const service = node.context[MEMBERSHIP_PROTOCOL_SERVICE]

    await assert.rejects(
      service.applyMembership(
        membershipRecord('wrong-ref', 'add', MEMBER_KEY, undefined, REPO_KEY, {
          protocol: 'repo.other@0.1.0',
        }),
      ),
      MembershipMutationError,
    )
    await assert.rejects(
      service.applyMembership(
        membershipRecord('wrong-hash', 'add', MEMBER_KEY, undefined, REPO_KEY, {
          protocolHash: 'd'.repeat(64),
        }),
      ),
      MembershipMutationError,
    )
    await assert.rejects(
      service.applyMembership(
        membershipRecord('bad-signature', 'add', MEMBER_KEY, undefined, REPO_KEY, {
          signature: 'invalid-signature',
        }),
      ),
      MembershipMutationError,
    )
    await assert.rejects(
      service.applyMembership(
        membershipRecord('bad-payload', 'add', MEMBER_KEY, undefined, REPO_KEY, {
          data: {
            repo: REPO_KEY,
            member: MEMBER_KEY,
            action: 'add',
            extra: true,
          },
        }),
      ),
      MembershipMutationError,
    )
    await assert.rejects(
      service.applyMembership(
        membershipRecord(
          'bad-time',
          'add',
          MEMBER_KEY,
          'not-a-time',
        ),
      ),
      MembershipMutationError,
    )

    await node.dispose()
  })
})

test('Host must supply the exact Membership ProtocolHash', async () => {
  await withDirectory(async (directory) => {
    await assert.rejects(
      membershipPlugin.apply(
        {} as Context,
        { protocolHash: 'not-a-hash' },
      ),
      MembershipProtocolConfigError,
    )

    await assert.rejects(
      createRepositoryNode({
        plugins: [
          {
            plugin: membershipPlugin,
            config: { protocolHash: 'not-a-hash' },
          },
          {
            plugin: repoEstablishmentPlugin,
            config: { protocolHash: REPO_PROTOCOL_HASH },
          },
          {
            plugin: memberIdentityPlugin,
            config: { protocolHash: MEMBER_PROTOCOL_HASH },
          },
          { plugin: coreEntityProvider },
          { plugin: coreRecordProvider },
          { plugin: RecordJournalService, config: { directory } },
        ],
      }),
      BootstrapStartupError,
    )
  })
})
