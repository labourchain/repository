import { Service, type Context } from '@deepseek-ai/cordis'

export const CORE_VALIDATION_SERVICE = 'coreValidation' as const

/**
 * Structural view of the current Core Record surface consumed by Repository.
 *
 * Validation, RecordId derivation and signature semantics remain owned by Core.
 * A real adapter can return `@labourchain/core-plugins` Record values directly.
 */
export interface CoreRecord {
  readonly id: string
  readonly plugin: string
  readonly pluginHash: string
  readonly createdBy: string
  readonly createdAt: string
  readonly signature: string
  readonly data: unknown
}

export interface CoreValidationConfig {
  readonly validateRecord: (value: unknown) => CoreRecord
  readonly verifyRecordSignature: (record: CoreRecord) => boolean | Promise<boolean>
  readonly validateEntityPublicKey: (value: unknown) => string
}

export class CoreValidationConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoreValidationConfigError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    coreValidation: CoreValidationService
  }
}

/**
 * Narrow Runtime bridge from Repository to Core validation primitives.
 *
 * This service intentionally contains no validation algorithm. Until Core's
 * package/distribution boundary is finalized, node composition supplies the
 * actual Core functions. Replacing that adapter later does not change Repo
 * domain logic.
 */
export class CoreValidationService extends Service {
  private readonly config: CoreValidationConfig

  constructor(ctx: Context, config: CoreValidationConfig) {
    super(ctx, CORE_VALIDATION_SERVICE)

    if (!config || typeof config.validateRecord !== 'function') {
      throw new CoreValidationConfigError('coreValidation requires validateRecord().')
    }
    if (typeof config.verifyRecordSignature !== 'function') {
      throw new CoreValidationConfigError('coreValidation requires verifyRecordSignature().')
    }
    if (typeof config.validateEntityPublicKey !== 'function') {
      throw new CoreValidationConfigError('coreValidation requires validateEntityPublicKey().')
    }

    this.config = config
  }

  validateRecord(value: unknown): CoreRecord {
    return this.config.validateRecord(value)
  }

  verifyRecordSignature(record: CoreRecord): boolean | Promise<boolean> {
    return this.config.verifyRecordSignature(record)
  }

  validateEntityPublicKey(value: unknown): string {
    return this.config.validateEntityPublicKey(value)
  }
}
