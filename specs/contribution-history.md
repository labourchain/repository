# Contribution History Specification

- **Status:** Draft
- **Scope:** Repo contribution-history view and runtime projection
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Repository exposes a view of labour related to accepted Repo contributions.

Contribution history is derived from canonical Records, Assets, confirmations and contribution relations. It is not a canonical Repository-owned Record collection.

## History contract

The capability must expose the labour associated with committed Repo contributions.

Behavior is equivalent to a Repository contribution-history query rather than a general `listRecords()` store.

The history view must only include contributions that reached the Repository acceptance boundary defined in [`contribution.md`](./contribution.md).

## Canonical and derived data

Repository must not introduce canonical:

```text
repo.records[]
storeRecord(record)
getRecord(record)
```

solely to support history queries.

Record remains a Worker-produced on-chain fact.

Runtime plugins may persist indexes, caches or projections that make contribution history efficient to query. These data must:

- remain distinguishable from canonical facts;
- be repairable or rebuildable from canonical sources when the required chain-query capability is available;
- not silently alter the meaning of Records, Assets, confirmations or relations;
- not become the source of truth merely because they are persisted.

## Query behavior

The MVP must support viewing the Records and related contribution information needed to answer which accepted labour contributions are associated with a Repo.

This Spec does not require advanced search, full-text indexing, analytics, pagination or Project/Board presentation.

The exact shape of the returned view is not fixed until the available Core query contracts are stable, but it must preserve enough identity/reference information for consumers to relate the history entry back to its canonical facts.

## Recovery

A crash after canonical contribution commit but before projection update must not permanently omit that contribution from history.

The projection path must therefore be repairable through one or both of:

- replay/reconciliation from durable contribution correlation state;
- rebuilding from canonical chain facts when the required query capability is available.

Projection update failure must not roll back or reinterpret an already canonical commit.

## Cordis integration

History projection, indexing and query capabilities are normal Cordis plugins or services. Repository does not require a dedicated History Protocol merely because a history view exists.

If the history implementation consumes Protocol-defined facts, historical interpretation must obey [`protocol-resolution.md`](./protocol-resolution.md).

## Failure model

Consumers must be able to distinguish at least:

- Repo unavailable;
- required canonical/query source unavailable;
- projection unavailable or inconsistent;
- referenced Protocol version unavailable while interpreting historical facts.

A stale or missing projection must not be presented as authoritative canonical absence when the implementation knows it cannot verify that conclusion.

## Acceptance tests

Tests must demonstrate that:

- a committed accepted contribution appears in Repo contribution history;
- an uncommitted contribution does not appear as accepted history;
- history does not require or expose a canonical Repository `records[]` store;
- persisted projection data remains identifiable as derived data;
- a crash after commit but before projection update can be repaired so the committed contribution appears;
- rebuilding or reconciliation does not create duplicate logical history entries;
- Project or Board concepts are not required to query Repo contribution history.
