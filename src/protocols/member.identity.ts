import { createMemberProtocolPlugin } from '../member.ts'

/**
 * LabourChain Protocol runtime entry.
 *
 * The built cordis-js-esm artifact must expose exactly this named export.
 */
export const plugin = createMemberProtocolPlugin()
