# Runtime Database Specification

- **Status:** Draft — design correction; implementation pending
- **Scope:** Repository node-local persisted Core Records and minimal Repository query/mutation boundaries
- **Reference:** [Board's working MongoDB repository pattern](https://github.com/Ri0n72Y/board/tree/main/apps/board-api/src)
- **Requirements:** [Repository requirements](../docs/requirements.md)
- **Architecture:** [Repository architecture](../docs/architecture.md)

## Decision and authority

Repository adopts **MongoDB as its default persistent database**, following the working Board practice of a domain-facing repository interface and a separate MongoDB implementation. Domain Protocol and orchestration code must not depend on `MongoClient`, collections, BSON `_id`, or provider-specific queries. A different database may implement the same required semantics without changing Protocol facts.

This corrects the earlier filesystem Record-journal plus a same-process `RuntimeRecordDatabase` wrapper. Those existing implementations are **legacy code awaiting replacement**, not the target persistent database architecture.

The database is the authority for **which exact Repository-local Records have been durably accepted**. It is not the source of Protocol validity, Repo acceptance semantics, Block confirmation, or chain consensus. The applicable exact Protocols and signed facts continue to define those meanings.

## Minimum storage-facing contract

The current confirmed Core Record fields and Protocol-specific `Record.data` remain unchanged. An implementation should provide only the operations actually consumed by Member, Repo, labour, contribution and history features:

- Accept one exact already-validated signed Record durably, idempotently by Core RecordId. Reject non-equivalent data under the same id.
- Read one exact stored Record by RecordId, distinguishing not found from database unavailability or inconsistent data.
- Enumerate/query stored accepted Records sufficiently for Repo establishment, concrete contribution uniqueness and later history projection.
- Atomically enforce the concrete uniqueness/conditional-write invariant needed to publish a Repo acceptance Record; do **not** rely on a process-only mutex when multiple node instances share the database.
- Expose storage failures rather than silently substituting an empty in-memory repository.

A conceptual interface is `accept(record)`, `get(recordId)`, and a bounded `iterate/query` capability, plus a provider-safe **concrete conditional acceptance** for the real same-key invariant. The exact TypeScript signatures and index shapes belong to the subsequent implementation design, not to a new generic ORM, graph DB, queue or transaction framework.

## MongoDB default and replaceability

Follow Board's useful separation:

```text
Repository Protocol/domain service
        -> narrow Record storage interface
        -> MongoDB implementation (default)
        -> MongoDB database
```

Board's `RecordRepository` and `MongoRecordRepository` demonstrate interface/implementation separation, its `db/mongo.ts` creates collections and indexes, and `services/index.ts` assembles the provider. **Do not copy Board's `pid`, `schema`, `patch`, tags or SnapshotHead fields**: Repository uses its already established Core Record and Repo Protocol fields.

MongoDB collection names, BSON identifiers and indexes are implementation details. Unique indexes / conditional writes must enforce real identity and Repo acceptance invariants. Use the configured MongoDB deployment's supported durability and atomicity features; multiple writes to distinct collections are **not automatically atomic**. Board's SnapshotHead path itself requires transactions for strong multi-document consistency and has a weaker standalone fallback; that fallback is not a Repository integrity guarantee.

Other storage providers may be implemented behind the same contract, but the normal Repository node must not silently fall back to an ephemeral memory database when durable MongoDB is unavailable. In-memory implementations may be used explicitly by unit tests.

## Restart and failure semantics

The database owns storage-engine crash durability and recovery. On node restart, Repository reopens its configured provider, reads existing persisted facts, verifies their exact Protocol semantics as needed, and reconstructs only derived indexes/views. It does **not** maintain a second durable copy of whole contribution requests, replay interrupted user commands, or run a bespoke `recoverPending()` coordinator.

An interrupted request with no durable Repo acceptance Record `D` is **not Repository COMMITTED**. Persisted independent facts remain facts. An existing durable `D` remains the Repository acceptance marker; it is not rolled back because the caller missed a response. If its dependencies are corrupt/unavailable, report an integrity/storage failure rather than using request data to heal them.

If a caller explicitly retries the **same supplied signed operation**, already existing RecordId/AssetId idempotency and concrete same-key conflict rules apply. This is caller retry, not automatic startup recovery.

## Out of scope

- A standalone Repository Recovery service, durable staging queue or phase state machine;
- rewriting already signed Record fields or storing MongoDB native ids in signed facts;
- a second append-only file journal acting as an independent Record authority;
- a generic DB abstraction or unrestricted business CRUD interface;
- a Repository-specific plugin manager outside Cordis;
- Block packing, chain-state ownership, synchronization or consensus;
- fixing/redefining Asset storage while the Asset model is deferred for rework.

## Implementation migration (not performed by this documentation change)

1. Replace legacy filesystem Record journal / `RuntimeRecordDatabase` storage plumbing with a narrow DB-backed provider and MongoDB default.
2. Remove `ContributionStagingService`, `RepositoryContributionRecoveryService`, their exports, plugin wiring and recovery-only preflight/helpers/tests.
3. Reconcile contribution's single-domain acceptance path with the new DB atomicity/uniqueness contract while preserving the confirmed signed `repo.contribution` fields.
4. Separately redesign Asset management before treating its existing content-byte provider as accepted MVP scope.
