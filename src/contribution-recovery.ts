import type { Context } from '@deepseek-ai/cordis'
import {
  CONTRIBUTION_STAGING_SERVICE,
} from './contribution-staging.ts'
import {
  REPOSITORY_CONTRIBUTION_SERVICE,
  type ContributionRequest,
  type RepositoryContributionCommit,
} from './contribution.ts'

export const REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE =
  'repositoryContributionRecovery' as const
export const REPOSITORY_CONTRIBUTION_RECOVERY_PLUGIN_NAME =
  'runtime.repository-contribution-recovery' as const

declare module '@deepseek-ai/cordis' {
  interface Context {
    repositoryContributionRecovery: RepositoryContributionRecoveryService
  }
}

/**
 * Repo-local orchestration around the one Repository contribution commit path.
 *
 * Staging records only the exact caller-supplied work required for restart.
 * Domain mutation always delegates to RepositoryContributionService.commit().
 */
export class RepositoryContributionRecoveryService {
  private readonly ctx: Context

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  async submit(
    request: ContributionRequest,
  ): Promise<RepositoryContributionCommit> {
    const contribution = this.ctx[REPOSITORY_CONTRIBUTION_SERVICE]
    const replay = await contribution.validateForStaging(request)

    if (replay !== undefined) {
      await this.cleanup(replay.recordId)
      return replay
    }

    await this.ctx[CONTRIBUTION_STAGING_SERVICE].stage(request)
    const result = await contribution.commit(request)
    await this.cleanup(result.recordId)
    return result
  }

  async recoverPending(): Promise<readonly RepositoryContributionCommit[]> {
    const results: RepositoryContributionCommit[] = []

    for await (
      const request of this.ctx[
        CONTRIBUTION_STAGING_SERVICE
      ].iterateStaged()
    ) {
      const result = await this.ctx[
        REPOSITORY_CONTRIBUTION_SERVICE
      ].commit(request)
      await this.cleanup(result.recordId)
      results.push(result)
    }

    return results
  }

  private async cleanup(acceptanceRecordId: string): Promise<void> {
    try {
      await this.ctx[CONTRIBUTION_STAGING_SERVICE].remove(
        acceptanceRecordId,
      )
    } catch {
      // D is already durable when cleanup runs. A stale local stage is safe to
      // retry and must never turn Repository COMMITTED into an apparent abort.
    }
  }
}

export const REPOSITORY_CONTRIBUTION_RECOVERY_INJECT = Object.freeze([
  REPOSITORY_CONTRIBUTION_SERVICE,
  CONTRIBUTION_STAGING_SERVICE,
] as const)

export const repositoryContributionRecoveryPlugin = {
  name: REPOSITORY_CONTRIBUTION_RECOVERY_PLUGIN_NAME,
  provide: REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE,
  inject: [...REPOSITORY_CONTRIBUTION_RECOVERY_INJECT],
  apply(ctx: Context): void {
    ctx.provide(
      REPOSITORY_CONTRIBUTION_RECOVERY_SERVICE,
      new RepositoryContributionRecoveryService(ctx),
    )
  },
}
