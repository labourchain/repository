# Repo Specification

- **Status:** Draft
- **Scope:** Repo establishment, stable identity, ownership, decision-operator trace and loading
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)
- **Member dependency:** [`member.md`](./member.md)

## Purpose

This Spec defines the stable Repository capability for establishing and loading a Repo.

A Repo is a LabourChain warehouse identity used to preserve Assets and participate in contribution confirmation. Repo behavior is composed by protocols over one Core Entity identity rather than fixed into a single Repo object schema.

## Core identity boundary

Repo identity reuses Core `EntityPublicKey` semantics. Repository does not introduce a second Repo identifier format, derive identity from a database row, or extend the Core `Entity` object with Repository fields.

```text
core.entity / EntityPublicKey
    ↓
Repo identity
    ├─ repo protocol
    ├─ asset-related protocols
    ├─ contribution protocols
    └─ other protocols...
```

Identity/key-pair generation and secret-key custody are Runtime/signer concerns. This capability validates and consumes a Repo identity; it does not define a second key-management system.

Core `Entity.introducedBy` is not the Repo ownership or operator-trace relation. It must not be interpreted as Repository ownership, organization membership, or authorization.

## Member dependency

A Repo establishment actor must satisfy the Member capability defined in [`member.md`](./member.md).

`Member` is the human-participant protocol/implementation term. `Worker` may still describe the labour subject conceptually, but Repo APIs must not accept a generic runtime/process worker merely because of naming overlap.

Repo establishment therefore depends on two distinct identities/capabilities:

```text
establishing Member
    = Entity identity satisfying Member protocol

Repo
    = Entity identity receiving Repo protocol semantics
```

For a collective Repo these identities may differ. For a Member-scoped Repo they may be the same Entity identity/keypair.

## Establishment Protocol and Record

Story #5 implements the minimum establishment semantics as:

```text
repo.establishment@0.1.0
```

The exact ProtocolHash is supplied by the Host from the verified descriptor when the Protocol implementation is mounted. `repo.establishment@0.1.0` is the signed human-readable reference; ProtocolHash remains the exact machine authority under Core v0.1.0.

Repo establishment is represented by one Record under these Protocol semantics.

The minimum establishment payload is equivalent to:

```ts
interface RepoEstablishment {
  repo: EntityPublicKey
}
```

The enclosing Record supplies the actor source:

```text
Record.createdBy
= establishing Member identity

Repo establishment protocol interpretation:
Record.createdBy
= initial Repo owner

Record.data.repo
= stable Repo EntityPublicKey
```

`Record.createdBy` does not universally mean owner. The Repo establishment Protocol assigns that domain meaning for this Record type.

The owner is not duplicated inside `Record.data`. The establishment Record is the domain source for the initial Repo ownership relationship. Repo ownership here means control / responsibility for the Repo identity; it does not imply ownership of Assets or labour results stored by the Repo.

This Spec does not define the generic historical Protocol loader/resolver. Story #5 only consumes the Host-mounted exact `repo.establishment@0.1.0` implementation and its verified ProtocolHash.

## Establishment

Any valid Member may establish a Repo.

Repo establishment must:

- require the establishing identity to satisfy the Member capability;
- accept or obtain a valid Core `EntityPublicKey` for the Repo;
- validate an establishment Record whose `createdBy` is the establishing Member and whose payload names the Repo identity;
- interpret that Member as the initial Repo owner under Repo establishment Protocol semantics;
- durably accept the establishment Record into the configured Record ingress/journal before reporting the Repo established;
- make the established Repo loadable again by its stable identity after restart;
- fail on a conflicting already-accepted or already-chain-confirmed establishment of the same Repo identity rather than silently replacing its owner;
- persist only the Runtime index/state required for efficient lookup in addition to the durable establishment Record itself.

Exact TypeScript operation names are not fixed. Behavior is equivalent to:

```text
establishRepo(establishmentRecord)
loadRepo(repoIdentity)
```

A higher-level caller/signer may construct and sign the establishment Record from a Member identity and Repo identity. Signing UX, secret-key custody and key generation are outside this capability.

## Same-identity Member Repo

A Member may compose Repo capability on the same Core Entity identity/keypair:

```text
Entity K
├─ member.*
└─ repo.*
```

This is protocol composition, not a nested `PersonalRepo` entity and not a second identity.

Such a Repo may temporarily gather Records/Assets that have not entered a collective Repo. This association does not itself define ownership, private-property status, exclusivity, transfer rights or economic entitlement.

LabourFlow may build a personal product experience on top of this generic composition, but the underlying Repo semantics remain the same.

## Ownership and operator trace

The initial Repo owner is the Member recorded as `createdBy` on the Repo establishment Record under the establishment Protocol semantics.

Only this initial ownership source is defined in the MVP. There is no provider-owned mutable owner row that can override the establishment Record. Owner transfer, multi-owner control, organization authorization and governance are deferred until an organization/governance requirement exists.

Repo-authored decision facts are a separate concern. When an applicable Protocol represents a Repo decision, the Record is signed by the Repo identity and its signed Protocol data must identify the actual `operator: EntityPublicKey`. The operator field records who performed that specific Repo action; it does not itself prove an organization role, delegation chain or political authority.

Repository therefore preserves the distinction:

```text
owner
= establishment-derived control / responsibility source for the Repo identity

operator
= actor declared inside one Repo-signed decision fact
```

Technology records these actions and signatures. It does not attempt to derive complete organization governance from possession of the Repo private key.

## Record status boundary

The same establishment Record can have different runtime/chain statuses without changing its identity or ownership meaning:

```text
accepted / pending-chain
    -> exact Record is durably retained by Record ingress/journal
    -> Repo is established for Repository product behavior

block-confirmed
    -> Record is included in an accepted Block
    -> Repo establishment has chain confirmation
```

Repository establishment does not wait for Block packing. An accepted/pending establishment must not be presented as already block-confirmed.

## Runtime dependencies

Repository requires a durable Record ingress/journal capable of retaining accepted establishment Records across restart. The establishment Protocol runtime also depends on the mounted Core v0.1.0 `core.entity@0.1.0` / `core.record@0.1.0` services and `member.identity@0.1.0` capability rather than copying those algorithms or identities. At minimum, the establishment flow needs behavior equivalent to:

```text
durably accept an exact signed Record, idempotently by RecordId
read an accepted Record by RecordId
replay/query accepted Records sufficiently to repair the Repo lookup index
```

Chain confirmation status, when available, comes from a separate chain-state/Block-confirmation capability equivalent to:

```text
lookup whether RecordId is included in an accepted Block
return the relevant Block reference / confirmation position as supported
```

This Spec does not prescribe the concrete service API, database, transport, or package that supplies either capability.

Repository must not satisfy these dependencies by introducing a domain-owned canonical `repo.records[]`, a second blockchain, or by claiming the durable pending journal itself is Block confirmation.

## Persistence and Runtime index

Repo identity and ownership relationship must survive ordinary application restart in a usable deployment because the exact establishment Record is durably retained.

Runtime may persist a replaceable lookup index equivalent to:

```text
Repo EntityPublicKey -> establishment RecordId
```

The index may additionally cache a derived Repo view or chain-confirmation status for efficient loading, but those derived values must be repairable/rebuildable from the durable journal and, when available, chain state.

Provider-native paths, database IDs, row keys or collection identifiers must not become the Repo identity or owner source.

An in-memory implementation may be used for isolated tests but does not satisfy the usable-deployment persistence contract.

## Conflict semantics

For the MVP, one Repo identity has one accepted establishment Record.

A second attempt to establish the same Repo identity must not silently create a second owner or replace the first accepted establishment. Conflict checks must consider durable accepted/pending state and any available block-confirmed state; a stale or missing lookup index cannot authorize a duplicate establishment.

Cross-node concurrent establishment, fork/reorg arbitration and generic Entity admission are outside this Story unless the later chain/network model introduces explicit requirements for them.

## Boundaries

This Spec does not define:

- generic Entity registration/admission;
- Repo key generation or secret-key custody;
- `member.profile` schema/UX;
- Asset/labour private-property semantics;
- owner transfer / multi-owner governance;
- Block packing or chain selection;
- chain-level Repo membership / organization governance;
- Asset contribution;
- Asset storage format;
- Project or Board organization;
- HTTP routes or UI;
- a Repository-domain canonical Record store or chain database.

## Failure model

Consumers must be able to distinguish at least:

- Repo not found;
- Repo already established / identity conflict;
- establishing identity is not a valid Member;
- invalid Repo or Member identity according to Core identity representation;
- invalid or rejected establishment Record;
- required Member or Repo Protocol semantics unavailable;
- durable Record ingress/journal unavailable or failed;
- chain-confirmation status unavailable when explicitly requested;
- Runtime lookup-index/provider failure.

## Acceptance tests

Tests must demonstrate that:

- a valid Member can establish a Repo whose identity is a Core `EntityPublicKey`;
- a generic/non-Member Entity identity cannot establish a Repo through the human Member path;
- the establishment Record's `createdBy` is interpreted by the Repo establishment Protocol as the initial Repo owner;
- the exact establishment Record is durably accepted before establishment succeeds;
- the same Repo can be loaded again by stable identity after restart;
- Repo identity and owner can be recovered from the durable Record journal even if the lookup index is rebuilt;
- a conflicting second establishment of the same Repo identity is rejected;
- stale/missing Runtime index state cannot replace the establishment Record as the domain source;
- provider-native storage identifiers do not replace Repo identity;
- `Entity.introducedBy` is not used as the ownership or operator-trace relation;
- the same Entity identity can compose both Member and Repo protocols without creating a second keypair;
- same-identity Member/Repo composition does not imply Asset/labour private-property semantics;
- accepted/pending-chain and block-confirmed status are not conflated.
