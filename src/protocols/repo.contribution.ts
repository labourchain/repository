import { createRepoContributionProtocolPlugin } from '../repo-contribution.ts'

/**
 * LabourChain Protocol runtime entry.
 *
 * The built cordis-js-esm artifact must expose exactly this named export.
 */
export const plugin = createRepoContributionProtocolPlugin()
