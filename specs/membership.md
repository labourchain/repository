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

Membership only states whether a Member is accepted by a Repo at a given effective time.

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

The enclosing Record supplies both authority and effective time:

```text
Record.createdBy
= Repo EntityPublicKey

Record.signature
= signature by the Repo identity

Record.createdAt
= membership effective time attested by that Repo
```

The Membership Protocol requires `Record.createdBy == Record.data.repo`.

How an operator causes the Repo key to sign such a Record is signer/key-custody runtime behavior and remains outside Story #6.

## Temporal semantics

Membership facts do not contain `previous`, `previousMutation` or another predecessor pointer.

For one `Repo × Member` relation, the current effective membership is derived from the latest valid Repo-signed membership fact by `Record.createdAt`.

`repo.membership@0.1.0` therefore assigns domain meaning to `createdAt` that Core itself deliberately does not assign:

```text
Core Record.createdAt
= signed string, no generic ordering semantics

repo.membership interpretation
= Repo-attested membership effective time
```

The Membership Protocol requires `createdAt` to identify a valid time.

If two distinct membership facts for the same `Repo × Member` relation have the same effective time, the history is ambiguous and rebuild fails closed.

Repeated `add` or repeated `remove` facts are allowed as redundant Repo statements. They do not create duplicate effective membership because only the latest fact determines the current set.

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
6. interprets `Record.createdAt` as the Repo-attested effective time;
7. durably accepts the exact Record through `recordJournal` before reporting success;
8. derives current membership from the latest effective fact.

Exact replay of an already accepted Record is idempotent.

A historical fact whose effective time is older than the current fact may still be durably retained without replacing the current effective view.

`MembershipView` is equivalent to:

```ts
interface MembershipView {
  repo: EntityPublicKey
  member: EntityPublicKey
  active: boolean
  latestRecordId: RecordId | null
  effectiveAt: string | null
}
```

`listMembers(repo)` exposes each currently active Member once.

## Persistence and rebuild

The exact accepted membership Records are the durable source.

Runtime may maintain a replaceable projection equivalent to:

```text
Repo × Member
-> latest effective membership Record
-> active / inactive
```

Current read operations rebuild from durable facts before answering. This intentionally prefers correctness over a premature cache-invalidation/index-generation mechanism.

Rebuild must not depend on:

- journal enumeration order;
- filesystem filename order;
- RecordId lexical order;
- process arrival order.

It derives the current view from Repo-signed membership effective time.

Accepted membership facts are Repository accepted / pending-chain until actual chain-state evidence reports Block inclusion. Local journal persistence must not be presented as Block confirmation.

## Contribution eligibility

A Member must have an effective active Repo membership before a contribution can be accepted by that Repo.

The precise relationship between membership effective time and a Labour/contribution Record belongs to the later contribution/labour protocols. Story #6 only exposes the membership facts and current effective view.

Contribution execution remains outside Story #6.

## Failure model

Consumers must be able to distinguish at least:

- Repo unavailable / not established;
- membership Record not authored by the Repo identity;
- target identity is not a valid Member;
- invalid Core Record, Repo identity or Member identity;
- wrong membership Protocol reference/hash;
- invalid membership effective time;
- ambiguous distinct facts at the same effective time;
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
- a Repository-domain chain database.

## Acceptance tests

Tests must demonstrate that:

- a Repo-signed membership add makes a valid Member active;
- a later Repo-signed remove makes that Member inactive;
- membership can be checked and active Members listed;
- a non-Repo signer cannot author membership for that Repo;
- a non-Member Entity cannot be silently treated as a Repo Member;
- repeated add/remove facts do not create duplicate effective membership;
- exact accepted Record replay is idempotent;
- a later effective fact wins regardless of journal enumeration order;
- an older historical fact may be retained without replacing the current view;
- distinct facts with the same effective time fail closed;
- current membership survives restart and rebuild;
- accepted/pending-chain membership state is not presented as Block-confirmed;
- the Membership Protocol service follows Cordis lifecycle disposal.
