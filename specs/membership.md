# Membership Specification

- **Status:** Draft
- **Scope:** Repo operator-controlled contribution membership
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Membership determines which Workers may contribute Assets to a Repo.

Membership does not determine whether a Worker may create Records or Assets outside the Repo.

## Contract

The capability must provide behavior equivalent to:

```text
addMember(repo, operator, worker)
removeMember(repo, operator, worker)
hasMember(repo, worker)
listMembers(repo)
```

Exact API names and whether these operations are exposed through one or several Cordis services remain implementation choices.

## Authorization

Only the Repo operator may add or remove members in the MVP.

A non-operator membership mutation must fail without changing membership state.

The MVP does not introduce additional Repository roles.

## Set semantics

Membership behaves as a set:

- adding an existing member does not create a duplicate relationship;
- removing a missing member does not create new state;
- listing members must not expose duplicates representing the same Worker relationship.

## Contribution eligibility

A Worker must be a current Repo member before that Worker can have an Asset contribution accepted by the Repo.

Membership failure must prevent the contribution from reaching accepted committed state.

The contribution execution details are defined in [`contribution.md`](./contribution.md).

## Persistence

Membership state must survive ordinary application restart in a usable deployment.

An in-memory implementation may be used for isolated tests but does not satisfy the usable-deployment persistence contract.

## Boundaries

This Spec does not define:

- Worker identity semantics;
- whether a Worker may create Records or Assets generally;
- complex ACL or role hierarchies;
- Project membership;
- Personal Repo ownership semantics.

## Failure model

Consumers must be able to distinguish at least:

- Repo unavailable;
- actor is not the Repo operator;
- Worker identity invalid or unavailable according to applicable Core semantics;
- membership persistence failure.

## Acceptance tests

Tests must demonstrate that:

- the operator can add a Worker;
- the operator can remove a Worker;
- membership can be checked and listed;
- a non-operator cannot mutate membership;
- adding the same Worker twice does not create duplicate membership;
- removing a missing Worker does not create new state;
- membership survives restart with a persistent test provider;
- membership only controls Repo contribution eligibility and does not become a general Worker permission system.
