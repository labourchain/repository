import { randomUUID } from 'node:crypto'
import { link, mkdir, open, readFile, readdir, unlink } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { Service, type Context } from '@deepseek-ai/cordis'

export const RECORD_JOURNAL_SERVICE = 'recordJournal' as const
const RECORD_FILE_SUFFIX = '.record.json'

/**
 * Minimal Record shape required by the Runtime journal.
 *
 * Core remains the owner of Record representation, RecordId derivation and
 * signature validation. The journal only requires the already-validated `id`
 * for addressing and otherwise persists the complete runtime JSON value.
 */
export interface JournalRecord {
  readonly id: string
}

export interface RecordJournalConfig {
  /** Persistent directory used by this journal instance. */
  readonly directory: string
}

export interface RecordJournalTransaction {
  /** Accept one Record while the journal write gate is already held. */
  accept(record: JournalRecord): Promise<void>
  get(recordId: string): Promise<JournalRecord>
  iterateAccepted(): AsyncIterableIterator<JournalRecord>
}

export class RecordJournalError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RecordJournalError'
  }
}

export class RecordJournalInputError extends RecordJournalError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RecordJournalInputError'
  }
}

export class RecordJournalNotFoundError extends RecordJournalError {
  readonly recordId: string

  constructor(recordId: string) {
    super(`Record is not present in the durable journal: ${recordId}`)
    this.name = 'RecordJournalNotFoundError'
    this.recordId = recordId
  }
}

export class RecordJournalConflictError extends RecordJournalError {
  readonly recordId: string

  constructor(recordId: string) {
    super(`A non-equivalent Record already exists for RecordId: ${recordId}`)
    this.name = 'RecordJournalConflictError'
    this.recordId = recordId
  }
}

export class RecordJournalCorruptionError extends RecordJournalError {
  readonly file: string

  constructor(file: string, message: string, options?: ErrorOptions) {
    super(`${message}: ${file}`, options)
    this.name = 'RecordJournalCorruptionError'
    this.file = file
  }
}

export class RecordJournalStorageError extends RecordJournalError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RecordJournalStorageError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    recordJournal: RecordJournalService
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const code = (error as NodeJS.ErrnoException).code
  return typeof code === 'string' ? code : undefined
}

function requireRecordId(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RecordJournalInputError('Record journal input must be an object.')
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, 'id')
  if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string' || descriptor.value.length === 0) {
    throw new RecordJournalInputError('Record journal input must contain a non-empty own data-property `id`.')
  }

  return descriptor.value
}

function requireLookupId(recordId: string): string {
  if (typeof recordId !== 'string' || recordId.length === 0) {
    throw new RecordJournalInputError('RecordId lookup key must be a non-empty string.')
  }
  return recordId
}

function serializeRecord(record: JournalRecord): string {
  try {
    const serialized = JSON.stringify(record)
    if (serialized === undefined) {
      throw new TypeError('JSON serialization returned undefined.')
    }
    return `${serialized}\n`
  } catch (cause) {
    throw new RecordJournalInputError('Record cannot be persisted as JSON.', { cause })
  }
}

function parseStoredRecord(serialized: string, file: string): JournalRecord {
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch (cause) {
    throw new RecordJournalCorruptionError(file, 'Stored Record is not valid JSON', { cause })
  }

  try {
    requireRecordId(value)
  } catch (cause) {
    throw new RecordJournalCorruptionError(file, 'Stored Record does not contain a valid RecordId', { cause })
  }

  return value as JournalRecord
}

function recordFilename(recordId: string): string {
  // RecordId representation belongs to Core. Hex-encoding the UTF-8 lookup key
  // here is only a filesystem-safe reversible filename mapping.
  return `${Buffer.from(recordId, 'utf8').toString('hex')}${RECORD_FILE_SUFFIX}`
}

function compareNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

async function syncDirectory(directory: string): Promise<void> {
  // POSIX directory fsync makes the newly linked directory entry durable.
  // Windows does not expose the same directory-handle operation through Node.
  if (process.platform === 'win32') return

  const handle = await open(directory, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

/**
 * Repo-agnostic durable ingress for exact accepted Records.
 *
 * This service deliberately does not validate Core Record semantics, pack
 * Blocks, track chain confirmation, or attach Repository business meaning.
 */
export class RecordJournalService extends Service {
  readonly directory: string
  private operationGate: Promise<void> = Promise.resolve()

  constructor(ctx: Context, config: RecordJournalConfig) {
    super(ctx, RECORD_JOURNAL_SERVICE)

    if (!config || typeof config.directory !== 'string' || config.directory.length === 0) {
      throw new RecordJournalInputError('Record journal requires a non-empty persistent directory.')
    }

    this.directory = resolve(config.directory)
  }

  /** Durably accept one exact Record, idempotently by RecordId. */
  async accept(record: JournalRecord): Promise<void> {
    return this.runExclusive((journal) => journal.accept(record))
  }

  /**
   * Serialize one same-process journal mutation boundary.
   *
   * Runtime Record database validation uses this boundary so a raw journal
   * accept in the same node cannot interleave between relation validation and
   * durable publication.
   */
  async runExclusive<T>(
    operation: (journal: RecordJournalTransaction) => Promise<T>,
  ): Promise<T> {
    const previousGate = this.operationGate
    let release!: () => void
    this.operationGate = new Promise<void>((resolve) => {
      release = resolve
    })

    await previousGate
    try {
      const journal: RecordJournalTransaction = {
        accept: (record) => this.acceptUnlocked(record),
        get: (recordId) => this.get(recordId),
        iterateAccepted: () => this.iterateAccepted(),
      }
      return await operation(journal)
    } finally {
      release()
    }
  }

  private async acceptUnlocked(record: JournalRecord): Promise<void> {
      const recordId = requireRecordId(record)
      const serialized = serializeRecord(record)
  
      try {
        await mkdir(this.directory, { recursive: true })
      } catch (cause) {
        throw new RecordJournalStorageError(`Unable to prepare Record journal directory: ${this.directory}`, { cause })
      }
  
      const target = join(this.directory, recordFilename(recordId))
      const temporary = join(
        this.directory,
        `.record-${process.pid}-${randomUUID()}.tmp`,
      )
  
      let handle: Awaited<ReturnType<typeof open>> | undefined
  
      try {
        handle = await open(temporary, 'wx', 0o600)
        await handle.writeFile(serialized, 'utf8')
        await handle.sync()
        await handle.close()
        handle = undefined
  
        try {
          // Hard-link publication is atomic and does not overwrite an existing
          // RecordId, including when multiple processes accept concurrently.
          await link(temporary, target)
        } catch (cause) {
          if (errorCode(cause) !== 'EEXIST') {
            throw new RecordJournalStorageError(`Unable to publish Record ${recordId} into the journal.`, { cause })
          }
  
          const existing = await this.readStored(recordId, target, false)
          const incoming = parseStoredRecord(serialized, temporary)
          if (!isDeepStrictEqual(existing, incoming)) {
            throw new RecordJournalConflictError(recordId)
          }
  
          // A prior attempt may have linked the finalized file but failed before
          // syncing the directory. Retry must complete that durability boundary
          // before equivalent acceptance is reported as successful.
          await this.syncPublication(recordId)
          return
        }
  
        await this.syncPublication(recordId)
      } catch (cause) {
        if (cause instanceof RecordJournalError) throw cause
        throw new RecordJournalStorageError(`Unable to durably accept Record ${recordId}.`, { cause })
      } finally {
        if (handle) {
          await handle.close().catch(() => undefined)
        }
        await unlink(temporary).catch(() => undefined)
      }
  }

  /** Read one exact accepted Record by RecordId. */
  async get(recordId: string): Promise<JournalRecord> {
    const id = requireLookupId(recordId)
    const target = join(this.directory, recordFilename(id))
    return this.readStored(id, target, true)
  }

  /**
   * Replay every accepted Record in deterministic RecordId-filename order.
   * The order is a Runtime iteration detail and carries no chain semantics.
   */
  async *iterateAccepted(): AsyncIterableIterator<JournalRecord> {
    let entries
    try {
      entries = await readdir(this.directory, { withFileTypes: true })
    } catch (cause) {
      if (errorCode(cause) === 'ENOENT') return
      throw new RecordJournalStorageError(`Unable to enumerate Record journal directory: ${this.directory}`, { cause })
    }

    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(RECORD_FILE_SUFFIX))
      .map((entry) => entry.name)
      .sort(compareNames)

    for (const name of files) {
      const file = join(this.directory, name)
      const record = await this.readStoredFile(file)
      if (recordFilename(record.id) !== name) {
        throw new RecordJournalCorruptionError(file, 'Stored RecordId does not match its journal filename')
      }
      yield record
    }
  }

  private async syncPublication(recordId: string): Promise<void> {
    try {
      await syncDirectory(this.directory)
    } catch (cause) {
      throw new RecordJournalStorageError(`Unable to sync Record journal directory after accepting ${recordId}.`, { cause })
    }
  }

  private async readStored(recordId: string, target: string, missingIsNotFound: boolean): Promise<JournalRecord> {
    let serialized: string
    try {
      serialized = await readFile(target, 'utf8')
    } catch (cause) {
      if (missingIsNotFound && errorCode(cause) === 'ENOENT') {
        throw new RecordJournalNotFoundError(recordId)
      }
      throw new RecordJournalStorageError(`Unable to read Record ${recordId} from the journal.`, { cause })
    }

    const record = parseStoredRecord(serialized, target)
    if (record.id !== recordId) {
      throw new RecordJournalCorruptionError(target, `Stored RecordId ${record.id} does not match requested RecordId ${recordId}`)
    }
    return record
  }

  private async readStoredFile(file: string): Promise<JournalRecord> {
    let serialized: string
    try {
      serialized = await readFile(file, 'utf8')
    } catch (cause) {
      throw new RecordJournalStorageError(`Unable to read Record journal file: ${file}`, { cause })
    }
    return parseStoredRecord(serialized, file)
  }
}
