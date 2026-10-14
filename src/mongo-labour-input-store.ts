import type { Collection } from 'mongodb'
import {
  LabourInputConflictError,
  LabourInputNotFoundError,
  LabourInputStorageError,
  type LabourInput,
  type LabourInputStore,
} from './labour-input.ts'

interface StoredLabourInput {
  _id: string
  serialized: string
  confirmedRecordId?: string
}

function decode(doc: StoredLabourInput): LabourInput {
  let input: LabourInput
  try {
    input = JSON.parse(doc.serialized) as LabourInput
  } catch (cause) {
    throw new LabourInputStorageError(
      'Invalid persisted labour input: ' + doc._id, { cause },
    )
  }
  if (typeof input !== 'object' || input === null ||
      input.id !== doc._id || typeof input.originalText !== 'string' ||
      typeof input.source !== 'string' ||
      typeof input.memberIdentity !== 'string' ||
      typeof input.createdAt !== 'string' ||
      (doc.confirmedRecordId !== undefined &&
        typeof doc.confirmedRecordId !== 'string')) {
    throw new LabourInputStorageError(
      'Corrupt labour input: ' + doc._id,
    )
  }
  const { confirmedRecordId: _unused, ...original } = input
  return {
    ...original,
    ...(doc.confirmedRecordId !== undefined
      ? { confirmedRecordId: doc.confirmedRecordId } : {}),
  }
}

/** Separate draft documents; never insert unsigned data in the Core Records collection. */
export class MongoLabourInputStore implements LabourInputStore {
  private readonly collection: Collection<StoredLabourInput>
  constructor(collection: Collection<StoredLabourInput>) {
    this.collection = collection
  }

  async create(input: LabourInput): Promise<void> {
    if (input.confirmedRecordId !== undefined) {
      throw new LabourInputConflictError(input.id)
    }
    try {
      await this.collection.insertOne({
        _id: input.id,
        serialized: JSON.stringify(input),
      })
    } catch (cause) {
      throw new LabourInputStorageError(
        'Unable to persist labour input: ' + input.id, { cause },
      )
    }
  }

  async get(id: string): Promise<LabourInput | null> {
    let stored: StoredLabourInput | null
    try {
      stored = await this.collection.findOne({ _id: id })
    } catch (cause) {
      throw new LabourInputStorageError(
        'Unable to load labour input: ' + id, { cause },
      )
    }
    return stored ? decode(stored) : null
  }

  async list(): Promise<LabourInput[]> {
    try {
      const results: LabourInput[] = []
      for await (const item of this.collection.find().sort({ _id: 1 })) {
        results.push(decode(item))
      }
      return results
    } catch (cause) {
      if (cause instanceof LabourInputStorageError) throw cause
      throw new LabourInputStorageError(
        'Unable to list labour inputs.', { cause },
      )
    }
  }

  async linkConfirmed(id: string, recordId: string): Promise<void> {
    let changed: StoredLabourInput | null
    try {
      changed = await this.collection.findOneAndUpdate(
        { _id: id, confirmedRecordId: { $exists: false } },
        { $set: { confirmedRecordId: recordId } },
        { returnDocument: 'after' },
      )
    } catch (cause) {
      throw new LabourInputStorageError(
        'Unable to link signed Labour Record: ' + id, { cause },
      )
    }
    if (changed) return
    const existing = await this.get(id)
    if (!existing) throw new LabourInputNotFoundError(id)
    if (existing.confirmedRecordId !== recordId) {
      throw new LabourInputConflictError(id)
    }
  }
}
