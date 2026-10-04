import type { JournalRecord } from './record-journal.ts'

export const RECORD_JOURNAL_INTERNAL_RUN_EXCLUSIVE = Symbol(
  'recordJournal.internalRunExclusive',
)
export const RUNTIME_RECORD_DATABASE_INTERNAL_RUN_EXCLUSIVE = Symbol(
  'runtimeRecordDatabase.internalRunExclusive',
)

export const PROTECTED_REPOSITORY_PROTOCOL_REFERENCE =
  'repo.contribution@0.1.0' as const

export function isProtectedRepositoryPublication(
  record: JournalRecord,
): boolean {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return false
  }
  return (
    (record as { readonly protocol?: unknown }).protocol ===
    PROTECTED_REPOSITORY_PROTOCOL_REFERENCE
  )
}
