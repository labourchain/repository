import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setImmediate as delayImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { plugin as memberIdentityPlugin } from '../src/protocols/member.identity.ts'
import { plugin as repoEstablishmentPlugin } from '../src/protocols/repo.establishment.ts'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_REFERENCE,
  MEMBER_PROTOCOL_SERVICE,
  REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  BootstrapStartupError,
  RecordJournalNotFoundError,
  RecordJournalService,
  RepoAlreadyEstablishedError,
  RepoEstablishmentError,
  RepoOwnerMemberError,
  RepoNotFoundError,
  RepoProtocolConfigError,
  createRepositoryNode,
  type CoreRecordProtocolService,
  type CoreRecordValue,
} from '../src/index.ts'

const MEMBER_PROTOCOL_HASH = 'a'.repeat(64)
const REPO_PROTOCOL_HASH = 'b'.repeat(64)

const MEMBER_KEY = 'member-key'
const OTHER_MEMBER_KEY = 'other-member-key'
const NON_MEMBER_KEY = 'non-member-key'
const REPO_KEY = 'repo-key'

const VALID_KEYS = new Set([
  MEMBER_KEY,
  OTHER_MEMBER_KEY,
  NON_MEMBER_KEY,
  REPO_KEY,
])

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
  id: string,
  identity = MEMBER_KEY,
): CoreRecordValue {
  return {
    id,
    protocol: MEMBER_PROTOCOL_REFERENCE,
    protocolHash: MEMBER_PROTOCOL_HASH,
    createdBy: identity,
    createdAt: '2026-09-19T00:00:00.000Z',
    signature: 'valid-signature',
    data: {},
  }
}

function repoRecord(
  id: string,
  repoIdentity = REPO_KEY,
  owner = MEMBER_KEY,
  overrides: Partial<CoreRecordValue> = {},
): CoreRecordValue {
  return {
    id,
    protocol: REPO_ESTABLISHMENT_PROTOCOL_REFERENCE,
    protocolHash: REPO_PROTOCOL_HASH,
    createdBy: repoIdentity,
    createdAt: '2026-09-19T00:00:01.000Z',
    signature: 'valid-signature',
    data: { owner },
    ...overrides,
  }
}

async function withDirectory<T>(
  run: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'labourchain-repo-test-'))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function composition(directory: string) {
  return [
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

async function declareMember(
  node: Awaited<ReturnType<typeof createRepositoryNode>>,
  identity = MEMBER_KEY,
): Promise<void> {
  await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(
    memberRecord('member-' + identity, identity),
  )
}

function hasCause(error: unknown, constructor: new (...args: any[]) => Error): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if (current instanceof constructor) return true
    current = (current as Error).cause
  }
  return false
}

test('Repo Protocol artifact entry exports exactly one named plugin', async () => {
  const namespace = await import('../src/protocols/repo.establishment.ts')

  assert.deepEqual(Object.keys(namespace), ['plugin'])
  assert.equal(namespace.plugin.name, REPO_ESTABLISHMENT_PROTOCOL_REFERENCE)
  assert.equal(namespace.plugin.provide, REPO_ESTABLISHMENT_PROTOCOL_SERVICE)
  assert.deepEqual(namespace.plugin.inject, [
    CORE_ENTITY_PROTOCOL_SERVICE,
    CORE_RECORD_PROTOCOL_SERVICE,
    MEMBER_PROTOCOL_SERVICE,
    'recordJournal',
  ])
})

test('Repo Protocol service follows the Cordis Plugin Fiber lifecycle', async () => {
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

    assert.ok(context.get(MEMBER_PROTOCOL_SERVICE))
    assert.ok(context.get(REPO_ESTABLISHMENT_PROTOCOL_SERVICE))

    await repoFiber.dispose()

    assert.ok(context.get(MEMBER_PROTOCOL_SERVICE))
    assert.equal(
      context.get(REPO_ESTABLISHMENT_PROTOCOL_SERVICE),
      undefined,
    )

    await context.fiber.dispose()
  })
})

test('a valid Member establishes and loads a Repo from the exact Record', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)

    const record = repoRecord('repo-establishment-1')
    const established = await node.context[
      REPO_ESTABLISHMENT_PROTOCOL_SERVICE
    ].establishRepo(record)
    const loaded = await node.context[
      REPO_ESTABLISHMENT_PROTOCOL_SERVICE
    ].loadRepo(REPO_KEY)

    assert.deepEqual(established, {
      identity: REPO_KEY,
      owner: MEMBER_KEY,
      establishmentRecordId: record.id,
    })
    assert.deepEqual(loaded, established)
    assert.deepEqual(await node.context.recordJournal.get(record.id), record)

    await node.dispose()
  })
})

test('Repo identity and initial owner rebuild from durable facts after restart', async () => {
  await withDirectory(async (directory) => {
    const first = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(first)

    const record = repoRecord('repo-establishment-restart')
    await first.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(record)
    await first.dispose()

    const second = await createRepositoryNode({ plugins: composition(directory) })
    assert.deepEqual(
      await second.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].loadRepo(REPO_KEY),
      {
        identity: REPO_KEY,
        owner: MEMBER_KEY,
        establishmentRecordId: record.id,
      },
    )

    await second.dispose()
  })
})

test('a Repo cannot establish with an owner that is not a Member', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })

    await assert.rejects(
      node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(
        repoRecord('repo-non-member', REPO_KEY, NON_MEMBER_KEY),
      ),
      RepoOwnerMemberError,
    )

    await assert.rejects(
      node.context.recordJournal.get('repo-non-member'),
      RecordJournalNotFoundError,
    )

    await node.dispose()
  })
})

test('the same Entity identity can compose Member and Repo capability', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)

    const record = repoRecord('member-scoped-repo', MEMBER_KEY)
    assert.deepEqual(
      await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(record),
      {
        identity: MEMBER_KEY,
        owner: MEMBER_KEY,
        establishmentRecordId: record.id,
      },
    )

    assert.deepEqual(
      await node.context[MEMBER_PROTOCOL_SERVICE].requireMember(MEMBER_KEY),
      { identity: MEMBER_KEY },
    )

    await node.dispose()
  })
})

test('exact establishment replay is idempotent', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)

    const record = repoRecord('repo-idempotent')
    const first =
      await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(record)
    const second =
      await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(record)

    assert.deepEqual(second, first)
    await node.dispose()
  })
})

test('a conflicting second establishment cannot replace the first owner source', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)
    await declareMember(node, OTHER_MEMBER_KEY)

    const first = repoRecord('repo-first')
    const conflicting = repoRecord(
      'repo-conflicting',
      REPO_KEY,
      OTHER_MEMBER_KEY,
    )

    await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(first)

    await assert.rejects(
      node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(conflicting),
      RepoAlreadyEstablishedError,
    )
    await assert.rejects(
      node.context.recordJournal.get(conflicting.id),
      RecordJournalNotFoundError,
    )

    assert.deepEqual(
      await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].loadRepo(REPO_KEY),
      {
        identity: REPO_KEY,
        owner: MEMBER_KEY,
        establishmentRecordId: first.id,
      },
    )

    await node.dispose()
  })
})

test('raw journal acceptance cannot interleave with Repo establishment check and publish', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)
    await declareMember(node, OTHER_MEMBER_KEY)

    const incoming = repoRecord('repo-gated-incoming')
    const durableConflict = repoRecord(
      'repo-gated-conflict',
      REPO_KEY,
      OTHER_MEMBER_KEY,
    )

    let pending: Promise<unknown> | undefined

    await node.context.recordJournal.runExclusive(async (journal) => {
      pending =
        node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(incoming)

      await delayImmediate()
      await journal.accept(durableConflict)
    })

    assert.ok(pending)
    await assert.rejects(pending, RepoAlreadyEstablishedError)
    await assert.rejects(
      node.context.recordJournal.get(incoming.id),
      RecordJournalNotFoundError,
    )
    assert.deepEqual(
      await node.context.recordJournal.get(durableConflict.id),
      durableConflict,
    )

    await node.dispose()
  })
})

test('same-node concurrent establishments preserve one accepted Repo fact', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)
    await declareMember(node, OTHER_MEMBER_KEY)

    const first = repoRecord('repo-concurrent-a')
    const second = repoRecord(
      'repo-concurrent-b',
      REPO_KEY,
      OTHER_MEMBER_KEY,
    )

    const results = await Promise.allSettled([
      node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(first),
      node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(second),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    assert.equal(fulfilled.length, 1)
    assert.equal(rejected.length, 1)

    const rejectedResult = rejected[0]
    if (!rejectedResult || rejectedResult.status !== 'rejected') {
      assert.fail('expected exactly one rejected establishment')
    }
    assert.ok(rejectedResult.reason instanceof RepoAlreadyEstablishedError)

    const accepted = fulfilled[0]
    if (!accepted || accepted.status !== 'fulfilled') {
      assert.fail('expected exactly one fulfilled establishment')
    }
    const loaded = await node.context[
      REPO_ESTABLISHMENT_PROTOCOL_SERVICE
    ].loadRepo(REPO_KEY)
    assert.deepEqual(loaded, accepted.value)

    const acceptedRecordIds: string[] = []
    for await (const record of node.context.recordJournal.iterateAccepted()) {
      if (
        (record as Partial<CoreRecordValue>).protocol ===
        REPO_ESTABLISHMENT_PROTOCOL_REFERENCE
      ) {
        acceptedRecordIds.push(record.id)
      }
    }
    assert.equal(acceptedRecordIds.length, 1)

    await node.dispose()
  })
})

test('missing Repo identity fails explicitly without implicit creation', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })

    await assert.rejects(
      node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].loadRepo(REPO_KEY),
      RepoNotFoundError,
    )

    await node.dispose()
  })
})

test('Repo establishment fails closed for wrong Protocol, hash, signature, payload, and identity', async () => {
  await withDirectory(async (directory) => {
    const node = await createRepositoryNode({ plugins: composition(directory) })
    await declareMember(node)

    const service = node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE]

    await assert.rejects(
      service.establishRepo(
        repoRecord('wrong-ref', REPO_KEY, MEMBER_KEY, {
          protocol: 'repo.other@0.1.0',
        }),
      ),
      RepoEstablishmentError,
    )
    await assert.rejects(
      service.establishRepo(
        repoRecord('wrong-hash', REPO_KEY, MEMBER_KEY, {
          protocolHash: 'c'.repeat(64),
        }),
      ),
      RepoEstablishmentError,
    )
    await assert.rejects(
      service.establishRepo(
        repoRecord('wrong-signature', REPO_KEY, MEMBER_KEY, {
          signature: 'invalid-signature',
        }),
      ),
      RepoEstablishmentError,
    )
    await assert.rejects(
      service.establishRepo(
        repoRecord('wrong-payload', REPO_KEY, MEMBER_KEY, {
          data: { owner: MEMBER_KEY, repo: REPO_KEY },
        }),
      ),
      RepoEstablishmentError,
    )
    await assert.rejects(
      service.establishRepo(
        repoRecord('bad-repo-key', 'not-an-entity-key', MEMBER_KEY),
      ),
      RepoEstablishmentError,
    )
    await assert.rejects(
      service.loadRepo('not-an-entity-key'),
      RepoEstablishmentError,
    )

    await node.dispose()
  })
})

test('Host must supply the exact Repo ProtocolHash', async () => {
  await withDirectory(async (directory) => {
    await assert.rejects(
      repoEstablishmentPlugin.apply(
        {} as Context,
        { protocolHash: 'not-a-hash' },
      ),
      RepoProtocolConfigError,
    )

    await assert.rejects(
      createRepositoryNode({
        plugins: [
          {
            plugin: repoEstablishmentPlugin,
            config: { protocolHash: 'not-a-hash' },
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

test('startup rebuild fails closed if durable facts contain conflicting Repo establishments', async () => {
  await withDirectory(async (directory) => {
    const journalNode = await createRepositoryNode({
      plugins: [{ plugin: RecordJournalService, config: { directory } }],
    })

    await journalNode.context.recordJournal.accept(memberRecord('member-' + MEMBER_KEY))
    await journalNode.context.recordJournal.accept(
      memberRecord('member-' + OTHER_MEMBER_KEY, OTHER_MEMBER_KEY),
    )
    await journalNode.context.recordJournal.accept(repoRecord('repo-conflict-a'))
    await journalNode.context.recordJournal.accept(
      repoRecord('repo-conflict-b', REPO_KEY, OTHER_MEMBER_KEY),
    )
    await journalNode.dispose()

    await assert.rejects(
      createRepositoryNode({ plugins: composition(directory) }),
      (error: unknown) => {
        assert.ok(error instanceof BootstrapStartupError)
        assert.equal(hasCause(error, RepoAlreadyEstablishedError), true)
        return true
      },
    )
  })
})
