# Contribution History Specification

- **Status:** Draft
- **Scope:** Repo contribution-history view and runtime projection
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Repository exposes a view of labour related to accepted Repo contributions.

Contribution history is a derived view. It does not create a canonical Repository-owned Record collection.

The view may include both Repository-committed contributions that are still pending Block inclusion and contributions whose Records are already Block-confirmed. These statuses must remain distinguishable.

## History contract

The capability must expose the labour associated with Repo-accepted contributions and enough status to distinguish:

```text
pending-chain
block-confirmed
```

Behavior is equivalent to a Repository contribution-history query rather than a general `listRecords()` store.

The history view must only include contributions that reached the Repository acceptance boundary defined in [`contribution.md`](./contribution.md).

## Sources and derived data

Repository must not introduce canonical:

```text
repo.records[]
storeRecord(record)
getRecord(record)
```

solely to support history queries.

The history view derives from two explicit Runtime/chain sources:

```text
durable Record journal
    -> Repository accepted / pending-chain exact Records

chain-state / Block-confirmation adapter
    -> RecordId inclusion in accepted Blocks
    -> block-confirmed status and chain position
```

Runtime plugins may persist indexes, caches or projections that make history efficient to query. These derived data must:

- remain distinguishable from the durable journal and Block-confirmation evidence;
- be repairable or rebuildable from the journal plus available chain state;
- not silently alter the meaning of Records, Assets, confirmations or relations;
- not become authoritative merely because they are persisted.

## Query behavior

The MVP must support viewing the Records and related contribution information needed to answer which accepted labour contributions are associated with a Repo.

For each entry, the view must not claim `block-confirmed` unless the configured chain-state capability can support that conclusion.

If chain confirmation cannot currently be queried, a Repository-committed contribution may still be shown as accepted/pending-chain. Unknown chain status must not be upgraded to confirmed by inference from local persistence.

This Spec does not require advanced search, full-text indexing, analytics, pagination or Project/Board presentation.

The exact presentation shape is not fixed, but it must preserve enough identity/reference information for consumers to relate a history entry back to its exact Records and Assets.

## Recovery and rebuild

A crash after Repository commit but before projection update must not permanently omit that contribution from history.

The pending/accepted portion of the projection must be repairable from the durable Record journal and contribution correlation/index data.

When chain-state access is available, Block-confirmation status must be reconcilable from actual Block inclusion rather than from a stale local flag.

Projection update failure must not roll back or reinterpret an already Repository-committed contribution or an already Block-confirmed Record.

## Cordis integration

History projection, indexing and query capabilities are normal Cordis plugins or services. Repository does not require a dedicated History Protocol merely because a history view exists.

If the history implementation consumes Protocol-defined facts, historical interpretation must obey [`protocol-resolution.md`](./protocol-resolution.md).

## Failure model

Consumers must be able to distinguish at least:

- Repo unavailable;
- durable accepted-Record source unavailable;
- chain-confirmation source unavailable when confirmation status is requested;
- projection unavailable or inconsistent;
- referenced Protocol version unavailable while interpreting historical facts.

A stale or missing projection must not be presented as authoritative absence when the implementation knows it cannot verify that conclusion.

## Acceptance tests

Tests must demonstrate that:

- a Repository-committed contribution appears in contribution history before Block packing as pending-chain;
- an uncommitted/staged contribution does not appear as accepted history;
- a Block-confirmed contribution is distinguishable from pending-chain;
- missing chain-state access does not cause a pending contribution to be reported as confirmed;
- history does not require or expose a canonical Repository `records[]` store;
- persisted projection data remains identifiable as derived data;
- a crash after Repository commit but before projection update can be repaired from durable Runtime state;
- Block-confirmation status can be reconciled from actual chain state when available;
- rebuilding or reconciliation does not create duplicate logical history entries;
- Project or Board concepts are not required to query Repo contribution history.
