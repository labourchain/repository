import type { LabourRecordView } from './labour-record.ts'
import {
  LabourPatchIntegrityError,
  validateLabourPatch,
  type LabourPatch,
} from './labour-patch.ts'

export interface LabourAnnotation {
  readonly patchId: string
  readonly memberIdentity: string
  readonly createdAt: string
  readonly note: string
}

/** Derived solely from a verified signed L and append-only local Patches. */
export interface LabourCurrentView {
  readonly record: LabourRecordView
  readonly version: number
  readonly lastPatchId: string | null
  readonly labels: readonly string[]
  readonly annotations: readonly LabourAnnotation[]
  readonly history: readonly LabourPatch[]
}

export function projectLabourHistory(
  record: LabourRecordView,
  facts: readonly LabourPatch[],
): LabourCurrentView {
  const byParent = new Map<string | null, LabourPatch>()
  const ids = new Set<string>()
  for (const raw of facts) {
    let patch: LabourPatch
    try {
      patch = validateLabourPatch(raw)
    } catch (cause) {
      throw new LabourPatchIntegrityError('Persisted Labour Patch is invalid.', { cause })
    }
    if (patch.targetId !== record.recordId || ids.has(patch.id) ||
        byParent.has(patch.parentId)) {
      throw new LabourPatchIntegrityError('Labour Patch history has a duplicate or cross-target fact.')
    }
    ids.add(patch.id)
    byParent.set(patch.parentId, patch)
  }

  const history: LabourPatch[] = []
  const seen = new Set<string>()
  let parent: string | null = null
  while (byParent.has(parent)) {
    const patch = byParent.get(parent)!
    if (seen.has(patch.id)) {
      throw new LabourPatchIntegrityError('Labour Patch history has a cycle.')
    }
    seen.add(patch.id)
    history.push(patch)
    parent = patch.id
  }
  if (history.length !== facts.length) {
    throw new LabourPatchIntegrityError('Labour Patch history contains missing parents or disconnected facts.')
  }

  const labels = new Set<string>()
  const annotations: LabourAnnotation[] = []
  for (const patch of history) {
    for (const label of patch.labelsAdd ?? []) labels.add(label)
    for (const label of patch.labelsRemove ?? []) labels.delete(label)
    if (patch.note !== undefined) {
      annotations.push(Object.freeze({
        patchId: patch.id,
        memberIdentity: patch.memberIdentity,
        createdAt: patch.createdAt,
        note: patch.note,
      }))
    }
  }
  return Object.freeze({
    record,
    version: history.length,
    lastPatchId: parent,
    labels: Object.freeze([...labels].sort()),
    annotations: Object.freeze(annotations),
    history: Object.freeze(history),
  })
}
