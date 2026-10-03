# Asset Storage Specification

- **Status:** Accepted
- **Scope:** exact durable preservation and retrieval of Asset content
- **Asset model:** [`asset.md`](./asset.md)
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Repository must be able to preserve the exact Asset defined by the applicable
Asset Protocol and retrieve it after restart by stable AssetId.

This is a Runtime storage capability. It does not define Asset identity,
production lineage, Repo acceptance, chain confirmation or a generic object
store.

## Minimum storage contract

The MVP capability is equivalent to:

```text
preserve(asset)
get(assetId)
has(assetId)
```

Exact API names remain implementation choices.

No generic update/delete/query API is required. `listAssets(repo)` is not an
Asset-storage primitive: the Repo Asset view is derived from accepted
contributions and their Asset references. Advanced search and indexing remain
outside the MVP.

## Durable value

For one AssetId, the provider must durably preserve enough information to
reconstruct the exact Asset:

```text
id
protocol
protocolHash
contentHash
exact content bytes
```

Provider-native paths, row IDs, object keys, filenames or collection names are
implementation details. They may index the value internally but never become
LabourChain Asset identity.

No separate `repo`, `member`, `recordId`, `previous`, `pid`,
accepted-status or relation field is required in the Asset value.

## Resource boundary

`asset.content@0.1.0` accepts at most 16 MiB (`16 * 1024 * 1024` bytes) of raw
content. The storage provider must support the whole valid range and may not
quietly substitute a smaller provider-specific Asset-size limit. Content above
the Protocol limit is rejected deterministically before hashing, durable lookup
or publication. I/O, filesystem quota and capacity exhaustion for an otherwise
valid-size Asset are persistence failures, not size-policy results.

This MVP intentionally keeps the complete-Asset boundary and does not introduce
chunk manifests, multipart persistence, range retrieval or a generic streaming
API. Larger/streamed Assets are a future Protocol/provider evolution.

## Preserve semantics

`preserve` must apply this order exactly:

1. enforce the `asset.content@0.1.0` raw-content resource limit;
2. validate the incoming Asset canonically under [`asset.md`](./asset.md):
   claimed `contentHash`, claimed AssetId, then exact Protocol/reference
   consistency;
3. only after the incoming Asset is canonical-valid, look up durable state by
   AssetId;
4. if absent, preserve the new Asset atomically; if exact-equal, return
   idempotent success; if the already-present canonical descriptor or bytes
   differ, fail with `AssetIdentityConflict` and never overwrite.

A valid AssetId paired with unrelated bytes fails incoming canonical validation
as `InvalidAsset`; it is not an `AssetIdentityConflict`. A resolved exact
Protocol whose human-readable reference differs fails as
`ProtocolReferenceMismatchError` before durable lookup. The conflict category
is reserved for a canonical-valid incoming Asset encountering incompatible
durable state under the same AssetId. In normal cryptographic operation that
should require a hash collision, provider corruption/state anomaly, or an
implementation/storage defect, but the behavior must remain fail-closed.

Success means that after an ordinary process restart:

- `has(assetId)` reports the complete durable Asset;
- `get(assetId)` returns the exact descriptor and exact bytes;
- returned bytes still match `contentHash` and AssetId.

An exact duplicate preserve is idempotent and must not create a second logical
Asset.

Content-derived Asset identity does not require the provider itself to be a
content-addressed storage system.

## Atomic visibility

The storage boundary is one complete Asset, not individual provider files or
rows.

A failed or interrupted preserve must not become visible as a successful Asset
through `get` or `has`. Provider-specific temporary files/rows may exist
during recovery, but incomplete state is not a valid Asset.

The contract does not require a distributed transaction with the durable Record
journal.

Contribution coordinates the two durable boundaries:

```text
durable Records
+
durable Asset
+
domain confirmations
= Repository COMMITTED
```

If Records are already durable but Asset preservation is interrupted, the
contribution remains not-COMMITTED until recovery makes the exact Asset
retrievable. If an Asset is durable but required Records are not, the stored
bytes likewise do not by themselves create an accepted contribution.

This keeps crash recovery possible without inventing a second canonical Record
store or a cross-provider transaction manager.

## Retrieval semantics

`get(assetId)` must distinguish:

- exact Asset found;
- Asset not found;
- provider unavailable/read failure;
- durable data present but identity/integrity verification fails.

Corruption is an error, not `not found`.

`has(assetId)` is true only for a complete durable Asset. If the provider
cannot determine that safely, it must surface failure rather than returning a
false success.

## Record / Asset relationship

Asset storage does not maintain reverse Record links or a lineage graph.

The durable relationship is recovered by joining:

```text
durable labour Records
  references[] / assets[]
          +
durable Assets by AssetId
```

The existing Runtime Record database and Record journal remain the Record
ingress/durability boundary. Asset storage must not create a parallel canonical
Record database.

A missing referenced Asset is therefore explicit `not found` at this storage
boundary. It does not retroactively invalidate creation of a
`labour.record@0.1.0`; a later Contribution/applicable Protocol decides
whether local availability is required for acceptance.

## Repository acceptance and chain status

Durable Asset existence is not equivalent to Repo acceptance.

A contribution becomes Repository `COMMITTED` only under
[`contribution.md`](./contribution.md), after required exact Records,
confirmations and durable Asset retrieval all succeed.

Repository `COMMITTED` remains separate from Block confirmation. Asset
storage never reports `block-confirmed` and does not implement Block packing,
chain validation or peer synchronization.

## Restart and recovery invariants

After a successful preserve:

- restart must return the same AssetId and exact bytes;
- duplicate detection must still work;
- conflict detection must still work;
- Record/Asset joins must remain reconstructable from durable Records and
  AssetId;
- process-local cache loss must not change identity or retrieval.

After an interrupted preserve:

- no falsely complete Asset may be exposed;
- retry with the exact Asset may safely converge to one durable value;
- retry with an internally invalid same-id/different-bytes object remains
  `InvalidAsset`;
- a canonical-valid identity conflict/provider-state anomaly remains fail
  closed.

## Failure model

Consumers must be able to distinguish at least:

- Asset content exceeds the `asset.content@0.1.0` 16 MiB raw-content limit;
- invalid Asset identity/integrity;
- exact Protocol/reference mismatch;
- exact Asset not found;
- canonical-valid Asset identity conflict / durable state anomaly;
- persistence failure;
- retrieval/provider failure;
- detected durable corruption.

Exact error class names are implementation choices.

## Implementation test contract

| Invariant | Future executable test | Likely module |
| --- | --- | --- |
| same exact Asset persists once | preserve twice, retrieve one exact value | `test/asset-storage.test.ts` |
| raw-content limit is exact | size == 16 MiB succeeds; size > 16 MiB returns the resource-limit result before durable visibility | `test/asset-storage.test.ts` |
| invalid claimed identity is not conflict | valid id A + unrelated bytes B returns `InvalidAsset` before durable lookup | `test/asset-storage.test.ts` |
| canonical-valid conflict/state anomaly never replaces | inject competing canonical-valid durable state at the persistence seam; preserve fails closed and existing bytes remain | `test/asset-storage.test.ts` |
| restart durability | preserve, dispose node/provider, reopen, get exact bytes | `integration/asset-storage-restart.test.ts` |
| duplicate detection survives restart | preserve, restart, preserve same Asset again | `integration/asset-storage-restart.test.ts` |
| conflict detection survives restart | preserve, restart, inject/observe canonical-valid conflicting state at the persistence seam; fail closed | `integration/asset-storage-restart.test.ts` |
| resource semantics survive restart | size boundary and oversize classification are unchanged after provider restart | `integration/asset-storage-restart.test.ts` |
| interrupted write is not visible | inject failure before durable completion; get/has cannot expose complete Asset | `test/asset-storage.test.ts` |
| corruption is not not-found | corrupt persistent fixture; retrieval fails explicitly | `integration/asset-storage-restart.test.ts` |
| Record store remains authoritative for Records | Asset preservation creates no second canonical Record entry | `test/asset-storage.test.ts` |
| lineage survives restart | reload labour Records + Assets and reconstruct references/assets joins | `integration/asset-storage-restart.test.ts` |
| durability != acceptance/confirmation | durable Asset alone creates neither COMMITTED contribution nor block-confirmed state | later `test/contribution.test.ts` |

The persistence tests must cross the actual persistent provider boundary. A mock
that only stores the Asset in process memory does not satisfy restart,
interruption or corruption coverage.

## Deferred cross-boundary validation

The #8 identity and storage invariants above are testable without another
Repository architecture layer.

Three assertions intentionally cannot be completed by the #8 implementation
alone because they require the later Contribution boundary:

- a successfully COMMITTED contribution cannot leave durable Record and Asset
  state disagreeing about the contributed Asset;
- a durable Asset by itself never upgrades a contribution to COMMITTED;
- a missing upstream Asset follows the concrete contribution/applicable-Protocol
  acceptance policy rather than an Asset-storage policy.

Those tests belong in the #9 Contribution integration suite. This is a
dependency on a real consumer boundary, not a reason to add transaction,
registry or graph machinery to #8.

## Boundaries

This Spec does not define:

- contribution staging schema;
- Repo Asset-list projection;
- contribution history;
- Asset ownership/property rights;
- mutable Asset versions or Patch;
- provider schema/layout;
- generic object-store APIs;
- distributed storage, replication or IPFS;
- search/index platform;
- Block packing, chain validation, synchronization or consensus.
