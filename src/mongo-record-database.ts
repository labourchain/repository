import { isDeepStrictEqual } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import { MongoClient, type Collection } from 'mongodb'
import {
  RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE,
  isProtectedRepositoryPublication,
} from './internal-publication.ts'
import { RUNTIME_RECORD_DATABASE_SERVICE, type RuntimeRecord,
  type RuntimeRecordDatabase, type RuntimeRecordDatabaseSession,
} from './runtime-record-database.ts'

export const RUNTIME_RECORD_DATABASE_PLUGIN_NAME =
  'runtime.record-database' as const

export interface MongoRecordDatabaseConfig {
  readonly uri: string
  readonly databaseName: string
}

interface StoredRecord {
  _id: string
  serialized: string
}

export class RuntimeRecordDatabaseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RuntimeRecordDatabaseError'
  }
}

export class RuntimeRecordDatabaseInputError extends RuntimeRecordDatabaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RuntimeRecordDatabaseInputError'
  }
}

export class RuntimeRecordDatabaseNotFoundError extends RuntimeRecordDatabaseError {
  readonly recordId: string
  constructor(recordId: string) {
    super('Persisted Record not found: ' + recordId)
    this.name = 'RuntimeRecordDatabaseNotFoundError'
    this.recordId = recordId
  }
}

export class RuntimeRecordDatabaseConflictError extends RuntimeRecordDatabaseError {
  readonly recordId: string
  constructor(recordId: string) {
    super('Conflicting persisted RecordId: ' + recordId)
    this.name = 'RuntimeRecordDatabaseConflictError'
    this.recordId = recordId
  }
}

export class RuntimeRecordDatabaseStorageError extends RuntimeRecordDatabaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RuntimeRecordDatabaseStorageError'
  }
}

export class RuntimeRecordDatabaseCorruptionError extends RuntimeRecordDatabaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RuntimeRecordDatabaseCorruptionError'
  }
}

export class RuntimeRecordDatabasePublicationError extends RuntimeRecordDatabaseError {
  constructor() {
    super('repo.contribution must be published through RepositoryContributionService.')
    this.name = 'RuntimeRecordDatabasePublicationError'
  }
}

function lookupId(recordId: string): string {
  if (typeof recordId !== 'string' || recordId.length === 0) {
    throw new RuntimeRecordDatabaseInputError('RecordId must be non-empty.')
  }
  return recordId
}

function isExactJsonValue(original: unknown, restored: unknown): boolean {
  if (Object.is(original, restored)) return true
  if (typeof original !== 'object' || original === null ||
      typeof restored !== 'object' || restored === null) return false
  const isArray = Array.isArray(original)
  if (isArray !== Array.isArray(restored)) return false
  const prototype = Object.getPrototypeOf(original)
  if (isArray ? prototype !== Array.prototype :
      prototype !== Object.prototype && prototype !== null) return false
  const keys = Reflect.ownKeys(original)
  const restoredKeys = Reflect.ownKeys(restored)
  if (keys.length !== restoredKeys.length ||
      keys.some((key, index) => key !== restoredKeys[index])) return false
  return keys.every((key) => {
    const a = Object.getOwnPropertyDescriptor(original, key)
    const b = Object.getOwnPropertyDescriptor(restored, key)
    return !!a && !!b && 'value' in a && 'value' in b &&
      a.enumerable === b.enumerable &&
      isExactJsonValue(a.value, b.value)
  })
}

function snapshot(record: RuntimeRecord): StoredRecord {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    throw new RuntimeRecordDatabaseInputError('Record must be an object.')
  }
  const id = Object.getOwnPropertyDescriptor(record, 'id')
  if (!id || !('value' in id)) {
    throw new RuntimeRecordDatabaseInputError('Record must have an own RecordId.')
  }
  const recordId = lookupId(id.value)
  let serialized: string
  try {
    serialized = JSON.stringify(record)
    if (typeof serialized !== 'string') throw new Error('Missing JSON.')
    const stored = JSON.parse(serialized) as RuntimeRecord
    if (stored.id !== recordId || !isExactJsonValue(record, stored)) {
      throw new Error('Record changes during JSON serialization.')
    }
  } catch (cause) {
    throw new RuntimeRecordDatabaseInputError('Record is not persistable JSON.', { cause })
  }
  return { _id: recordId, serialized }
}

function unpack(doc: StoredRecord): RuntimeRecord {
  try {
    const value = JSON.parse(doc.serialized) as RuntimeRecord
    if (typeof value !== 'object' || value === null ||
        Array.isArray(value) || value.id !== doc._id) {
      throw new Error('Persisted RecordId mismatch.')
    }
    return value
  } catch (cause) {
    throw new RuntimeRecordDatabaseCorruptionError(
      'Invalid persisted Record for ' + doc._id, { cause },
    )
  }
}

function duplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    'code' in error && error.code === 11000
}

/** One owning Node: serialized domain mutation boundaries, no DB transaction layer. */
export class MongoRuntimeRecordDatabaseService implements RuntimeRecordDatabase {
  private gate: Promise<void> = Promise.resolve()
  private readonly records: Collection<StoredRecord>
  constructor(records: Collection<StoredRecord>) {
    this.records = records
  }

  async runExclusive<T>(
    operation: (database: RuntimeRecordDatabaseSession) => Promise<T>,
  ): Promise<T> {
    return this.exclusive(operation, false)
  }

  async [RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE]<T>(
    operation: (database: RuntimeRecordDatabaseSession) => Promise<T>,
  ): Promise<T> {
    return this.exclusive(operation, true)
  }

  private async exclusive<T>(
    operation: (database: RuntimeRecordDatabaseSession) => Promise<T>,
    internal: boolean,
  ): Promise<T> {
    const previous = this.gate
    let release!: () => void
    this.gate = new Promise<void>((resolve) => { release = resolve })
    await previous
    try {
      return await operation({
        accept: async (record) => {
          const value = snapshot(record)
          if (!internal && isProtectedRepositoryPublication(
            JSON.parse(value.serialized) as RuntimeRecord,
          )) {
            throw new RuntimeRecordDatabasePublicationError()
          }
          await this.store(value)
        },
        get: (id) => this.get(id),
        iterateAccepted: () => this.iterateAccepted(),
      })
    } finally {
      release()
    }
  }

  private async store(value: StoredRecord): Promise<void> {
    try {
      await this.records.insertOne(value)
      return
    } catch (cause) {
      if (!duplicateKey(cause)) {
        throw new RuntimeRecordDatabaseStorageError(
          'MongoDB could not persist Record ' + value._id, { cause },
        )
      }
    }

    const stored = await this.load(value._id)
    if (!stored || !isDeepStrictEqual(unpack(stored), unpack(value))) {
      throw new RuntimeRecordDatabaseConflictError(value._id)
    }
  }

  private async load(recordId: string): Promise<StoredRecord | null> {
    try {
      return await this.records.findOne({ _id: recordId })
    } catch (cause) {
      throw new RuntimeRecordDatabaseStorageError(
        'MongoDB could not read Record ' + recordId, { cause },
      )
    }
  }

  async get(recordId: string): Promise<RuntimeRecord> {
    const id = lookupId(recordId)
    const stored = await this.load(id)
    if (!stored) throw new RuntimeRecordDatabaseNotFoundError(id)
    return unpack(stored)
  }

  async *iterateAccepted(): AsyncIterableIterator<RuntimeRecord> {
    try {
      for await (const doc of this.records.find().sort({ _id: 1 })) {
        yield unpack(doc)
      }
    } catch (cause) {
      if (cause instanceof RuntimeRecordDatabaseCorruptionError) throw cause
      throw new RuntimeRecordDatabaseStorageError(
        'MongoDB could not enumerate persisted Records.', { cause },
      )
    }
  }
}

export const runtimeRecordDatabasePlugin = {
  name: RUNTIME_RECORD_DATABASE_PLUGIN_NAME,
  provide: RUNTIME_RECORD_DATABASE_SERVICE,
  inject: [],
  async apply(ctx: Context, config: MongoRecordDatabaseConfig): Promise<void> {
    if (!config || typeof config.uri !== 'string' || !config.uri ||
        typeof config.databaseName !== 'string' || !config.databaseName) {
      throw new RuntimeRecordDatabaseInputError(
        'MongoDB provider requires uri and databaseName.',
      )
    }

    const client = new MongoClient(config.uri)
    try {
      await client.connect()
    } catch (cause) {
      await client.close()
      throw new RuntimeRecordDatabaseStorageError(
        'MongoDB connection failed.', { cause },
      )
    }
    ctx.effect(() => () => client.close())
    ctx.provide(RUNTIME_RECORD_DATABASE_SERVICE,
      new MongoRuntimeRecordDatabaseService(
        client.db(config.databaseName).collection<StoredRecord>('records'),
      ),
    )
  },
}
