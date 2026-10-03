import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LabourRecordValidationError,
  validateLabourRecordData,
} from '../src/index.ts'

const ASSET_ID = 'a'.repeat(64)

test('labour.record keeps AssetId references opaque and reusable', () => {
  const produced = validateLabourRecordData({
    content: 'Produce an Asset',
    duration: 0.5,
    assets: [ASSET_ID],
  })
  const consumedByOne = validateLabourRecordData({
    content: 'Use the same Asset once',
    duration: 0.5,
    references: [ASSET_ID],
  })
  const consumedByTwo = validateLabourRecordData({
    content: 'Use the same Asset again',
    duration: 1,
    references: [ASSET_ID],
  })
  const missingLocalAsset = validateLabourRecordData({
    content: 'Reference an Asset that this node does not currently store',
    duration: 0,
    references: ['f'.repeat(64)],
  })

  assert.deepEqual(produced.assets, [ASSET_ID])
  assert.deepEqual(consumedByOne.references, [ASSET_ID])
  assert.deepEqual(consumedByTwo.references, [ASSET_ID])
  assert.deepEqual(missingLocalAsset.references, ['f'.repeat(64)])
})

test('labour.record does not gain previous, pid or reverse relation fields', () => {
  for (const extra of [
    { previous: ASSET_ID },
    { pid: ASSET_ID },
    { relations: [ASSET_ID] },
  ]) {
    assert.throws(
      () =>
        validateLabourRecordData({
          content: 'No artificial Asset graph metadata',
          duration: 0.5,
          ...extra,
        }),
      LabourRecordValidationError,
    )
  }
})
