# Member Specification

- **Status:** Draft
- **Scope:** human Member identity capability and protocol composition
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

This Spec defines the minimum LabourChain capability needed to establish and recognize a human Member before Repo establishment and other human-facing protocol behavior.

## Core identity boundary

Member identity reuses Core `EntityPublicKey` semantics. The Member protocol does not mint a second Member-specific identifier and does not redefine Core key validation, Record identity, or signature rules.

```text
core.entity / EntityPublicKey
    ↓
member.identity
    ↓
Member
```

`Member` is the protocol/implementation term for a human participant. `Worker` may still be used conceptually for the labour subject, but runtime/process worker concepts must not be treated as human Members merely because they share that name.

## Member establishment Record

The minimum human-participant Protocol is `member.identity`.

A Member establishes that capability with one self-authored Record:

```text
Record.protocol
= member.identity@0.1.0

Record.createdBy
= Member EntityPublicKey

Record.data
= {}
```

The payload is intentionally empty. Repeating the same Entity identity in `Record.data` would create a second representation of information already supplied by `Record.createdBy`.

The exact `Record.protocolHash` comes from the resolved `member.identity` Protocol descriptor. A runtime must compare the Record against that exact resolved ProtocolHash; the artifact must not hard-code its own hash because ProtocolHash commits to the artifact itself.

The establishment Record must pass Core Record validation and signature verification before it can establish a Member. Repository code must consume Core capabilities rather than copying Entity, RecordId, or Ed25519 rules.

For the MVP, one Member identity has one accepted establishment Record. Replaying the same exact Record is idempotent; a different accepted establishment Record for the same Member identity is a conflict rather than an implicit replacement.

## Protocol composition

A Member is not a fixed object schema. Human-participant behavior is composed over the same Entity identity:

```text
Entity K
├─ member.identity
├─ member.profile
└─ other protocols...
```

`member.profile` may supply display name, avatar and other readable information, but profile data is not the Member identity and is not required to preserve identity stability.

## Repo composition

The same Entity identity/keypair may also compose Repo protocol capability:

```text
Entity K
├─ member.*
└─ repo.*
```

This same-identity Repo capability may be used to gather Assets and retain/index their related Records while they have not entered a collective Repo. It must not imply ownership, private-property status, exclusivity, transfer rights or economic entitlement.

A Member may also establish a distinct Repo identity. Repo establishment requires the establishing identity to satisfy the Member capability defined here.

## Runtime contract

The minimum runtime behavior is equivalent to:

```text
establishMember(establishmentRecord)
requireMember(entityIdentity)
```

`establishMember` succeeds only after the exact establishment Record is durably accepted by the configured Record ingress/journal. This is Repository/runtime acceptance and may still be pending-chain.

`requireMember` validates the queried identity with Core Entity semantics and succeeds only when an accepted `member.identity` establishment Record for that identity can be recovered from durable facts. Runtime indexes are derived and replaceable.

The Member Protocol implementation is composed through Cordis. It consumes Core Protocol capabilities and durable Record ingress through injected services; it does not introduce another runner, registry, or service container.

The runtime must receive the exact resolved `member.identity` ProtocolHash from the verified Protocol descriptor when mounting the implementation. The final generic mount/config shape is coordinated with Core runtime ABI review #31 and Protocol Dev SDK #23; Member semantics must not invent a second hashing or resolution scheme.

## Boundaries

This Spec does not define:

- Core Entity registration/admission;
- proof that a self-declared Member is biologically or legally human;
- profile UX or a complete `member.profile` schema;
- Repo membership mutation;
- private-property ownership;
- key generation or secret-key custody;
- generic ACL or social-network features.

## Acceptance tests

Tests must demonstrate that:

- a Member is anchored by a Core `EntityPublicKey`, not a second identity namespace;
- a valid self-authored `member.identity` Record can establish that Member;
- invalid Core identity, invalid Record/signature, wrong Protocol reference/hash, or non-empty establishment payload fail closed;
- a non-Member Entity identity cannot satisfy `requireMember`;
- the exact establishment Record is durably accepted before establishment succeeds;
- Member recognition can be rebuilt after restart from durable accepted Records;
- conflicting establishment Records for the same Member identity do not replace each other;
- profile data is not required to identify the Member itself;
- the same Entity identity can compose Member and Repo capabilities;
- same-identity Member/Repo composition does not create ownership/private-property semantics;
- Repo establishment can require and validate the establishing Member capability without duplicating Core identity rules.
