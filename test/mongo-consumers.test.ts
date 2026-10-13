import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { MongoClient } from 'mongodb'
import {
  CORE_ENTITY_PROTOCOL_SERVICE,
  CORE_RECORD_PROTOCOL_SERVICE,
  LABOUR_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_SERVICE,
  REPO_ESTABLISHMENT_PROTOCOL_SERVICE,
  RepoAlreadyEstablishedError,
  createRepositoryNode,
  runtimeRecordDatabasePlugin,
  type CoreRecordValue,
} from '../src/index.ts'
import { plugin as memberPlugin } from '../src/protocols/member.identity.ts'
import { plugin as repoPlugin } from '../src/protocols/repo.establishment.ts'
import { plugin as labourPlugin } from '../src/protocols/labour.record.ts'

const HASH = 'a'.repeat(64)

function coreProvider(ctx: Context) {
  ctx.provide(CORE_ENTITY_PROTOCOL_SERVICE, {
    validateEntityPublicKey(value: unknown) {
      if (typeof value !== 'string' || value.length === 0) throw Error('invalid key')
      return value
    },
    validateEntity(value: unknown) {
      const publicKey = (value as { publicKey?: unknown }).publicKey
      if (typeof publicKey !== 'string') throw Error('invalid entity')
      return { publicKey }
    },
  })
  ctx.provide(CORE_RECORD_PROTOCOL_SERVICE, {
    validateRecord(value: unknown) {
      const candidate = value as CoreRecordValue
      if (!candidate || typeof candidate.id !== 'string') throw Error('invalid record')
      return candidate
    },
    verifySignature(value: unknown) {
      const record = value as CoreRecordValue
      return record.signature === 'sig:' + record.createdBy
    },
  })
}

function signed(id: string, protocol: string, createdBy: string, data: unknown) {
  return {
    id, protocol, protocolHash: HASH, createdBy,
    createdAt: '2026-10-13T00:00:00Z',
    signature: 'sig:' + createdBy, data,
  }
}

test('Member, Repo and Labour consume the same MongoDB Record facts after restart', {
  skip: !process.env.MONGODB_TEST_URI,
}, async () => {
  const uri = process.env.MONGODB_TEST_URI!
  const databaseName = 'labourchain_domain_' + randomUUID().replaceAll('-', '')
  const plugins = [
    { plugin: repoPlugin, config: { protocolHash: HASH } },
    { plugin: labourPlugin, config: { protocolHash: HASH } },
    { plugin: memberPlugin, config: { protocolHash: HASH } },
    { plugin: coreProvider },
    { plugin: runtimeRecordDatabasePlugin, config: { uri, databaseName } },
  ]
  const member = signed('m1', 'member.identity@0.1.0', 'worker', {})
  const repo = signed('r1', 'repo.establishment@0.1.0', 'worker', {
    publicKey: 'repo',
  })
  const labour = signed('l1', 'labour.record@0.1.0', 'worker', {
    content: 'Completed a real task', duration: 1, references: [], assets: [],
  })
  let node: Awaited<ReturnType<typeof createRepositoryNode>> | undefined
  try {
    node = await createRepositoryNode({ plugins })
    await node.context[MEMBER_PROTOCOL_SERVICE].declareMember(member)
    await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(repo)
    await node.context[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord(labour)
    await node.dispose()

    node = await createRepositoryNode({ plugins })
    assert.deepEqual(await node.context[MEMBER_PROTOCOL_SERVICE].requireMember('worker'),
      { identity: 'worker' })
    assert.deepEqual(await node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].loadRepo('repo'),
      { identity: 'repo', createdBy: 'worker', establishmentRecordId: 'r1' })
    assert.equal((await node.context[LABOUR_RECORD_PROTOCOL_SERVICE]
      .loadLabourRecord('l1')).recordId, 'l1')
    await assert.rejects(
      node.context[REPO_ESTABLISHMENT_PROTOCOL_SERVICE].establishRepo(
        signed('r2', 'repo.establishment@0.1.0', 'worker', { publicKey: 'repo' }),
      ),
      RepoAlreadyEstablishedError,
    )
  } finally {
    if (node && !node.disposed) await node.dispose()
    const client = new MongoClient(uri)
    await client.connect()
    try {
      await client.db(databaseName).dropDatabase()
    } finally {
      await client.close()
    }
  }
})
