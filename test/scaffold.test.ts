import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import { apply, name } from '../src/index.ts'

test('uses an explicit LabourChain plugin name', () => {
  assert.equal(name, 'labourchain-repository')
})

test('bootstrap activation is side-effect free', () => {
  assert.doesNotThrow(() => apply({} as Context))
})
