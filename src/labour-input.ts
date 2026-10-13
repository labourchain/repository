import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import {
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  LABOUR_RECORD_PROTOCOL_SERVICE,
  validateLabourRecordData,
  type LabourRecordData,
  type LabourRecordView,
  type ValidatedLabourRecord,
} from './labour-record.ts'
import { MEMBER_PROTOCOL_SERVICE } from './member.ts'
import { RUNTIME_RECORD_DATABASE_SERVICE } from './runtime-record-database.ts'

export const LABOUR_INPUT_STORE_SERVICE = 'labourInputStore' as const
export const LABOUR_CAPTURE_SERVICE = 'labourCapture' as const
export const LABOUR_CAPTURE_PLUGIN_NAME = 'runtime.labour-capture' as const

/** Draft metadata is not a Core Record and never participates in its signature. */
export interface LabourInput {
  readonly id: string
  readonly originalText: string
  readonly source: string
  readonly sourceReference?: string
  readonly memberIdentity: string
  readonly createdAt: string
  readonly suggested?: Partial<LabourRecordData>
  readonly confirmedRecordId?: string
}

export interface NewLabourInput {
  readonly originalText: string
  readonly source: string
  readonly sourceReference?: string
  readonly memberIdentity: string
  readonly suggested?: Partial<LabourRecordData>
}

export interface LabourCaptureView {
  readonly status: 'draft' | 'confirmed'
  readonly input: LabourInput
  readonly confirmed?: LabourRecordView
}

/** Replaceable metadata port; MongoDB provider shares #31's Node and client. */
export interface LabourInputStore {
  create(input: LabourInput): Promise<void>
  get(id: string): Promise<LabourInput | null>
  list(): Promise<LabourInput[]>
  linkConfirmed(id: string, recordId: string): Promise<void>
}

export class LabourInputValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LabourInputValidationError'
  }
}

export class LabourInputStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LabourInputStorageError'
  }
}

export class LabourInputNotFoundError extends Error {
  constructor(id: string) {
    super('Labour input not found: ' + id)
    this.name = 'LabourInputNotFoundError'
  }
}

export class LabourInputConflictError extends Error {
  constructor(id: string) {
    super('Labour input already references another signed Record: ' + id)
    this.name = 'LabourInputConflictError'
  }
}

function nonBlank(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LabourInputValidationError(field + ' must be a non-empty string.')
  }
  return value
}

function normalizeSuggestion(value: unknown): Partial<LabourRecordData> | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new LabourInputValidationError('Suggested fields must be an object.')
  }
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) {
    throw new LabourInputValidationError('Suggested fields must be a plain object.')
  }
  const fields = value as Record<string, unknown>
  // Validate even incomplete suggestions with the existing labour.record schema.
  // Placeholders are never persisted or promoted to signed facts.
  const checked = validateLabourRecordData({
    content: 'Unconfirmed suggestion',
    duration: 0,
    ...fields,
  })
  const selected: Record<string, unknown> = {}
  for (const key of Object.keys(fields)) {
    selected[key] = checked[key as keyof LabourRecordData]
  }
  return selected as Partial<LabourRecordData>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    labourInputStore: LabourInputStore
    labourCapture: LabourCaptureService
  }
}

/** Explicit user confirmation consumes an already Member-signed Core L. */
export class LabourCaptureService {
  private readonly ctx: Context
  private confirmationGate: Promise<void> = Promise.resolve()

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  async create(input: NewLabourInput): Promise<LabourCaptureView> {
    const originalText = nonBlank(input?.originalText, 'originalText')
    const source = nonBlank(input?.source, 'source')
    const memberIdentity = nonBlank(input?.memberIdentity, 'memberIdentity')
    if (input.sourceReference !== undefined) {
      nonBlank(input.sourceReference, 'sourceReference')
    }
    const suggested = normalizeSuggestion(input.suggested)
    await this.ctx[MEMBER_PROTOCOL_SERVICE].requireMember(memberIdentity)
    const draft: LabourInput = {
      id: randomUUID(),
      originalText,
      source,
      memberIdentity,
      createdAt: new Date().toISOString(),
      ...(input.sourceReference !== undefined
        ? { sourceReference: input.sourceReference } : {}),
      ...(suggested !== undefined ? { suggested } : {}),
    }
    await this.ctx[LABOUR_INPUT_STORE_SERVICE].create(draft)
    return { input: draft, status: 'draft' }
  }

  async get(id: string): Promise<LabourCaptureView> {
    const input = await this.ctx[LABOUR_INPUT_STORE_SERVICE].get(id)
    if (!input) throw new LabourInputNotFoundError(id)
    if (input.confirmedRecordId === undefined) {
      return { input, status: 'draft' }
    }
    // Signed L is revalidated on read; missing/wrong-Hash facts fail closed.
    const confirmed = await this.ctx[LABOUR_RECORD_PROTOCOL_SERVICE]
      .loadLabourRecord(input.confirmedRecordId)
    if (confirmed.createdBy !== input.memberIdentity) {
      throw new LabourInputConflictError(id)
    }
    return { input, confirmed, status: 'confirmed' }
  }

  async list(): Promise<LabourCaptureView[]> {
    const inputs = await this.ctx[LABOUR_INPUT_STORE_SERVICE].list()
    return Promise.all(inputs.map((input) => this.get(input.id)))
  }

  async confirm(id: string, signedRecord: unknown): Promise<LabourCaptureView> {
    // One owning Node; no implicit signing, staging or recovery mechanism.
    const previous = this.confirmationGate
    let release!: () => void
    this.confirmationGate = new Promise<void>((resolve) => { release = resolve })
    await previous
    try {
      const input = await this.ctx[LABOUR_INPUT_STORE_SERVICE].get(id)
      if (!input) throw new LabourInputNotFoundError(id)
      const signed: ValidatedLabourRecord = await this.ctx[
        LABOUR_RECORD_PROTOCOL_SERVICE
      ].validateLabourRecord(signedRecord)
      if (signed.createdBy !== input.memberIdentity) {
        throw new LabourInputValidationError(
          'Signed Labour Record author must match the captured Member.',
        )
      }
      if (input.confirmedRecordId !== undefined &&
          input.confirmedRecordId !== signed.id) {
        throw new LabourInputConflictError(id)
      }
      // The already-signed immutable L is authoritative and may exist alone.
      await this.ctx[LABOUR_RECORD_PROTOCOL_SERVICE].acceptLabourRecord(signedRecord)
      await this.ctx[LABOUR_INPUT_STORE_SERVICE].linkConfirmed(id, signed.id)
      return this.get(id)
    } finally {
      release()
    }
  }

  loadSigned(recordId: string): Promise<LabourRecordView> {
    return this.ctx[LABOUR_RECORD_PROTOCOL_SERVICE].loadLabourRecord(recordId)
  }

  async listSigned(): Promise<LabourRecordView[]> {
    const result: LabourRecordView[] = []
    for await (const record of this.ctx[RUNTIME_RECORD_DATABASE_SERVICE]
      .iterateAccepted()) {
      if ('protocol' in record &&
          record.protocol === LABOUR_RECORD_PROTOCOL_REFERENCE) {
        result.push(await this.loadSigned(record.id))
      }
    }
    return result
  }
}

export const labourCapturePlugin = {
  name: LABOUR_CAPTURE_PLUGIN_NAME,
  provide: LABOUR_CAPTURE_SERVICE,
  inject: [LABOUR_INPUT_STORE_SERVICE, MEMBER_PROTOCOL_SERVICE,
    LABOUR_RECORD_PROTOCOL_SERVICE, RUNTIME_RECORD_DATABASE_SERVICE],
  apply(ctx: Context): void {
    ctx.provide(LABOUR_CAPTURE_SERVICE, new LabourCaptureService(ctx))
  },
}
