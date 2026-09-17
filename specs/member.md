# Member Specification

- **Status:** Draft
- **Scope:** human Member identity capability and protocol composition
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

This Spec defines the minimum LabourChain capability needed to recognize a human Member before Repo establishment and other human-facing protocol behavior.

## Core identity boundary

Member identity reuses Core `EntityPublicKey` semantics. The Member protocol does not mint a second Member-specific identifier and does not redefine Core key validation or signature rules.

```text
core.entity / EntityPublicKey
    ↓
Member
```

`Member` is the protocol/implementation term for a human participant. `Worker` may still be used conceptually for the labour subject, but runtime/process worker concepts must not be treated as human Members merely because they share that name.

## Protocol composition

A Member is not a fixed object schema. Human-participant behavior is composed over the same Entity identity:

```text
Entity K
├─ member protocol
├─ member.profile
└─ other protocols...
```

The minimum Member capability only establishes/recognizes participation as a human Member. Human-readable profile data is separate.

`member.profile` may supply display name, avatar and other readable information, but profile data is not the Member identity and is not required to preserve identity stability.

## Repo composition

The same Entity identity/keypair may also compose Repo protocol capability:

```text
Entity K
├─ member.*
└─ repo.*
```

This same-identity Repo capability may be used to gather Records/Assets that have not entered a collective Repo. It must not imply ownership, private-property status, exclusivity, transfer rights or economic entitlement.

A Member may also establish a distinct Repo identity. Repo establishment requires the establishing identity to satisfy the Member capability defined here.

## Runtime contract

Exact TypeScript names are not fixed. Repository code requires behavior equivalent to:

```text
requireMember(entityIdentity)
```

The implementation must fail closed when the Member protocol required to interpret that identity is unavailable or the identity does not satisfy Member semantics.

This check must reuse Core identity semantics rather than copying key validation into Repository code.

## Boundaries

This Spec does not define:

- Core Entity registration/admission;
- profile UX or a complete `member.profile` schema;
- Repo membership mutation;
- private-property ownership;
- key generation or secret-key custody;
- generic ACL or social-network features.

## Acceptance tests

Tests must demonstrate that:

- a Member is anchored by a Core `EntityPublicKey`, not a second identity namespace;
- a non-Member Entity identity cannot satisfy a capability that requires a human Member;
- profile data is not required to identify the Member itself;
- the same Entity identity can compose Member and Repo capabilities;
- same-identity Member/Repo composition does not create ownership/private-property semantics;
- Repo establishment can require and validate the establishing Member capability without duplicating Core identity rules.
