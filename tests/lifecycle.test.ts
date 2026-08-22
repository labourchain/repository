import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import RepositoryService from '../src/index.ts'

describe('RepositoryService lifecycle', () => {
  it('REP-CORDIS-001: mounts the prefixed repository service', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(RepositoryService)

    expect(ctx.labourchainRepository).toBeInstanceOf(RepositoryService)

    await fiber.dispose()
    expect(ctx.get('labourchainRepository')).toBeUndefined()

    await ctx.fiber.dispose()
  })
})
