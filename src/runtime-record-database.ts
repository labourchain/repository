import {
  RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE,
} from './internal-publication.ts'

export const RUNTIME_RECORD_DATABASE_SERVICE = 'runtimeRecordDatabase' as const
export interface RuntimeRecord {
  readonly id: string
}

/** Shared absence contract for every Runtime Record DB provider. */
export class RuntimeRecordDatabaseNotFoundError extends Error {
  readonly recordId: string

  constructor(recordId: string, options?: ErrorOptions) {
    super('Persisted Record not found: ' + recordId, options)
    this.name = 'RuntimeRecordDatabaseNotFoundError'
    this.recordId = recordId
  }
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


declare module '@deepseek-ai/cordis' {
  interface Context {
    runtimeRecordDatabase: RuntimeRecordDatabase
  }
}
