import type { Context } from '@deepseek-ai/cordis'
import type {
  JournalRecord,
  RecordJournalExclusiveSession,
} from './record-journal.ts'

export const RUNTIME_RECORD_DATABASE_SERVICE = 'runtimeRecordDatabase' as const
export const RUNTIME_RECORD_DATABASE_PLUGIN_NAME =
  'runtime.record-database' as const

export interface RuntimeRecordDatabaseSession {
  accept(record: JournalRecord): Promise<void>
  get(recordId: string): Promise<JournalRecord>
  iterateAccepted(): AsyncIterableIterator<JournalRecord>
}

/**
 * Minimal Repository Runtime Record database boundary.
 *
 * Protocol implementations own the meaning of their relationship state. This
 * service only gives those implementations one serialized Repository ingress
 * boundary and exact Record durability through recordJournal. Concrete
 * relationship state belongs to the first Protocol consumer that needs it;
 * this service does not invent a generic state model in advance.
 */
export class RuntimeRecordDatabaseService {
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
    runtimeRecordDatabase: RuntimeRecordDatabaseService
  }
}

export const runtimeRecordDatabasePlugin = {
  name: RUNTIME_RECORD_DATABASE_PLUGIN_NAME,
  provide: RUNTIME_RECORD_DATABASE_SERVICE,
  inject: ['recordJournal'],
  apply(ctx: Context): void {
    ctx.provide(
      RUNTIME_RECORD_DATABASE_SERVICE,
      new RuntimeRecordDatabaseService(ctx),
    )
  },
}
