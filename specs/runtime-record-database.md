# Runtime Database Specification

- **Status:** Draft — architecture correction; implementation pending
- **Scope:** Repository-local Core Record persistence for one Repo maintained by one Node
- **Reference:** [Board's MongoDB repository pattern](https://github.com/Ri0n72Y/board/tree/main/apps/board-api/src)
- **Requirements:** [Repository requirements](../docs/requirements.md)
- **Architecture:** [Repository architecture](../docs/architecture.md)

## Ownership and authority

**Each Repo is maintained by exactly one Repository Node.** Multiple Nodes do not concurrently maintain or write the same Repo. Distributed Repo writers, shared-Repo locking, cross-Node conflict arbitration and multi-Node coordination are outside the current design.

**MongoDB is the default persistent Runtime database.** The Node uses a small domain-facing storage interface so the provider may later be replaced without changing signed Core Record/Protocol fields. Follow Board's practical interface/implementation separation, not its specific business schemas.

MongoDB is trusted for persistence of data it has accepted. The Node does not independently implement database crash recovery, maintain a second copy of requests, or certify MongoDB's durability machinery. After restart it reconnects and reads persisted Records.

The database stores facts; it does not define the signed Record's semantic validity, make a Record Block-confirmed, or replace Core Protocol validation. A valid durable Repo acceptance Record D remains the Repo acceptance marker.

## Minimal domain-facing contract

The initial capability should be limited to the actual Repository needs:

- `accept(record)`: store an exact validated signed Core Record, idempotently by RecordId; reject conflicting data at the same ID.
- `get(recordId)`: load the exact persisted Record, distinguishing absence from a database failure.
- `iterate/query`: find stored Records for Repo establishment, contribution relationships and derived history.

Member, Repo and Contribution use the interface; they do not directly use MongoDB collections, `MongoClient` or BSON `_id`. The provider handles its indexes and normal storage operations. The application may serialize its own Repo acceptance operations as needed, using its one-Node ownership and persisted DB data. No shared-Repo multi-writer constraint or general transaction API is required.

Keep the already confirmed Core Record fields, `labour.record` fields, Repo establishment facts and `repo.contribution` fields. Do not copy Board `pid`, tags, patch, SnapshotHead or other Board business structures.

## Provider selection

```text
Repository domain / Protocol services
        -> narrow Runtime Record DB interface
        -> MongoDB provider (default)
        -> persisted Core Records
```

An alternative DB adapter may satisfy the same minimal interface. Its native storage IDs are local implementation details, never RecordId, AssetId or other signed Protocol data. An explicit in-memory test provider is fine; production Node must not silently substitute memory storage for a configured MongoDB provider failure.

MongoDB storage recovery belongs to MongoDB. No separate low-level MongoDB durability configuration, DB recovery verification framework or transaction coordinator is specified at Repository domain level.

## Node restart and contribution behavior

Startup recreates Cordis services, connects to the configured DB and reads existing facts; missing/stale query indexes or projections can be rebuilt from stored Records. This is ordinary Node initialization, not an independent Recovery feature.

For an interrupted contribution:

- Without a durable acceptance Record `D`, the Repo has not committed that contribution. Earlier durably stored facts may still exist.
- With valid durable `D`, the Repo accepted it. If necessary persisted relations cannot be read or validated, expose an integrity/storage error.
- A caller may explicitly retry the same signed operation using existing RecordId idempotency and the Repo's own same-key decision. The Node does not automatically complete an earlier request.

Asset identity, storage, availability and management are **deferred — rework required**. This DB Spec does not prescribe Asset storage or Asset-dependent contribution completion criteria.

## Explicit exclusions

No standalone contribution staging, `recoverPending()`, automatic request replay, phase state machine, generic queue, second Record store, general ORM, multi-Node Repo ownership, cross-Node locking, Block packing, chain synchronization or consensus.

## Implementation follow-up (outside this docs PR)

After this Spec is accepted: remove the withdrawn Recovery code (#47); implement the MongoDB-default provider behind this narrow interface (#31); reconcile existing Member/Repo/Contribution consumers with it; separately revisit all Asset-related functionality (#8). Do not silently retain obsolete persistence components or use the deferred Asset model as an implementation prerequisite.
