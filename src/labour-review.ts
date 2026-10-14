import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import {
  LABOUR_RECORD_PROTOCOL_REFERENCE,
  LABOUR_RECORD_PROTOCOL_SERVICE,
} from './labour-record.ts'
import { MEMBER_PROTOCOL_SERVICE } from './member.ts'
import { RUNTIME_RECORD_DATABASE_SERVICE } from './runtime-record-database.ts'
import {
  LABOUR_PATCH_STORE_SERVICE,
  LabourPatchConflictError,
  validateLabourPatch,
  type LabourPatchInput,
} from './labour-patch.ts'
import { projectLabourHistory, type LabourCurrentView } from './labour-projection.ts'

export const LABOUR_REVIEW_SERVICE = 'labourReview' as const

declare module '@deepseek-ai/cordis' {
  interface Context {
    labourPatchStore: import('./labour-patch.ts').LabourPatchStore
    labourReview: LabourReviewService
  }
}

/**
 * Patch/Projection is Node-local review metadata, not a new Core Protocol.
 * No method can modify the signed L stored in Runtime Record DB.
 */
export class LabourReviewService {
  private readonly ctx: Context

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  async getCurrent(recordId: string): Promise<LabourCurrentView> {
    const signed = await this.ctx[LABOUR_RECORD_PROTOCOL_SERVICE]
      .loadLabourRecord(recordId)
    const patches = await this.ctx[LABOUR_PATCH_STORE_SERVICE].list(recordId)
    return projectLabourHistory(signed, patches)
  }

  async append(recordId: string, input: LabourPatchInput): Promise<LabourCurrentView> {
    const patch = validateLabourPatch({
      ...input,
      id: randomUUID(),
      targetId: recordId,
      createdAt: new Date().toISOString(),
    })
    const current = await this.getCurrent(recordId)
    if (patch.parentId !== current.lastPatchId) {
      throw new LabourPatchConflictError('Labour Patch parent is not the current head.')
    }
    await this.ctx[MEMBER_PROTOCOL_SERVICE].requireMember(patch.memberIdentity)
    // Mongo enforces one successor per (targetId, parentId) atomically.
    await this.ctx[LABOUR_PATCH_STORE_SERVICE].append(patch)
    return this.getCurrent(recordId)
  }

  async listCurrent(): Promise<LabourCurrentView[]> {
    const views: LabourCurrentView[] = []
    for await (const record of this.ctx[RUNTIME_RECORD_DATABASE_SERVICE]
      .iterateAccepted()) {
      if ('protocol' in record &&
          record.protocol === LABOUR_RECORD_PROTOCOL_REFERENCE) {
        views.push(await this.getCurrent(record.id))
      }
    }
    return views
  }
}

export const labourReviewPlugin = {
  name: 'runtime.labour-review',
  provide: LABOUR_REVIEW_SERVICE,
  inject: [
    LABOUR_PATCH_STORE_SERVICE,
    LABOUR_RECORD_PROTOCOL_SERVICE,
    MEMBER_PROTOCOL_SERVICE,
    RUNTIME_RECORD_DATABASE_SERVICE,
  ],
  apply(ctx: Context): void {
    ctx.provide(LABOUR_REVIEW_SERVICE, new LabourReviewService(ctx))
  },
}
