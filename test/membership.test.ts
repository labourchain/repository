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
  MembershipStaleMutationError,
  MembershipTargetMemberError,
  RecordJournalNotFoundError,
  RecordJournalService,
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

function memberRecord(
  identity: string,
  label = 'member-' + identity,
): CoreRecordValue {
  return {
    id: recordId(label),
    protocol: MEMBER_PROTOCOL_REFERENCE,
    protocolHash: MEMBER_PROTOCOL_HASH,
    createdBy: identity,
    createdAt: '2026-09-19T00:00:00.000Z',
    signature: 'valid-signature',
    data: {},
  }
}

function repoRecord(label = 'repo-establishment'): CoreRecordValue {
  return {
    id: recordId(label),
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
  previous: string | null = null,
  createdBy = OPERATOR_KEY,
  overrides: Partial<CoreRecordValue> = {},
): CoreRecordValue {
  return {
    id: recordId(label),
    protocol: MEMBERSHIP_PROTOCOL_REFERENCE,
    protocolHash: MEMBERSHIP_PROTOCOL_HASH,
    createdBy,
    createdAt: '2026-09-19T00:00:02.000Z',
    signature: 'valid-signature',
    data: {
      repo: REPO_KEY,
      member,
      action,
      previous,
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

async function membershipRecordIds(
  node: Awaited<ReturnType<typeof createRepositoryNode>>,
): Promise<string[]> {
  const ids: string[] = []
  for await (const record of node.context.recordJournal.iterateAccepted()) {
    if (
      (record as Partial<CoreRecordValue>).protocol ===
      MEMBERSHIP_PROTOCOL_REFERENCE
    ) {
      ids.push(record.id)
    }
  }
  return ids
}

function hasCause(
  error: unknown,
  constructor: new (...args: any[]) => Error,
): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if (current instanceof constructor) return true
    current = current.cause
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

test('Repo operator can add, list, check and remove a Member', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const add = membershipRecord('membership-add', 'add')
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: true,
        headRecordId: add.id,
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
      add.id,
    )
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(remove),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: false,
        headRecordId: remove.id,
      },
    )
    assert.equal(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].hasMember(
        REPO_KEY,
        MEMBER_KEY,
      ),
      false,
    )
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].listMembers(REPO_KEY),
      [],
    )

    assert.deepEqual(await node.context.recordJournal.get(add.id), add)
    assert.deepEqual(await node.context.recordJournal.get(remove.id), remove)
    await node.dispose()
  })
})

test('active member listing is set-like and deterministic', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const second = membershipRecord(
      'second-member-add',
      'add',
      SECOND_MEMBER_KEY,
    )
    const first = membershipRecord('first-member-add', 'add', MEMBER_KEY)

    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(second)
    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(first)

    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].listMembers(REPO_KEY),
      [MEMBER_KEY, SECOND_MEMBER_KEY],
    )

    await node.dispose()
  })
})

test('non-operator cannot mutate membership', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const record = membershipRecord(
      'unauthorized-add',
      'add',
      MEMBER_KEY,
      null,
      OTHER_ACTOR_KEY,
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
    await assert.rejects(
      node.context.recordJournal.get(record.id),
      RecordJournalNotFoundError,
    )

    await node.dispose()
  })
})

test('duplicate add and missing remove are no-ops without new durable facts', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const missingRemove = membershipRecord(
      'missing-remove',
      'remove',
      MEMBER_KEY,
      null,
    )
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(
        missingRemove,
      ),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: false,
        headRecordId: null,
      },
    )
    await assert.rejects(
      node.context.recordJournal.get(missingRemove.id),
      RecordJournalNotFoundError,
    )

    const add = membershipRecord('no-op-add-root', 'add')
    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add)

    const duplicateAdd = membershipRecord(
      'duplicate-add',
      'add',
      MEMBER_KEY,
      add.id,
    )
    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(
        duplicateAdd,
      ),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: true,
        headRecordId: add.id,
      },
    )
    await assert.rejects(
      node.context.recordJournal.get(duplicateAdd.id),
      RecordJournalNotFoundError,
    )
    assert.deepEqual(await membershipRecordIds(node), [add.id])

    await node.dispose()
  })
})

test('exact accepted mutation replay is idempotent even after later state', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const add = membershipRecord('replay-add', 'add')
    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add)

    const remove = membershipRecord(
      'replay-remove',
      'remove',
      MEMBER_KEY,
      add.id,
    )
    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(remove)

    assert.deepEqual(
      await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add),
      {
        repo: REPO_KEY,
        member: MEMBER_KEY,
        active: false,
        headRecordId: remove.id,
      },
    )
    assert.deepEqual(
      new Set(await membershipRecordIds(node)),
      new Set([add.id, remove.id]),
    )

    await node.dispose()
  })
})

test('stale predecessor cannot overwrite the current relation head', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const add = membershipRecord('stale-add', 'add')
    await node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add)

    const stale = membershipRecord(
      'stale-remove',
      'remove',
      MEMBER_KEY,
      null,
    )
    await assert.rejects(
      node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(stale),
      MembershipStaleMutationError,
    )
    await assert.rejects(
      node.context.recordJournal.get(stale.id),
      RecordJournalNotFoundError,
    )

    await node.dispose()
  })
})

test('same-node competing mutations cannot both consume one relation head', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)

    const first = membershipRecord('concurrent-add-a', 'add')
    const second = membershipRecord('concurrent-add-b', 'add')

    const results = await Promise.allSettled([
      node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(first),
      node.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(second),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    assert.equal(fulfilled.length, 1)
    assert.equal(rejected.length, 1)
    const rejectedResult = rejected[0]
    if (!rejectedResult || rejectedResult.status !== 'rejected') {
      assert.fail('expected exactly one rejected membership mutation')
    }
    assert.ok(rejectedResult.reason instanceof MembershipStaleMutationError)
    assert.equal((await membershipRecordIds(node)).length, 1)

    await node.dispose()
  })
})

test('membership rebuild follows predecessor links, not journal enumeration order', async () => {
  await withDirectory(async (directory) => {
    const first = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(first)

    const add = membershipRecord('order-add', 'add', MEMBER_KEY, null, OPERATOR_KEY, {
      id: 'f'.repeat(64),
    })
    const remove = membershipRecord(
      'order-remove',
      'remove',
      MEMBER_KEY,
      add.id,
      OPERATOR_KEY,
      { id: '0'.repeat(64) },
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
        headRecordId: remove.id,
      },
    )

    await second.dispose()
  })
})

test('startup rebuild fails closed on forked durable membership history', async () => {
  await withDirectory(async (directory) => {
    const first = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(first)

    const add = membershipRecord('fork-add', 'add')
    await first.context[MEMBERSHIP_PROTOCOL_SERVICE].applyMembership(add)
    await first.dispose()

    const journal = await createRepositoryNode({
      plugins: [{ plugin: RecordJournalService, config: { directory } }],
    })
    await journal.context.recordJournal.accept(
      membershipRecord('fork-remove-a', 'remove', MEMBER_KEY, add.id),
    )
    await journal.context.recordJournal.accept(
      membershipRecord('fork-remove-b', 'remove', MEMBER_KEY, add.id),
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

test('Membership mutation rejects wrong Protocol, hash, signature, payload and predecessor', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await setupRepo(node)
    const service = node.context[MEMBERSHIP_PROTOCOL_SERVICE]

    await assert.rejects(
      service.applyMembership(
        membershipRecord('wrong-ref', 'add', MEMBER_KEY, null, OPERATOR_KEY, {
          protocol: 'repo.other@0.1.0',
        }),
      ),
      MembershipMutationError,
    )
    await assert.rejects(
      service.applyMembership(
        membershipRecord('wrong-hash', 'add', MEMBER_KEY, null, OPERATOR_KEY, {
          protocolHash: 'd'.repeat(64),
        }),
      ),
      MembershipMutationError,
    )
    await assert.rejects(
      service.applyMembership(
        membershipRecord('bad-signature', 'add', MEMBER_KEY, null, OPERATOR_KEY, {
          signature: 'invalid-signature',
        }),
      ),
      MembershipMutationError,
    )
    await assert.rejects(
      service.applyMembership(
        membershipRecord('bad-payload', 'add', MEMBER_KEY, null, OPERATOR_KEY, {
          data: {
            repo: REPO_KEY,
            member: MEMBER_KEY,
            action: 'add',
            previous: null,
            role: 'admin',
          },
        }),
      ),
      MembershipMutationError,
    )
    await assert.rejects(
      service.applyMembership(
        membershipRecord('bad-previous', 'add', MEMBER_KEY, null, OPERATOR_KEY, {
          data: {
            repo: REPO_KEY,
            member: MEMBER_KEY,
            action: 'add',
            previous: 'not-a-record-id',
          },
        }),
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
