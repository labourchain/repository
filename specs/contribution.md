# Contribution Specification

- **Status:** Draft
- **Scope:** Repo Asset contribution, confirmation, commit, staging and recovery
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

A Repo contribution is the process by which a member submits an Asset associated with a Worker-produced Record and the relations and confirmations required by the applicable LabourChain Protocols.

Repository participates in Repo-side confirmation of the related labour. It does not produce the Worker's labour Record and does not reinterpret the Asset or Record.

## Preconditions

A contribution may become accepted only if:

- the contributor is a current Repo member;
- every required Protocol identity/version is available;
- the Asset, Record and contribution relations are valid under their referenced Protocol versions;
- required Worker confirmation is satisfied;
- required Repo-side confirmation is satisfied;
- the configured durable Record ingress/journal is available;
- the accepted Asset can be made durably retrievable.

Membership behavior is defined in [`membership.md`](./membership.md). Exact historical Protocol resolution is defined in [`protocol-resolution.md`](./protocol-resolution.md).

## Execution states

The Repository contribution execution model is:

```text
STAGED
  -> required domain confirmations satisfied
CONFIRMED
  -> exact resulting Records are durably accepted
  -> accepted Asset is durably retrievable
COMMITTED
  -> later Block inclusion
PACKED
```

`STAGED` is temporary Runtime processing state.

`CONFIRMED` means the applicable domain confirmation requirements are satisfied. It is not Repository acceptance.

`COMMITTED` is the Repository acceptance boundary. It means the accepted contribution can survive process restart: the exact Records needed for the contribution are retained by the durable Record journal and the accepted Asset is durably retrievable.

`COMMITTED` does **not** mean the Records have already been included in a Block.

`PACKED` means the relevant Records have been included in a valid Block and therefore have chain-confirmation status. It is not required before Repository returns the contribution as accepted.

These labels describe Repository execution/confirmation state. They do not redefine Core Record or Block identity semantics.

## Acceptance contract

Repository may report a contribution as accepted only when:

1. all applicable contribution and confirmation rules have succeeded;
2. every Record required to preserve the accepted contribution has been durably accepted by the configured Record ingress/journal; and
3. the accepted Asset can be durably retrieved according to [`asset-storage.md`](./asset-storage.md).

A failed, incomplete, staged or confirmed-but-not-durable contribution must not be reported as accepted.

Repository must not enrich, classify, summarize or silently rewrite the Asset or Worker-produced Record during contribution processing.

Block packing is a later chain step. A `COMMITTED` contribution may therefore be pending-chain; callers must not be told that it is block-confirmed unless chain-state evidence says so.

## Durable Record ingress

A usable deployment must provide a durable Record ingress/journal that retains exact signed Records across restart.

The contribution flow requires behavior equivalent to:

```text
accept exact Record idempotently by RecordId
read accepted Record by RecordId
replay/query accepted pending Records sufficiently for recovery
```

Successful durable acceptance is a Runtime durability property, not Block confirmation.

The journal must preserve the exact Record representation accepted for later chain inclusion. It must not silently normalize or rewrite protocol data.

## Staging

A usable deployment must persist only the staging/correlation state needed to recover work that has not yet reached `COMMITTED`.

Staging must retain enough correlation information to determine which exact Records and Asset finalization belong to the in-flight contribution.

Persisting staging does not make the contribution accepted.

An in-memory staging implementation may be used for isolated tests but does not satisfy the usable-deployment contract.

## Recovery

Recovery converges toward the durable Repository commit state, while preserving any separate Block-confirmation status.

The implementation must satisfy these invariants:

- work that never reached the durable Record journal and durable Asset boundary never appears as `COMMITTED`;
- if required Records were durably accepted before a crash, recovery does not create duplicate Record acceptance;
- if the Records are durable but Asset finalization was incomplete, recovery can finish/reconcile Asset persistence before exposing `COMMITTED`;
- if the Asset is durable but required Record acceptance failed, recovery does not invent `COMMITTED`;
- retrying recovery does not create duplicate singular confirmations or duplicate accepted Asset finalization;
- staging cleanup may occur after commit, but cleanup failure does not make a committed contribution appear uncommitted;
- later Block inclusion can upgrade/display chain-confirmation status without changing the Repository acceptance fact.

The implementation may resume, reconcile or discard pre-commit staged work as long as these invariants hold.

This Spec does not require a particular database transaction model, staging schema or queue implementation.

## Core and chain-state boundary

Core supplies deterministic Plugin, Entity, Record and Block semantics. It does not by itself imply a Repository-owned database, Record queue or network node.

Protocol-defined validity and confirmation semantics come from loaded LabourChain Protocol implementations plus Core primitives.

Durable pre-pack Record acceptance comes from a Runtime/composition Record journal. Chain inclusion status, when needed, comes from a chain-state/Block-confirmation adapter. These capabilities may later share one node-runtime implementation, but their semantics remain distinct.

Repository does not implement block packing, consensus or peer synchronization in this Story.

## Failure model

Consumers must be able to distinguish at least:

- contributor is not a Repo member;
- required Protocol identity/version unavailable;
- Asset, Record or relation rejected by the applicable Protocol;
- required Worker or Repo confirmation absent or rejected;
- durable Record ingress unavailable or failed;
- staging failure;
- accepted Asset persistence/finalization failure;
- commit result cannot be determined safely;
- chain-confirmation status unavailable when explicitly requested.

## Acceptance tests

Tests must demonstrate that:

- a valid member contribution can reach Repository `COMMITTED` / accepted state;
- a non-member contribution cannot become accepted;
- invalid Asset, Record or relation data is rejected before acceptance;
- missing required confirmation prevents acceptance;
- missing exact Protocol version prevents acceptance;
- missing durable Record ingress prevents Repository commit;
- a crash before durable commit does not expose the contribution as accepted;
- a crash after Record acceptance but before Asset finalization can recover without duplicating Record acceptance;
- retrying recovery is safe;
- a Repository-committed contribution is not required to be packed before Repository accepts it;
- accepted contribution reporting requires durable Asset retrieval;
- pending-chain and block-confirmed states are not conflated.
