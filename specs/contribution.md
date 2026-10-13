# Contribution Specification

- **Status:** Under revision — signed facts retained; Asset-dependent behavior deferred
- **Requirements:** [Repository requirements](../docs/requirements.md)
- **Architecture:** [Repository architecture](../docs/architecture.md)
- **Protocol:** [Repo Contribution Protocol](./repo-contribution.md)
- **Runtime DB:** [Runtime Database](./runtime-record-database.md)

## Confirmed signed facts

A Member records labour using a signed `labour.record@0.1.0` Core Record L. Repo acceptance is a separate Repo-signed `repo.contribution@0.1.0` Record D:

```text
L.createdBy = Member EntityPublicKey
L.data.references[] = confirmed upstream references
L.data.assets[] = declared result references

D.createdBy = Repo EntityPublicKey
D.data = { labourRecordId: L.id, assetId, operator }
```

The Repo acceptance fact selects one reference from `L.data.assets[]`. The labourer's confirmation is L itself; no second Member confirmation, ContributionId, generic relation or Patch is required. `operator` records the actor without assigning ownership, governance or ACL authority.

Core identity/signatures and exact ProtocolHash verification remain authoritative. The Repository consumes signed facts; it does not sign on behalf of Member or Repo.

## Repository acceptance boundary

A valid, durably accepted D is the Repo's positive acceptance fact, distinct from Block confirmation. The same signed D is idempotent. A distinct D for the same `(Repo, L.id, assetId)` logical key is a conflict under the Repo's **single-Node** acceptance path. No distributed writers maintain the same Repo.

```text
No durable D -> no Repo acceptance fact.
Valid durable D + required relations readable/valid -> Repository acceptance.
Durable D with corrupt/unavailable required facts -> explicit error.
```

The Node reads and writes these facts through its configured Runtime DB provider. MongoDB is the default. The domain service may serialize operations for the Repo within its owning Node. Do not turn this into a cross-Node locking, multi-writer uniqueness or transaction framework.

## No standalone Recovery

The previous independent Contribution Recovery / staging behavior is withdrawn. The target implementation does not persist entire requests for later automatic replay or provide `recoverPending()`. After restart the Node simply loads the Records persisted in MongoDB; it does not execute an unfinished request on its own.

A caller can explicitly retry the original signed input. This is ordinary idempotent domain behavior, not application-level DB Recovery. D is not fabricated from partial earlier facts, and an existing D is not silently repaired from request material.

Existing staged-request providers, recovery-specific preflight/helpers and tests will be removed separately under #47. The earlier filesystem Record persistence implementations are not part of the new target design.

## Asset-dependent behavior: DEFERRED

**All concrete Asset behavior is postponed pending #8 rework.** The signed names `references[]`, `assets[]` and `assetId` remain; their contents are opaque references for the present contract. No byte-content identity, 16 MiB size limit, filesystem `preserve/get/has`, selected-result availability, repair policy, Asset DB schema, or Asset lifecycle is confirmed.

The previous Contribution implementation's Asset-preserve/get ordering and Asset-dependent `COMMITTED` checks are historical implementation details, **not current accepted MVP behavior**. Requirements for actually managing and retrieving an accepted Asset will be set during the separate Asset design review. Do not preempt that review through this Spec.

## Chain boundary

Repository acceptance is `pending-chain` unless an accepted Block/chain-state source proves inclusion. Local DB presence or candidate Block construction never implies `block-confirmed`.

## Acceptance checks after redesign

- Original signed L/D field sets, signatures and exact ProtocolHash validation preserved.
- RecordId duplicate handling and one-Repo same-key conflict behavior preserved.
- DB/node restart reads already persisted Records without staging or automatic contribution completion.
- D absent is never represented as accepted; corrupt required persisted facts fail explicitly.
- No separate Recovery service, ContributionId, multi-Node coordination or generic DB framework.
- Asset-specific tests and end-to-end contribution completion criteria remain **deferred until #8 is agreed**.

This correction changes documentary authority; it does not implement the DB migration or delete existing code.
