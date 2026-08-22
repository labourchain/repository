import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    labourchainRepository: RepositoryService
  }
}

/**
 * LabourChain Repository service boundary.
 *
 * Business methods are intentionally absent until their corresponding
 * REP-* requirements are accepted and implemented through spec-driven PRs.
 */
export class RepositoryService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'labourchainRepository')
  }
}

export default RepositoryService
