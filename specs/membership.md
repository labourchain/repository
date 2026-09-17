# Membership Specification

- **Status:** Draft
- **Scope:** Repo operator-controlled contribution membership
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)
- **Member dependency:** [`member.md`](./member.md)

## Purpose

Membership determines which human Members may contribute Assets to a Repo.

Membership is a relation between an already valid Member identity and a Repo. It does not create another Member identity and does not determine whether that Member may create Records or Assets outside the Repo.

## Contract

The capability must provide behavior equivalent to:

```text
addMember(repo, operator, member)
removeMember(repo, operator, member)
hasMember(repo, member)
listMembers(repo)
```

Exact API names and whether these operations are exposed through one or several Cordis services remain implementation choices.

## Authorization

Only the Repo operator may add or remove members in the MVP.

A non-operator membership mutation must fail without changing membership state.

The MVP does not introduce additional Repository roles.

## Member identity boundary

Every membership target must satisfy the Member capability defined in [`member.md`](./member.md).

Repo membership must not mint a new identity, copy profile data into the membership relation, or interpret a generic process/runtime worker as a human Member.

The relation is therefore equivalent to:

```text
Member EntityPublicKey
    ↔ Repo EntityPublicKey
```

with the applicable membership Protocol semantics supplying contribution eligibility.

## Set semantics

Membership behaves as a set:

- adding an existing member does not create a duplicate relationship;
- removing a missing member does not create new state;
- listing members must not expose duplicates representing the same Member relationship.

## Contribution eligibility

A Member must be a current Repo member before that Member can have an Asset contribution accepted by the Repo.

Membership failure must prevent the contribution from reaching accepted committed state.

The contribution execution details are defined in [`contribution.md`](./contribution.md).

## Persistence

Membership state must survive ordinary application restart in a usable deployment.

An in-memory implementation may be used for isolated tests but does not satisfy the usable-deployment persistence contract.

## Boundaries

This Spec does not define:

- Member identity semantics beyond consuming the Member capability;
- whether a Member may create Records or Assets generally;
- a second human identity type;
- complex ACL or role hierarchies;
- Project membership;
- ownership or private-property semantics.

## Failure model

Consumers must be able to distinguish at least:

- Repo unavailable;
- actor is not the Repo operator;
- target identity is not a valid Member;
- Member identity invalid or unavailable according to applicable Core/Member semantics;
- membership persistence failure.

## Acceptance tests

Tests must demonstrate that:

- the operator can add a valid Member;
- the operator can remove a Member;
- membership can be checked and listed;
- a non-operator cannot mutate membership;
- a non-Member Entity cannot be silently treated as a Repo Member;
- adding the same Member twice does not create duplicate membership;
- removing a missing Member does not create new state;
- membership survives restart with a persistent test provider;
- membership only controls Repo contribution eligibility and does not become a general Member permission system.
