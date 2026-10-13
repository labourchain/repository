import type { Context } from '@deepseek-ai/cordis'
import {
  RECORD_JOURNAL_INTERNAL_RUN_EXCLUSIVE,
  RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE,
} from './internal-publication.ts'
import {
  RecordJournalNotFoundError,
  type RecordJournalExclusiveSession,
} from './record-journal.ts'
import {
  RUNTIME_RECORD_DATABASE_SERVICE,
  RuntimeRecordDatabaseNotFoundError,
  type RuntimeRecord,
  type RuntimeRecordDatabase,
  type RuntimeRecordDatabaseSession,
} from './runtime-record-database.ts'

export const JOURNAL_RECORD_DATABASE_PLUGIN_NAME =
  'runtime.record-database-journal' as const

/**
 * Legacy filesystem-journal adapter for the Runtime Record DB interface.
 *
 * Existing tests use this provider explicitly; production uses MongoDB.
 * Both providers expose the same domain session and publication guard.
 */
export class RuntimeRecordDatabaseService implements RuntimeRecordDatabase {
  private readonly ctx: Context
  constructor(ctx: Context) {
    this.ctx = ctx
  }

  async runExclusive<T>(
    operation: (database: RuntimeRecordDatabaseSession) => Promise<T>,
  ): Promise<T> {
    return this.ctx.recordJournal.runExclusive((journal) =>
      operation(this.createSession(journal)),
    )
  }

  async [RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE]<T>(
    operation: (database: RuntimeRecordDatabaseSession) => Promise<T>,
  ): Promise<T> {
    return this.ctx.recordJournal[RECORD_JOURNAL_INTERNAL_RUN_EXCLUSIVE](
      (journal) => operation(this.createSession(journal)),
    )
  }

  async get(recordId: string): Promise<RuntimeRecord> {
    try {
      return await this.ctx.recordJournal.get(recordId)
    } catch (cause) {
      if (cause instanceof RecordJournalNotFoundError) {
        throw new RuntimeRecordDatabaseNotFoundError(recordId, { cause })
      }
      throw cause
    }
  }

  iterateAccepted(): AsyncIterableIterator<RuntimeRecord> {
    return this.ctx.recordJournal.iterateAccepted()
  }

  private createSession(
    journal: RecordJournalExclusiveSession,
  ): RuntimeRecordDatabaseSession {
    return {
      accept: (record) => journal.accept(record),
      get: (recordId) => this.get(recordId),
      iterateAccepted: () => journal.iterateAccepted(),
    }
  }
}

/** Explicit journal adapter for existing filesystem test fixtures. */
export const journalRecordDatabasePlugin = {
  name: JOURNAL_RECORD_DATABASE_PLUGIN_NAME,
  provide: RUNTIME_RECORD_DATABASE_SERVICE,
  inject: ['recordJournal'],
  apply(ctx: Context): void {
    ctx.provide(
      RUNTIME_RECORD_DATABASE_SERVICE,
      new RuntimeRecordDatabaseService(ctx),
    )
  },
}
