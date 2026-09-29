import type { Context } from '@deepseek-ai/cordis'
import {
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_SERVICE,
  type CoreRecordValue,
} from './member.ts'

export const LABOUR_RECORD_PROTOCOL_NAME = 'labour.record' as const
export const LABOUR_RECORD_PROTOCOL_VERSION = '0.1.0' as const
export const LABOUR_RECORD_PROTOCOL_REFERENCE =
  `${LABOUR_RECORD_PROTOCOL_NAME}@${LABOUR_RECORD_PROTOCOL_VERSION}` as const
export const LABOUR_RECORD_PROTOCOL_SERVICE =
  `protocol:${LABOUR_RECORD_PROTOCOL_REFERENCE}` as const

const DIGEST_RE = /^[0-9a-f]{64}$/u
const ALLOWED_DATA_KEYS = new Set([
  'content',
  'duration',
  'startAt',
  'endAt',
  'references',
  'assets',
])

export type AssetRef = string

export interface LabourRecordData {
  readonly content: string
  readonly duration: number
  readonly startAt?: string
  readonly endAt?: string
  readonly references?: readonly AssetRef[]
  readonly assets?: readonly AssetRef[]
}

export interface ValidatedLabourRecord extends CoreRecordValue {
  readonly data: LabourRecordData
}

export interface LabourRecordMountConfig {
  readonly protocolHash: string
}

export interface LabourRecordView {
  readonly recordId: string
  readonly createdBy: string
  readonly data: LabourRecordData
}

export class LabourRecordError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LabourRecordError'
  }
}

export class LabourRecordProtocolConfigError extends LabourRecordError {
  constructor(message: string) {
    super(message)
    this.name = 'LabourRecordProtocolConfigError'
  }
}

export class LabourRecordValidationError extends LabourRecordError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LabourRecordValidationError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    'protocol:labour.record@0.1.0': LabourRecordService
  }
}

function requireProtocolHash(config: LabourRecordMountConfig): string {
  if (
    !config ||
    typeof config.protocolHash !== 'string' ||
    !DIGEST_RE.test(config.protocolHash)
  ) {
    throw new LabourRecordProtocolConfigError(
      'labour.record requires the exact resolved ProtocolHash from the Host.',
    )
  }
  return config.protocolHash
}

function requirePlainObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new LabourRecordValidationError(
      'labour.record data must be a plain object.',
    )
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new LabourRecordValidationError(
      'labour.record data must be a plain object.',
    )
  }
  return value as Record<string, unknown>
}

function requireAssetRefs(
  value: unknown,
  field: 'references' | 'assets',
): readonly string[] {
  if (!Array.isArray(value)) {
    throw new LabourRecordValidationError(
      `labour.record ${field} must be an array when present.`,
    )
  }

  const seen = new Set<string>()
  const refs: string[] = []
  for (const item of value) {
    if (
      typeof item !== 'string' ||
      item.length === 0 ||
      item.trim() !== item
    ) {
      throw new LabourRecordValidationError(
        `labour.record ${field} must contain non-empty opaque string references.`,
      )
    }
    if (seen.has(item)) {
      throw new LabourRecordValidationError(
        `labour.record ${field} must not contain duplicate references.`,
      )
    }
    seen.add(item)
    refs.push(item)
  }

  return Object.freeze(refs)
}

function requireDateTime(value: unknown, field: 'startAt' | 'endAt'): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new LabourRecordValidationError(
      `labour.record ${field} must be a non-empty date-time string.`,
    )
  }
  if (!Number.isFinite(Date.parse(value))) {
    throw new LabourRecordValidationError(
      `labour.record ${field} must be a parseable date-time string.`,
    )
  }
  return value
}

export function validateLabourRecordData(value: unknown): LabourRecordData {
  const data = requirePlainObject(value)

  for (const key of Reflect.ownKeys(data)) {
    if (typeof key !== 'string' || !ALLOWED_DATA_KEYS.has(key)) {
      throw new LabourRecordValidationError(
        `labour.record data contains unsupported field: ${String(key)}`,
      )
    }
  }

  if (typeof data.content !== 'string' || data.content.trim().length === 0) {
    throw new LabourRecordValidationError(
      'labour.record content must be a non-empty string.',
    )
  }

  if (
    typeof data.duration !== 'number' ||
    !Number.isFinite(data.duration) ||
    data.duration < 0 ||
    !Number.isInteger(data.duration * 2)
  ) {
    throw new LabourRecordValidationError(
      'labour.record duration must be a finite non-negative number in 0.5 hour increments.',
    )
  }

  const hasStartAt = Object.prototype.hasOwnProperty.call(data, 'startAt')
  const hasEndAt = Object.prototype.hasOwnProperty.call(data, 'endAt')
  if (hasStartAt !== hasEndAt) {
    throw new LabourRecordValidationError(
      'labour.record startAt and endAt must either both be present or both be absent.',
    )
  }

  let startAt: string | undefined
  let endAt: string | undefined
  if (hasStartAt && hasEndAt) {
    startAt = requireDateTime(data.startAt, 'startAt')
    endAt = requireDateTime(data.endAt, 'endAt')
    if (Date.parse(startAt) > Date.parse(endAt)) {
      throw new LabourRecordValidationError(
        'labour.record startAt must not be later than endAt.',
      )
    }
  }

  const references = Object.prototype.hasOwnProperty.call(data, 'references')
    ? requireAssetRefs(data.references, 'references')
    : undefined
  const assets = Object.prototype.hasOwnProperty.call(data, 'assets')
    ? requireAssetRefs(data.assets, 'assets')
    : undefined

  const result: {
    content: string
    duration: number
    startAt?: string
    endAt?: string
    references?: readonly string[]
    assets?: readonly string[]
  } = {
    content: data.content,
    duration: data.duration,
  }

  if (startAt !== undefined && endAt !== undefined) {
    result.startAt = startAt
    result.endAt = endAt
  }
  if (references !== undefined) result.references = references
  if (assets !== undefined) result.assets = assets

  return Object.freeze(result)
}

function labourRecordView(record: ValidatedLabourRecord): LabourRecordView {
  return Object.freeze({
    recordId: record.id,
    createdBy: record.createdBy,
    data: record.data,
  })
}

export class LabourRecordService {
  private readonly ctx: Context
  readonly protocolHash: string

  constructor(ctx: Context, protocolHash: string) {
    this.ctx = ctx
    this.protocolHash = protocolHash
  }

  async validateLabourRecord(value: unknown): Promise<ValidatedLabourRecord> {
    let record: CoreRecordValue
    try {
      record = this.ctx[CORE_RECORD_PROTOCOL_SERVICE].validateRecord(value)
    } catch (cause) {
      throw new LabourRecordValidationError(
        'Invalid Core Record for labour.record.',
        { cause },
      )
    }

    if (record.protocol !== LABOUR_RECORD_PROTOCOL_REFERENCE) {
      throw new LabourRecordValidationError(
        `Labour Record must reference ${LABOUR_RECORD_PROTOCOL_REFERENCE}.`,
      )
    }
    if (record.protocolHash !== this.protocolHash) {
      throw new LabourRecordValidationError(
        'Labour Record references a different ProtocolHash.',
      )
    }

    let signatureValid: boolean
    try {
      signatureValid =
        this.ctx[CORE_RECORD_PROTOCOL_SERVICE].verifySignature(record)
    } catch (cause) {
      throw new LabourRecordValidationError(
        'Unable to verify Labour Record signature.',
        { cause },
      )
    }
    if (!signatureValid) {
      throw new LabourRecordValidationError(
        'Labour Record signature is invalid.',
      )
    }

    try {
      await this.ctx[MEMBER_PROTOCOL_SERVICE].requireMember(record.createdBy)
    } catch (cause) {
      throw new LabourRecordValidationError(
        'Labour Record author does not satisfy the Member capability.',
        { cause },
      )
    }

    const data = validateLabourRecordData(record.data)
    return Object.freeze({ ...record, data })
  }

  async acceptLabourRecord(value: unknown): Promise<LabourRecordView> {
    return this.ctx.recordJournal.runExclusive(async (journal) => {
      const record = await this.validateLabourRecord(value)
      await journal.accept(record)
      return labourRecordView(record)
    })
  }

  async loadLabourRecord(recordId: string): Promise<LabourRecordView> {
    const stored = await this.ctx.recordJournal.get(recordId)
    const record = await this.validateLabourRecord(stored)
    return labourRecordView(record)
  }
}

export const LABOUR_RECORD_PROTOCOL_INJECT = Object.freeze([
  CORE_RECORD_PROTOCOL_SERVICE,
  MEMBER_PROTOCOL_SERVICE,
  'recordJournal',
] as const)

export function createLabourRecordProtocolPlugin() {
  return {
    name: LABOUR_RECORD_PROTOCOL_REFERENCE,
    provide: LABOUR_RECORD_PROTOCOL_SERVICE,
    inject: [...LABOUR_RECORD_PROTOCOL_INJECT],
    apply(ctx: Context, config: LabourRecordMountConfig): void {
      const protocolHash = requireProtocolHash(config)
      ctx.provide(
        LABOUR_RECORD_PROTOCOL_SERVICE,
        new LabourRecordService(ctx, protocolHash),
      )
    },
  }
}
