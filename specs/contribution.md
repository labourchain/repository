# Contribution Specification

- **Status:** Under revision — signed facts retained; Asset-dependent behavior deferred
- **Requirements:** [Repository requirements](../docs/requirements.md)
- **Architecture:** [Repository architecture](../docs/architecture.md)
- **Protocol:** [Repo Contribution Protocol](./repo-contribution.md)
- **Runtime DB:** [Runtime Database](./runtime-record-database.md)

## Labour record, optional Asset and later Repo decision

A Member signs a Core `labour.record@0.1.0` Record **L** to declare work that occurred. This is sufficient to record and later review labour, with **no requirement to supply an Asset A or Repo decision D**. A, when present, is a separately modeled labour result referenced by `L.data.references[]` / `L.data.assets[]`. Its implementation is deferred to #8.

A Repo may later decide, typically during a collective daily or weekly meeting, to accept a labour contribution. The positive acceptance is independently signed by the Repo as **D**; saving L in the Runtime DB is not that decision. One meeting can review many L without an additional compulsory batch-signature or staging subsystem. Reject/defer/review notes are not inferred from the absence of D.

**Published Protocol `repo.contribution@0.1.0` remains exact and unchanged:**

```text
L.createdBy = Member EntityPublicKey
L.data.references[] = optional confirmed upstream Asset references
L.data.assets[] = optional declared result Asset references

D.createdBy = Repo EntityPublicKey
D.data = { labourRecordId: L.id, assetId, operator }
```

In v0.1.0, D is a Repo-signed positive acceptance of the **specific A selected from `L.assets[]`**. The signed `assetId` is required; v0.1.0 cannot express positive Repo acceptance of an L without A.

**Future versioned Protocol requirement:** Repo should be able to accept (a) labour L alone or (b) L with a selected A. Conceptually `{ labourRecordId, assetId?, operator }` can distinguish these two cases; the exact new Protocol version, data constraints, key/conflict semantics and compatibility tests require their own design/review. Do not mutate v0.1.0 data validation, reuse its ProtocolHash or reinterpret already signed records.

D records a Repo identity's signed positive decision and the declared `operator`; it does not by itself prove how a daily/weekly meeting voted, or that an operator was authorized by a collective. Meeting governance and separate evidentiary facts remain future scope.

Core identity/signatures and exact ProtocolHash verification remain authoritative. Repository consumes externally supplied signed facts; it does not sign for Member or Repo. No second Member-confirmation Record, ContributionId, generic relation or Patch is required by the existing v0.1.0 slice.

## Repository acceptance boundary

A valid, durably accepted D is the Repo's **later positive acceptance fact**, distinct from merely saving L and from Block confirmation. D-last applies only to the actual Repo acceptance operation; it does not impose a mandatory A → L → D write transaction on ordinary labour capture. The same signed D is idempotent. A distinct D for the same `(Repo, L.id, assetId)` logical key is a conflict under the Repo's **single-Node** acceptance path. No distributed writers maintain the same Repo.

```text
No durable D -> no positive Repo acceptance fact (but L may still be valid and stored; absence is not a rejection).
Valid durable D + required relations readable/valid -> Repository acceptance.
Durable D with corrupt/unavailable required facts -> explicit error.
```

The Node reads and writes these facts through its configured Runtime DB provider. MongoDB is the default. The domain service may serialize operations for the Repo within its owning Node. Do not turn this into a cross-Node locking, multi-writer uniqueness or transaction framework.

## No standalone Recovery

The previous independent Contribution Recovery / staging behavior is withdrawn. The target implementation does not persist entire requests for later automatic replay or provide `recoverPending()`. After restart the Node simply loads the Records persisted in MongoDB; it does not execute an unfinished request on its own.

A caller can explicitly retry the original signed input. This is ordinary idempotent domain behavior, not application-level DB Recovery. D is not fabricated from partial earlier facts, and an existing D is not silently repaired from request material.

Staged-request providers, recovery-specific preflight/helpers and tests were removed in #47. The earlier filesystem Record persistence implementations are not part of the new target design.

## Asset-dependent behavior: DEFERRED

**All concrete Asset behavior is postponed pending #8 rework.** The signed names `references[]`, `assets[]` and `assetId` remain; their contents are opaque references for the present contract. No byte-content identity, 16 MiB size limit, filesystem `preserve/get/has`, selected-result availability, repair policy, Asset DB schema, or Asset lifecycle is confirmed.

The previous Contribution implementation's Asset-preserve/get ordering and Asset-dependent `COMMITTED` checks are historical implementation details, **not current accepted MVP behavior**. Requirements for actually managing and retrieving an accepted Asset will be set during the separate Asset design review. Do not preempt that review through this Spec.

## Chain boundary

Repository acceptance is `pending-chain` unless an accepted Block/chain-state source proves inclusion. Local DB presence or candidate Block construction never implies `block-confirmed`.

## Acceptance checks after redesign

- Original v0.1.0 signed L/D field sets, signatures and exact ProtocolHash validation preserved; no retroactive change to required `assetId`.
- RecordId duplicate handling and one-Repo same-key conflict behavior preserved.
- DB/node restart reads already persisted Records without staging or automatic contribution completion.
- D absent is never represented as accepted; corrupt required persisted facts fail explicitly.
- No separate Recovery service, ContributionId, multi-Node coordination or generic DB framework.
- Asset-specific tests and end-to-end contribution completion criteria remain **deferred until #8 is agreed**.
- No-A Repo acceptance requires a new versioned Protocol plus its own tests; it is not a permitted in-place change to v0.1.0.

This correction changes documentary authority; it does not implement the DB migration or delete existing code.
