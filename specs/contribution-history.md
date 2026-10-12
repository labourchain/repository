# Contribution History Specification

- **Status:** Draft — implementation deferred pending MongoDB Runtime DB migration and Asset rework
- **Scope:** Derived Repo contribution-history view, not independent Record storage
- **Requirements:** [Repository requirements](../docs/requirements.md)
- **Architecture:** [Repository architecture](../docs/architecture.md)
- **Runtime DB:** [runtime-record-database.md](./runtime-record-database.md)

## Purpose

Show the labour facts associated with a Repo's accepted contributions, with a distinction between Repository `pending-chain` and independently accepted Block `block-confirmed`.

## Authorities

```text
MongoDB-default Runtime Record DB (replaceable provider; one owning Node per Repo)
  -> exact stored Member-signed labour Records L
  -> exact stored Repo-signed acceptance Records D
  -> Repo acceptance fact determined by valid durable D and dependencies

exact ProtocolHash / verified artifact
  -> historical interpretation of L and D

accepted-Block / chain-state adapter
  -> independent Block inclusion / chain position

optional query projection / index
  -> rebuildable from those authorities
```

The DB is trusted for which data it reliably persisted, but it is not chain confirmation and does not replace Protocol validation. An unavailable chain adapter must never cause a false `block-confirmed` result.

The history view is not a `repo.records[]` collection, nor an ownership claim over all chain facts. The existing signed relation uses `D.createdBy`, `D.data.labourRecordId`, `D.data.assetId`, `D.data.operator`, and labour `references[] / assets[]`.

## Query contract to finalize

The later implementation should expose a narrow Repo-scoped history view. It will select valid durable D facts, resolve exact L/relation semantics and return enough identities for consumers to trace signed Records and the selected result reference.

Pending-chain is the conservative representation when there is no accepted Block inclusion evidence. When chain access is explicitly required and unavailable, callers must be able to distinguish that unavailability rather than being given fabricated confirmation.

Ordinary pagination, advanced search, analytics, generic DAG indexing, ownership semantics and Project/Board organisation are not requirements of this capability.

## Projection rebuild — not Contribution Recovery

After node restart, reopen the Runtime DB and read durable facts. If a query projection is absent, inconsistent or stale, rebuild/repair it from stored Records and actual chain-state evidence. **Do not replay earlier user contribution requests or invoke a standalone `recoverPending()` service.**

A crash between D persistence and projection update must not permanently omit the accepted contribution; later projection reconciliation must be able to find that durable D. Neither rebuilding a projection nor deleting a cache may change the signed facts or Block inclusion.

Only the configured Runtime DB supplies Repository-local persisted Record facts. The standalone Contribution staging/replay mechanism is withdrawn.

## Asset dependency

**All Asset-related identity, storage, management, listing and retrieval are deferred / rework required.** History retains only the agreed opaque signed reference fields until the separate Asset design is accepted.

## Failure boundaries and acceptance

- A valid durable Repo acceptance Record is present in pending history before Block confirmation.
- No D means no accepted contribution merely because a labour Record or other stored data exists.
- Exact ProtocolHash resolution is required; no latest/compatible fallback.
- Only accepted-chain evidence upgrades a record to `block-confirmed`.
- Missing DB/provider/Protocol inputs cause explicit unavailable/integrity results where required, not authoritative empty history.
- Materialized indexes and query caches remain derived and can be rebuilt.
- No generic chain indexer, Block packer, consensus, second DB fact authority or contribution auto-recovery service is created.

This Spec remains **Draft** until the revised DB and Asset boundaries are implemented/reviewed.
