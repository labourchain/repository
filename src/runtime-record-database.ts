import type { Context } from '@deepseek-ai/cordis'
import {
  RECORD_JOURNAL_INTERNAL_RUN_EXCLUSIVE,
  RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE,
} from './internal-publication.ts'
import type { RecordJournalExclusiveSession } from './record-journal.ts'

export const RUNTIME_RECORD_DATABASE_SERVICE = 'runtimeRecordDatabase' as const
export const JOURNAL_RECORD_DATABASE_PLUGIN_NAME =
  'runtime.record-database-journal' as const

export interface RuntimeRecord {
  readonly id: string
}

export interface RuntimeRecordDatabase {
  runExclusive<T>(
    operation: (database: RuntimeRecordDatabaseSession) => Promise<T>,
  ): Promise<T>
  [RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE]<T>(
    operation: (database: RuntimeRecordDatabaseSession) => Promise<T>,
  ): Promise<T>
  get(recordId: string): Promise<RuntimeRecord>
  iterateAccepted(): AsyncIterableIterator<RuntimeRecord>
}

export interface RuntimeRecordDatabaseSession {
  accept(record: RuntimeRecord): Promise<void>
  get(recordId: string): Promise<RuntimeRecord>
  iterateAccepted(): AsyncIterableIterator<RuntimeRecord>
}

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

  get(recordId: string): Promise<RuntimeRecord> {
    return this.ctx.recordJournal.get(recordId)
  }

  iterateAccepted(): AsyncIterableIterator<RuntimeRecord> {
    return this.ctx.recordJournal.iterateAccepted()
  }

  private createSession(
    journal: RecordJournalExclusiveSession,
  ): RuntimeRecordDatabaseSession {
    return {
      accept: (record) => journal.accept(record),
      get: (recordId) => journal.get(recordId),
      iterateAccepted: () => journal.iterateAccepted(),
    }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    runtimeRecordDatabase: RuntimeRecordDatabase
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
