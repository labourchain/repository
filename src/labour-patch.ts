export const LABOUR_PATCH_STORE_SERVICE = 'labourPatchStore' as const

/** Local annotation, not a Core Record and not a signed Protocol. */
export interface LabourPatch {
  readonly id: string
  readonly targetId: string
  readonly parentId: string | null
  readonly memberIdentity: string
  readonly createdAt: string
  readonly note?: string
  readonly labelsAdd?: readonly string[]
  readonly labelsRemove?: readonly string[]
}

export type LabourPatchInput = Pick<
  LabourPatch, 'parentId' | 'memberIdentity' | 'note' | 'labelsAdd' | 'labelsRemove'
>

export interface LabourPatchStore {
  append(patch: LabourPatch): Promise<void>
  list(targetId: string): Promise<LabourPatch[]>
}

export class LabourPatchValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LabourPatchValidationError'
  }
}

export class LabourPatchConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LabourPatchConflictError'
  }
}

export class LabourPatchIntegrityError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LabourPatchIntegrityError'
  }
}

export class LabourPatchStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LabourPatchStorageError'
  }
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new LabourPatchValidationError('Labour Patch must be a plain object.')
  }
  return value as Record<string, unknown>
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 ||
      value !== value.trim()) {
    throw new LabourPatchValidationError(field + ' must be a non-blank string.')
  }
  return value
}

function labels(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new LabourPatchValidationError(field + ' must be an array.')
  }
  const result: string[] = []
  for (const raw of value) {
    const label = string(raw, field + ' item')
    if (label.length > 64 || result.includes(label)) {
      throw new LabourPatchValidationError(field + ' has an invalid or duplicate label.')
    }
    result.push(label)
  }
  return Object.freeze(result)
}

/** Strictly validate persisted data as well as incoming local Patch proposals. */
export function validateLabourPatch(value: unknown): LabourPatch {
  const data = object(value)
  const allowed = new Set([
    'id', 'targetId', 'parentId', 'memberIdentity', 'createdAt',
    'note', 'labelsAdd', 'labelsRemove',
  ])
  for (const key of Reflect.ownKeys(data)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      throw new LabourPatchValidationError('Unsupported Labour Patch field: ' + String(key))
    }
  }
  const id = string(data.id, 'id')
  const targetId = string(data.targetId, 'targetId')
  const memberIdentity = string(data.memberIdentity, 'memberIdentity')
  if (data.parentId !== null && typeof data.parentId !== 'string') {
    throw new LabourPatchValidationError('parentId must be null or a Patch ID.')
  }
  const parentId = data.parentId === null
    ? null : string(data.parentId, 'parentId')
  const createdAt = string(data.createdAt, 'createdAt')
  const timestamp = Date.parse(createdAt)
  if (!Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString() !== createdAt) {
    throw new LabourPatchValidationError('createdAt must be RFC 3339 UTC milliseconds.')
  }
  const note = data.note === undefined ? undefined : string(data.note, 'note')
  const labelsAdd = data.labelsAdd === undefined
    ? undefined : labels(data.labelsAdd, 'labelsAdd')
  const labelsRemove = data.labelsRemove === undefined
    ? undefined : labels(data.labelsRemove, 'labelsRemove')
  if (!note && !labelsAdd?.length && !labelsRemove?.length) {
    throw new LabourPatchValidationError('Labour Patch needs a note or label change.')
  }
  if (labelsAdd?.some((item) => labelsRemove?.includes(item))) {
    throw new LabourPatchValidationError('Cannot add and remove the same label.')
  }
  return Object.freeze({
    id, targetId, parentId, memberIdentity, createdAt,
    ...(note !== undefined ? { note } : {}),
    ...(labelsAdd !== undefined ? { labelsAdd } : {}),
    ...(labelsRemove !== undefined ? { labelsRemove } : {}),
  })
}
