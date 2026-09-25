# Contribution Specification

- **Status:** Draft
- **Scope:** Repo Asset contribution, domain confirmation, Repository commit, staging and recovery
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

A Repo contribution is the process by which a Member submits an Asset associated with a Member-produced labour Record and the relations, Patch facts and confirmations required by the applicable LabourChain Protocols.

Repository participates in Repo-side confirmation of the related labour. It does not produce the Member's labour Record and does not reinterpret the Asset, Record or Patch facts.

## Preconditions

A contribution may become accepted only if:

- every required human-readable Protocol reference and exact `ProtocolHash` can be resolved and verified;
- the Asset, Record, Patch and contribution relations that apply to this contribution are valid under those exact Protocol semantics;
- required Member / labour-subject confirmation is satisfied;
- required Repo-side confirmation is satisfied; when that confirmation is a Repo-authored decision, the Repo-signed Protocol data identifies the actual `operator: EntityPublicKey`;
- the configured durable Record ingress/journal is available;
- the accepted Asset can be made durably retrievable.

Labourer and Repo are independent identities. Repository does not require a chain-level membership relation between them. Exact historical Protocol resolution is defined in [`protocol-resolution.md`](./protocol-resolution.md).

## Labourer / Repo relationship and operator trace

Labourer and Repo do not acquire a separate chain membership relation merely because a contribution is submitted or accepted.

```text
Labourer / Member identity
    -> produces/signs labour facts

Repo identity
    -> decides whether to accept the contribution
```

The durable relationship between them is the accepted contribution itself. Contributor/member lists, groups, tags and filters are product views or local software data and are not Repository chain validity inputs.

When a Protocol expresses the Repo-side acceptance or another Repo decision as a Repo-authored Record:

```text
Record.createdBy = Repo EntityPublicKey
Record.signature = Repo identity signature
Record.data.operator = actual operator EntityPublicKey
```

`operator` is action attribution recorded by the Repo-signed fact. This Spec does not interpret it as proof of an organization role, delegation or governance authority.

## Execution and chain status

Repository execution and chain confirmation are separate dimensions.

Repository execution is:

```text
STAGED
  -> required domain confirmations satisfied
DOMAIN_CONFIRMED
  -> exact resulting Records are durably accepted
  -> accepted Asset is durably retrievable
COMMITTED
```

`STAGED` is temporary Runtime processing state.

`DOMAIN_CONFIRMED` means the applicable Protocol-defined confirmation requirements are satisfied. It is not Repository acceptance and is deliberately named so it cannot be confused with Block confirmation.

`COMMITTED` is the Repository acceptance boundary. It means the accepted contribution can survive process restart: the exact Records needed for the contribution are retained by the durable Record journal and the accepted Asset is durably retrievable.

Chain status is tracked separately:

```text
pending-chain
  -> block-confirmed
```

A Repository-committed contribution remains `pending-chain` until accepted-chain evidence shows its relevant Records are included in an independently validated Block. Local Block construction or packing does not itself make the contribution block-confirmed.

These labels describe Repository product state and chain evidence. They do not redefine Core Record or Block identity semantics.

## Acceptance contract

Repository may report a contribution as accepted only when:

1. all applicable contribution and domain-confirmation rules have succeeded;
2. every Record required to preserve the accepted contribution has been durably accepted by the configured Record ingress/journal; and
3. the accepted Asset can be durably retrieved according to [`asset-storage.md`](./asset-storage.md).

A failed, incomplete, staged or domain-confirmed-but-not-durable contribution must not be reported as accepted.

Repository must not enrich, classify, summarize or silently rewrite the Asset, Member-produced labour Record or Protocol-defined Patch facts during contribution processing.

Block production and peer validation are later chain steps. A `COMMITTED` contribution may therefore remain pending-chain; callers must not be told that it is block-confirmed unless accepted-chain evidence says so.

## Runtime validation and chain trust

Repository validation is the normal producer path for forming a coherent pending state. It is useful for early rejection, recovery, relation maintenance and future Block packing, but it is not a chain-level proof that other nodes must trust.

A future peer validator must validate the actual Records in a candidate Block against the exact Protocol composition committed by that Block. It must not rely on the producer's earlier Repository validation result or Runtime Snapshot.

This Story therefore keeps the Runtime Record database coherent for normal operation without trying to turn Repository into a trusted execution environment or general smart-contract VM.

## Durable Record ingress

A usable deployment must provide a durable Record ingress/journal that retains exact signed Records across restart.

The contribution flow requires behavior equivalent to:

```text
accept exact Record idempotently by RecordId
read accepted Record by RecordId
replay/query accepted pending Records sufficiently for recovery
```

Successful durable acceptance is a Runtime durability property, not Block confirmation.

A specific signed Record remains bound by its RecordId and signature. Before Block confirmation, the node may nevertheless add, replace or abandon candidate facts by producing/selecting different valid Records according to applicable Protocol semantics.

## Record + Patch and Snapshot

Repo state evolution uses Record + Patch facts when the applicable Protocol defines an update.

```text
Record + Patch history
    -> fact source

Runtime Snapshot
    -> materialized current view / cache
    -> rebuildable from facts + exact Protocol semantics
```

A Snapshot does not enter Record history and must not be submitted as a replacement fact merely because it is convenient for recovery or querying. Contribution processing may update or invalidate Runtime Snapshots after accepting new facts, but accepted truth remains in the Record + Patch history.

This Spec does not define a generic Patch schema. Patch meaning belongs to the Protocol whose state it updates.

## Staging

A usable deployment must persist only the staging/correlation state needed to recover work that has not yet reached `COMMITTED`.

Staging must retain enough correlation information to determine which exact Records, Patch facts and Asset finalization belong to the in-flight contribution.

Persisting staging does not make the contribution accepted.

An in-memory staging implementation may be used for isolated tests but does not satisfy the usable-deployment contract.

## Recovery

Recovery converges toward the durable Repository commit state while preserving separate chain-confirmation status.

The implementation must satisfy these invariants:

- work that never reached the durable Record journal and durable Asset boundary never appears as `COMMITTED`;
- if required Records were durably accepted before a crash, recovery does not create duplicate Record acceptance;
- if the Records are durable but Asset finalization was incomplete, recovery can finish/reconcile Asset persistence before exposing `COMMITTED`;
- if the Asset is durable but required Record acceptance failed, recovery does not invent `COMMITTED`;
- retrying recovery does not create duplicate singular confirmations or duplicate accepted Asset finalization;
- Runtime relationship state and Snapshot/cache state may be rebuilt from durable facts and exact Protocol semantics rather than treated as independent acceptance truth;
- staging cleanup may occur after commit, but cleanup failure does not make a committed contribution appear uncommitted;
- later accepted Block inclusion can upgrade/display chain-confirmation status without changing the Repository acceptance fact.

The implementation may resume, reconcile or discard pre-commit staged work as long as these invariants hold.

This Spec does not require a particular database transaction model, staging schema or queue implementation.

## Core and chain-state boundary

Core supplies deterministic Protocol, Entity, Record and Block primitives. Protocol-defined Repository validity and confirmation semantics come from exact verified LabourChain Protocol implementations plus Core primitives.

Durable pre-pack Record acceptance comes from a Runtime/composition Record journal and relationship validation state comes from the Repository Runtime Record database. Chain inclusion status, when needed, comes from a chain-state / accepted-Block capability. These responsibilities may later share one node-runtime implementation, but their semantics remain distinct.

Repository does not implement Block packing, peer validation, consensus or synchronization in this Story.

## Failure model

Consumers must be able to distinguish at least:

- required exact ProtocolHash / verified implementation unavailable;
- Asset, Record, Patch or relation rejected by the applicable Protocol;
- required Member / labour-subject or Repo confirmation absent or rejected;
- durable Record ingress unavailable or failed;
- staging failure;
- accepted Asset persistence/finalization failure;
- commit result cannot be determined safely;
- chain-confirmation status unavailable when explicitly requested.

## Acceptance tests

Tests must demonstrate that:

- a valid labour / Asset contribution can reach Repository `COMMITTED` / accepted state;
- invalid Asset, Record, Patch or relation data is rejected before Repository acceptance;
- missing required domain confirmation prevents acceptance;
- missing exact ProtocolHash / verified implementation prevents acceptance;
- missing durable Record ingress prevents Repository commit;
- a crash before durable commit does not expose the contribution as accepted;
- a crash after Record acceptance but before Asset finalization can recover without duplicating Record acceptance;
- retrying recovery is safe;
- Repository commit does not require Block packing;
- local candidate-Block packing does not by itself become block-confirmed status;
- accepted contribution reporting requires durable Asset retrieval;
- pending-chain and block-confirmed states are not conflated;
- Runtime Snapshot/cache deletion does not delete or rewrite the underlying accepted Record + Patch facts.
