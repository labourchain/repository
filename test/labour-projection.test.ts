import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LabourPatchIntegrityError,
  LabourPatchValidationError,
  projectLabourHistory,
  validateLabourPatch,
  type LabourPatch,
  type LabourRecordView,
} from '../src/index.ts'

const record: LabourRecordView = {
  recordId: 'L',
  createdBy: 'member',
  data: { content: 'Immutable signed labour content', duration: 1 },
}
function patch(id: string, parentId: string | null, changes: Partial<LabourPatch>) {
  return {
    id, targetId: 'L', parentId,
    memberIdentity: 'member', createdAt: '2026-10-14T00:00:00.000Z',
    ...changes,
  }
}

test('projection replays unordered parent-linked annotations without touching L', () => {
  const a = patch('p1', null, { note: 'first', labelsAdd: ['bug'] })
  const b = patch('p2', 'p1', {
    note: 'second', labelsAdd: ['design'], labelsRemove: ['bug'],
  })
  const current = projectLabourHistory(record, [b, a])
  assert.equal(current.record, record)
  assert.deepEqual(record.data, {
    content: 'Immutable signed labour content', duration: 1,
  })
  assert.equal(current.version, 2)
  assert.equal(current.lastPatchId, 'p2')
  assert.deepEqual(current.labels, ['design'])
  assert.deepEqual(current.history.map((x) => x.id), ['p1', 'p2'])
  assert.deepEqual(current.annotations.map((x) => x.note), ['first', 'second'])
  assert.deepEqual(projectLabourHistory(record, []), {
    record, version: 0, lastPatchId: null,
    labels: [], annotations: [], history: [],
  })
})

test('unconnected, cross-target, branched, duplicated or cyclic patches fail closed', () => {
  const root = patch('root', null, { note: 'a' })
  const child = patch('child', 'root', { note: 'b' })
  const corrupt: LabourPatch[][] = [
    [root, patch('orphan', 'unknown', { note: 'c' })],
    [root, patch('bad-target', 'root', { targetId: 'other', note: 'c' })],
    [root, child, patch('fork', 'root', { note: 'c' })],
    [root, root],
    [patch('loop', 'loop', { note: 'cycle' })],
  ]
  for (const facts of corrupt) {
    assert.throws(() => projectLabourHistory(record, facts), LabourPatchIntegrityError)
  }
})

test('Patch is narrowly scoped to annotation and labels, never signed fields', () => {
  const valid = patch('p1', null, { labelsAdd: ['review'] })
  assert.deepEqual(validateLabourPatch(valid).labelsAdd, ['review'])
  const invalid = [
    patch('p', null, {}),
    patch('p', null, { note: '' }),
    patch('p', null, { note: 'ok', content: 'tampered' } as Partial<LabourPatch>),
    patch('p', null, { note: 'ok', labelsAdd: ['x', 'x'] }),
    patch('p', null, { note: 'ok', labelsAdd: ['x'], labelsRemove: ['x'] }),
    patch('p', null, { note: 'ok', labelsAdd: [''] }),
    patch('p', null, { note: 'ok', createdAt: '2026-10-14' }),
    patch('p', null, { note: 'ok', parentId: '' }),
    patch('p', null, { note: 'ok', memberIdentity: ' ' }),
  ]
  for (const item of invalid) {
    assert.throws(() => validateLabourPatch(item), LabourPatchValidationError)
  }
})
