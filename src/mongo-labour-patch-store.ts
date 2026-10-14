import type { Collection } from 'mongodb'
import {
  LabourPatchConflictError,
  LabourPatchIntegrityError,
  LabourPatchStorageError,
  validateLabourPatch,
  type LabourPatch,
  type LabourPatchStore,
} from './labour-patch.ts'

export interface StoredLabourPatch {
  _id: string
  targetId: string
  parentId: string | null
  serialized: string
}

function duplicateKey(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null &&
    'code' in cause && cause.code === 11000
}

function decode(doc: StoredLabourPatch): LabourPatch {
  try {
    const patch = validateLabourPatch(JSON.parse(doc.serialized))
    if (patch.id !== doc._id || patch.targetId !== doc.targetId ||
        patch.parentId !== doc.parentId) {
      throw new LabourPatchIntegrityError('Labour Patch storage keys do not match the payload.')
    }
    return patch
  } catch (cause) {
    throw new LabourPatchIntegrityError('Invalid stored Labour Patch: ' + doc._id, { cause })
  }
}

/** Separate immutable local annotation facts; no writes to Core Record documents. */
export class MongoLabourPatchStore implements LabourPatchStore {
  private readonly collection: Collection<StoredLabourPatch>

  constructor(collection: Collection<StoredLabourPatch>) {
    this.collection = collection
  }

  async append(patch: LabourPatch): Promise<void> {
    const valid = validateLabourPatch(patch)
    try {
      await this.collection.insertOne({
        _id: valid.id,
        targetId: valid.targetId,
        parentId: valid.parentId,
        serialized: JSON.stringify(valid),
      })
    } catch (cause) {
      if (duplicateKey(cause)) {
        throw new LabourPatchConflictError('Labour Patch ID or parent was already accepted.')
      }
      throw new LabourPatchStorageError('Unable to append Labour Patch.', { cause })
    }
  }

  async list(targetId: string): Promise<LabourPatch[]> {
    try {
      const values = await this.collection.find({ targetId }).toArray()
      return values.map(decode)
    } catch (cause) {
      if (cause instanceof LabourPatchIntegrityError) throw cause
      throw new LabourPatchStorageError('Unable to load Labour Patch history.', { cause })
    }
  }
}
