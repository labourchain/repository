# Contribution Specification

- **Status:** Draft
- **Scope:** Repo Asset contribution, confirmation, commit, staging and recovery
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

A Repo contribution is the process by which a member submits an Asset associated with a Worker-produced Record and the relations and confirmations required by the applicable LabourChain Protocols.

Repository participates in Repo-side confirmation of the related labour. It does not produce the Record and does not reinterpret the Asset or Record.

## Preconditions

A contribution may become accepted only if:

- the contributor is a current Repo member;
- every required Protocol identity/version is available;
- the Asset, Record and contribution relations are valid under their referenced Protocol versions;
- required Worker confirmation is satisfied;
- required Repo-side confirmation is satisfied;
- the configured canonical fact capability is available.

Membership behavior is defined in [`membership.md`](./membership.md). Exact historical Protocol resolution is defined in [`protocol-resolution.md`](./protocol-resolution.md).

## Execution states

The Repository contribution execution model is:

```text
STAGED
  -> required confirmations satisfied
CONFIRMED
  -> canonical fact commit succeeds
COMMITTED
  -> later block packing
PACKED
```

`STAGED` is non-canonical runtime state.

`CONFIRMED` means the applicable confirmation requirements are satisfied. It is not Repository acceptance.

`COMMITTED` is the canonical commit boundary required for Repository acceptance.

`PACKED` belongs to later block packing and is not required for Repository acceptance.

These labels describe execution state. They do not require new canonical entities when chain facts and Protocol-defined relations already represent the same meaning.

## Acceptance contract

Repository may report a contribution as accepted only when:

1. the contribution has reached canonical committed state through the configured canonical fact/chain-state capability; and
2. the accepted Asset can be durably retrieved according to [`asset-storage.md`](./asset-storage.md).

A failed, incomplete, staged or confirmed-but-uncommitted contribution must not be reported as accepted.

Repository must not enrich, classify, summarize or silently rewrite the Asset or Record during contribution processing.

## Staging

A usable deployment must persist enough staging state to recover in-flight contribution work after process restart.

Staging must retain enough correlation information to determine whether the corresponding canonical commit occurred without relying on process memory.

Persisting staging does not make staging canonical.

An in-memory staging implementation may be used for isolated tests but does not satisfy the usable-deployment contract.

## Recovery

Recovery must converge toward canonical chain state.

The implementation must satisfy these invariants:

- uncommitted staged work never appears as accepted;
- restart does not lose the information needed to determine whether an in-flight contribution committed;
- if canonical commit succeeded before a crash, recovery converges to an accepted state with a retrievable Asset;
- if canonical commit did not succeed, recovery does not invent a committed contribution;
- retrying recovery does not create duplicate commits or duplicate singular confirmations;
- staging cleanup may occur after commit, but cleanup failure does not make a committed contribution appear uncommitted;
- a crash after commit but before history projection update is repairable by the history capability.

The implementation may resume, reconcile or discard uncommitted staged work as long as these invariants hold.

This Spec does not require a particular database transaction model, staging schema or queue implementation.

## Core and chain-state boundary

Core supplies deterministic Plugin, Entity, Record and Block semantics. It does not by itself imply a Repository-owned database or commit/query service.

Protocol-defined validity and confirmation semantics come from the loaded LabourChain Protocol implementations plus Core primitives. Canonical fact submission/query comes from a separately configured Runtime/composition capability.

Repository may temporarily use narrow adapters while that Runtime boundary stabilizes. Such adapters must fail closed, remain internal and avoid duplicating Core protocol definitions or becoming a second canonical chain store.

Repository does not implement block packing, consensus or peer synchronization.

## Failure model

Consumers must be able to distinguish at least:

- contributor is not a Repo member;
- required Protocol identity/version unavailable;
- canonical fact capability unavailable;
- Asset, Record or relation rejected by the applicable Protocol;
- required Worker or Repo confirmation absent or rejected;
- staging failure;
- canonical commit failure;
- commit result cannot be determined safely;
- post-commit Asset persistence/recovery failure.

## Acceptance tests

Tests must demonstrate that:

- a valid member contribution can reach committed accepted state;
- a non-member contribution cannot become accepted;
- invalid Asset, Record or relation data is rejected before acceptance;
- missing required confirmation prevents acceptance;
- missing exact Protocol version prevents acceptance;
- missing canonical fact capability fails closed;
- a crash before commit does not expose the contribution as accepted;
- a crash after commit but before staging cleanup recovers without duplicating the commit;
- retrying recovery is safe;
- a committed contribution is not required to be packed before Repository accepts it;
- accepted contribution reporting requires durable Asset retrieval.
