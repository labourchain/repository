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
  replaceState(namespace: string, state: unknown): void
}

/**
 * Minimal Repository Runtime Record database boundary.
 *
 * Protocol implementations own the meaning of their relationship state. This
 * service only gives those implementations one serialized Repository ingress
 * boundary, exact Record durability through recordJournal, and namespaced
 * runtime relationship state. The state is intentionally rebuildable from
 * durable Records; it is not chain confirmation or a second blockchain.
 */
export class RuntimeRecordDatabaseService {
  private readonly ctx: Context
  private readonly states = new Map<string, unknown>()

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  async runExclusive<T>(
    operation: (database: RuntimeRecordDatabaseSession) => Promise<T>,
  ): Promise<T> {
    return this.ctx.recordJournal.runExclusive(async (journal) => {
      // Only whole namespace values can be replaced inside an operation.
      // Committed state references are intentionally not exposed to callbacks,
      // so a failed operation cannot mutate previously committed state in place.
      const stagedStates = new Map(this.states)
      const database = this.createSession(journal, stagedStates)
      const result = await operation(database)

      this.states.clear()
      for (const [namespace, state] of stagedStates) {
        this.states.set(namespace, state)
      }

      return result
    })
  }

  private createSession(
    journal: RecordJournalExclusiveSession,
    states: Map<string, unknown>,
  ): RuntimeRecordDatabaseSession {
    return {
      accept: (record) => journal.accept(record),
      get: (recordId) => journal.get(recordId),
      iterateAccepted: () => journal.iterateAccepted(),
      replaceState(namespace, state) {
        states.set(namespace, state)
      },
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
