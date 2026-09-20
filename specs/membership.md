# Membership Specification

- **Status:** Draft
- **Scope:** Repo-signed contribution membership facts
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)
- **Member dependency:** [`member.md`](./member.md)
- **Repo dependency:** [`repo.md`](./repo.md)

## Purpose

Membership determines which human Members are eligible to contribute Assets to a Repo.

Membership is a Repo-authored fact about an already valid Member identity. It does not create another Member identity and it is not itself a causal chain.

The causal production chain belongs to labour and Asset protocols:

```text
Labour
  -> Asset
  -> new Labour using that Asset
  -> new Asset
  -> ...
```

Membership only states whether a Member is accepted by a Repo. The Repo-signed `Record.createdAt` supplies deterministic ordering between those membership facts; it is not a scheduler for future activation.

## Membership Protocol

Story #6 implements:

```text
repo.membership@0.1.0
```

The exact `Record.protocolHash` must match the exact ProtocolHash supplied by the Host when this Protocol implementation is mounted.

A membership fact is one signed Record:

```ts
interface RepoMembershipFact {
  repo: EntityPublicKey
  member: EntityPublicKey
  action: 'add' | 'remove'
}
```

The enclosing Record supplies both authority and the fact's Repo-signed creation time:

```text
Record.createdBy
= Repo EntityPublicKey

Record.signature
= signature by the Repo identity

Record.createdAt
= Repo-signed membership fact creation/order time
```

The Membership Protocol requires `Record.createdBy == Record.data.repo`.

How an operator causes the Repo key to sign such a Record is signer/key-custody runtime behavior and remains outside Story #6.

## Temporal semantics

Membership facts do not contain `previous`, `previousMutation` or another predecessor pointer.

For one `Repo × Member` relation, the current membership is derived from the latest valid Repo-signed membership fact by `Record.createdAt`.

`repo.membership@0.1.0` therefore assigns domain meaning to `createdAt` that Core itself deliberately does not assign:

```text
Core Record.createdAt
= signed string, no generic ordering semantics

repo.membership interpretation
= deterministic Repo-signed ordering time for membership facts
```

The Membership Protocol requires `createdAt` to use canonical UTC ISO form with millisecond precision, for example `2026-09-19T00:00:02.000Z`, so every node derives the same ordering. An accepted fact participates in the current projection immediately; `createdAt` does not mean “activate this membership at that future wall-clock instant”.

If two distinct membership facts for the same `Repo × Member` relation have the same `createdAt`, the history is ambiguous and rebuild fails closed.

Repeated `add` or repeated `remove` facts are allowed as redundant Repo statements when they occupy distinct `createdAt` positions. They do not create duplicate current membership because only the latest fact determines the current set. Two distinct Records at the same `createdAt` remain invalid even when they assert the same action, because that ordering position must resolve to one RecordId.

The field name `action` describes what the Repo-signed fact asserts for the relation: `add` asserts membership is active from that fact onward in the membership fact order, while `remove` asserts it is inactive. It is not a command executed against a previous mutation.

## Block relation

A Block commits to an ordered `Record[]`, but Core does not derive or validate domain DAG semantics from that array.

This allows, for example, one Block to contain:

```text
1. Member identity fact already exists / is recognized
2. Repo-signed membership add fact
3. Labour Record by that Member
4. resulting Asset Record
```

The Membership Protocol establishes contribution eligibility. Labour/Asset protocols are responsible for their own input/output and causal relationships.

Story #6 does not add a rule that every Membership fact must be confirmed in an earlier Block before it can be used. Repository-accepted membership may still be pending-chain.

## Member identity boundary

Every membership target must satisfy the `member.identity` capability defined in [`member.md`](./member.md).

Membership therefore relates:

```text
Repo EntityPublicKey
    ×
Member EntityPublicKey
```

It must not mint a second human identity, copy Member profile data, or interpret a runtime/process worker as a human Member.

`requireMember` and `loadRepo` are acceptance-time prerequisites: the Repository must recognize the target Member and Repo when accepting or rebuilding a membership fact. Story #6 does not prove historical ordering such as `member.identity.createdAt < membership.createdAt < labour.createdAt`, nor same-Block positional validity. Those historical relationships belong to later labour/contribution semantics.

## Runtime contract

The minimum runtime behavior is equivalent to:

```text
applyMembership(record)
getMembership(repo, member)
hasMember(repo, member)
listMembers(repo)
rebuild()
```

`applyMembership`:

1. validates the exact Core Record, Protocol reference/hash and signature;
2. validates Repo and target Member identities;
3. requires the target to satisfy the Member capability;
4. requires the Repo to already be established;
5. requires `Record.createdBy == data.repo`;
6. validates `Record.createdAt` as the canonical Repo-signed membership fact ordering time;
7. enters the shared Runtime Record database boundary, validates the relation-local ordering position, and durably accepts the exact Record through its journal session;
8. rebuilds the Membership Runtime database namespace from durable facts and reports the resulting current view.

Exact replay of an already accepted Record is idempotent.

A historical fact whose `createdAt` is older than the current fact may still be durably retained without replacing the current view.

`MembershipView` is equivalent to:

```ts
interface MembershipView {
  repo: EntityPublicKey
  member: EntityPublicKey
  active: boolean
  latestRecordId: RecordId | null
  latestCreatedAt: string | null
}
```

`listMembers(repo)` exposes each currently active Member once.

## Persistence and rebuild

The exact accepted membership Records remain the durable facts. Repository Runtime also maintains validated relationship state for normal operation and later packing; this relationship state is part of the Runtime Record database boundary rather than merely a display/query cache.

For Story #6, the Membership service implements the minimum relation indexes equivalent to:

```text
Repo × Member
-> latest membership Record by `createdAt`
-> active / inactive

Repo × Member × createdAt
-> unique membership RecordId
```

The second index validates that one relation cannot contain two distinct facts at the same ordering position before a new Record is durably accepted through the Membership path.

Story #6 introduces only the minimum shared Runtime Record database boundary required to make that validation atomic with same-process journal mutation: one serialized Runtime operation boundary plus Protocol-namespaced relationship state. It does not introduce a generic relationship schema, generic DAG engine, SQL model or Block packer.

Current read operations rebuild the Membership namespace from durable facts before answering. This keeps #6 recoverable while preserving the architecture in which Repository Runtime relationship state is a correctness input for validation and later packing.

Rebuild must not depend on:

- journal enumeration order;
- filesystem filename order;
- RecordId lexical order;
- process arrival order.

It derives the current view from Repo-signed membership `createdAt` ordering.

Accepted membership facts are Repository accepted / pending-chain until actual chain-state evidence reports Block inclusion. Local journal persistence must not be presented as Block confirmation.

## Contribution eligibility

A Member must have a current active Repo membership before a contribution can be accepted by that Repo.

The precise historical relationship between a membership fact and a Labour/contribution Record belongs to the later contribution/labour protocols. Story #6 only exposes membership facts and the current view.

Contribution execution remains outside Story #6.

## Failure model

Consumers must be able to distinguish at least:

- Repo unavailable / not established;
- membership Record not authored by the Repo identity;
- target identity is not a valid Member;
- invalid Core Record, Repo identity or Member identity;
- wrong membership Protocol reference/hash;
- invalid membership `createdAt` ordering time;
- ambiguous distinct facts at the same `createdAt`;
- durable Record ingress/journal failure.

## Boundaries

This Spec does not define:

- Member identity semantics beyond consuming `member.identity`;
- labour/Asset causal DAG semantics;
- contribution execution;
- Repo key custody or signing UX;
- operator transfer;
- owner/admin/maintainer/editor/viewer roles;
- generic ACL;
- Project membership;
- ownership or private-property semantics;
- Block packing, consensus or node synchronization;
- a second blockchain or Repository-owned canonical-chain store.

## Acceptance tests

Tests must demonstrate that:

- a Repo-signed membership add makes a valid Member active;
- a later-created Repo-signed remove makes that Member inactive;
- membership can be checked and active Members listed;
- a non-Repo signer cannot author membership for that Repo;
- a non-Member Entity cannot be silently treated as a Repo Member;
- repeated add/remove facts do not create duplicate current membership;
- exact accepted Record replay is idempotent;
- a later `createdAt` wins regardless of journal enumeration order;
- an older historical fact may be retained without replacing the current view;
- distinct facts with the same `createdAt` fail closed;
- current membership survives restart and rebuild;
- accepted/pending-chain membership state is not presented as Block-confirmed;
- the Membership Protocol service follows Cordis lifecycle disposal.
