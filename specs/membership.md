# Membership Specification

- **Status:** Draft
- **Scope:** Repo operator-controlled contribution membership
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)
- **Member dependency:** [`member.md`](./member.md)
- **Repo dependency:** [`repo.md`](./repo.md)

## Purpose

Membership determines which human Members may contribute Assets to a Repo.

Membership is a relation between an already valid Member identity and an already established Repo. It does not create another Member identity and does not determine whether that Member may create Records or Assets outside the Repo.

## Membership Protocol

Story #6 implements the minimum mutation semantics as:

```text
repo.membership@0.1.0
```

The exact `Record.protocolHash` must match the exact ProtocolHash supplied by the Host when this Protocol implementation is mounted. `repo.membership@0.1.0` is the signed human-readable reference; ProtocolHash is the exact machine authority under Core v0.1.0.

A membership mutation is one signed Record:

```ts
interface RepoMembershipMutation {
  repo: EntityPublicKey
  member: EntityPublicKey
  action: 'add' | 'remove'
  previousMutation: RecordId | null
}
```

The enclosing Record supplies the actor:

```text
Record.createdBy
= mutation author

repo.membership interpretation:
Record.createdBy must equal the Repo's current MVP operator
```

The operator is derived from the accepted Repo establishment Record. Membership does not introduce another owner/admin/operator source.

## Relation sequence

Membership is mutable state, while the durable Record journal deliberately carries no business ordering semantics and Core `Record.createdAt` is only a signed string, not a trusted ordering field.

Therefore the current state of one `Repo × Member` relation is expressed by an explicit predecessor chain.

`previousMutation` is:

- `null` for the first state-changing mutation of that relation;
- otherwise the RecordId of the immediately preceding accepted `repo.membership@0.1.0` mutation for the same Repo and Member.

A state-changing mutation is accepted only when its `previousMutation` matches the current durable head for that exact relation.

This gives a relation-local causal sequence without relying on:

- journal filename / replay order;
- process arrival order;
- wall-clock time;
- `createdAt` sorting;
- provider-native sequence numbers.

For one relation, accepted state-changing mutations therefore alternate:

```text
no relation
  -> add
  -> remove
  -> add
  -> remove
  -> ...
```

A durable history containing a missing predecessor, predecessor from another relation, cycle, fork, invalid initial `remove`, or non-alternating state transition is invalid and rebuild must fail closed.

Cross-node concurrent mutation arbitration is outside Story #6, as node synchronization/consensus is outside the Repository MVP. Same-node mutation handling must serialize the check-and-accept boundary so two state-changing Records cannot both consume the same durable head through one service instance.

## State-change semantics

The effective membership view behaves as a set, but a `repo.membership` Record represents an accepted state change rather than a command/request.

- `add` is valid only when the relation is currently inactive;
- `remove` is valid only when the relation is currently active;
- submitting a new mutation that would not change the current state fails explicitly and is not durably accepted;
- exact replay of an already accepted mutation Record is idempotent;
- a stale mutation whose `previousMutation` does not equal the current relation head fails explicitly rather than being silently rebased.

A caller that wants idempotent product behavior should query the current membership view before constructing/signing a new mutation Record. Protocol success means the exact Record is already accepted as a durable membership fact.

## Authorization

Only the Repo's current MVP operator may author a state-changing or no-op membership request.

Authorization uses the Repo capability:

```text
loadRepo(repo)
-> RepoView.operator
-> compare with Record.createdBy
```

A non-operator mutation must fail before the Record becomes durable membership state.

The MVP does not introduce additional Repository roles or operator transfer.

## Member identity boundary

Every membership target must satisfy the `member.identity` capability defined in [`member.md`](./member.md).

Repo membership must not mint a new identity, copy profile data into the membership relation, or interpret a generic process/runtime worker as a human Member.

The relation is:

```text
Repo EntityPublicKey
    ×
Member EntityPublicKey
```

with `repo.membership@0.1.0` supplying only contribution-eligibility semantics.

## Runtime contract

The minimum runtime behavior is equivalent to:

```text
applyMembership(mutationRecord)
getMembership(repo, member)
hasMember(repo, member)
listMembers(repo)
rebuild()
```

`applyMembership`:

1. validates the exact Core Record, Protocol reference/hash and signature;
2. validates Repo and target Member identities;
3. requires the target to satisfy the Member capability;
4. loads the Repo and requires `Record.createdBy == RepoView.operator`;
5. compares `previousMutation` with the durable current relation head;
6. rejects a new mutation that would not change the current relation state;
7. durably accepts the exact state-changing Record through `recordJournal` before reporting success.

`getMembership` exposes enough current relation information for a caller/signer to construct the next mutation without inventing provider ordering:

```ts
interface MembershipView {
  repo: EntityPublicKey
  member: EntityPublicKey
  active: boolean
  headRecordId: RecordId | null
}
```

`listMembers(repo)` exposes current active Member identities only and must not expose duplicates. Ordering is a query/runtime concern and carries no membership-history semantics.

Signing UX, secret-key custody and Record construction are outside this capability.

## Persistence and rebuild

The exact accepted membership mutation Records are the durable source.

Runtime may maintain replaceable projections equivalent to:

```text
Repo × Member
-> current head RecordId
-> active / inactive
```

and:

```text
Repo
-> current active Member set
```

These projections must be rebuildable from accepted `repo.membership@0.1.0` Records without using journal enumeration order as domain order. Current read APIs rebuild from durable facts before answering; a future cache invalidation/index generation mechanism may optimize this only when a concrete scale need appears.

A usable restart path must recover the same current membership view from the durable predecessor chains.

Accepted membership Records are Repository accepted / pending-chain facts until actual chain-state evidence reports Block inclusion. Local journal persistence must not be presented as Block confirmation.

## Contribution eligibility

A Member must be a current Repo member before that Member can have an Asset contribution accepted by the Repo.

Membership failure must prevent the contribution from reaching Repository accepted / `COMMITTED` state.

Contribution execution remains defined by [`contribution.md`](./contribution.md); Story #6 does not implement contribution.

## Failure model

Consumers must be able to distinguish at least:

- Repo unavailable / not established;
- actor is not the Repo operator;
- target identity is not a valid Member;
- invalid Core Record, Repo identity or Member identity;
- wrong membership Protocol reference/hash;
- stale predecessor / relation conflict;
- malformed or conflicting durable membership history;
- durable Record ingress/journal failure.

## Boundaries

This Spec does not define:

- Member identity semantics beyond consuming `member.identity`;
- whether a Member may create Records or Assets generally;
- a second human identity type;
- operator transfer;
- owner/admin/maintainer/editor/viewer roles;
- generic ACL;
- Project membership;
- ownership or private-property semantics;
- contribution execution;
- Block packing, consensus or node synchronization;
- a Repository-domain chain database.

## Acceptance tests

Tests must demonstrate that:

- the Repo operator can add a valid Member;
- the operator can remove a current Member;
- membership can be checked and active members listed;
- a non-operator cannot mutate membership;
- a non-Member Entity cannot be silently treated as a Repo Member;
- adding an already active Member fails explicitly without creating another durable membership mutation;
- removing an inactive Member fails explicitly without creating durable membership state;
- exact accepted Record replay is idempotent;
- a stale `previousMutation` cannot silently overwrite the current relation head;
- same-node competing state-changing mutations cannot both consume one head;
- current membership survives restart and rebuild independent of journal enumeration order;
- malformed/forked predecessor history fails closed;
- membership remains Repo-scoped contribution eligibility only;
- accepted/pending-chain membership state is not presented as Block-confirmed;
- the Membership Protocol service follows Cordis lifecycle disposal.
