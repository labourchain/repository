# Repo Specification

- **Status:** Draft
- **Scope:** Repo establishment, stable identity, operator relationship and loading
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

This Spec defines the stable Repository capability for establishing and loading a Repo.

A Repo is a LabourChain warehouse identity used to preserve Assets and participate in contribution confirmation. This Spec does not define membership behavior beyond the initial operator relationship; membership is covered by [`membership.md`](./membership.md).

## Core identity boundary

Repo identity reuses Core `EntityPublicKey` semantics. Repository does not introduce a second Repo identifier format, derive identity from a database row, or extend the Core `Entity` object with Repository fields.

A Repo is a higher-level domain fact that references an `EntityPublicKey` as its stable identity.

```text
EntityPublicKey
    ↓
Repo identity
```

Identity/key-pair generation and secret-key custody are Runtime/signer concerns. This capability validates and consumes a Repo identity; it does not define a second key-management system.

Core `Entity.introducedBy` is not the Repo operator relation. It must not be interpreted as ownership, membership, or Repository authorization.

## Establishment Record

Repo establishment is represented by one Record under the applicable Repo establishment Protocol/Plugin semantics.

The minimum establishment payload is equivalent to:

```ts
interface RepoEstablishment {
  repo: EntityPublicKey
}
```

The enclosing Record supplies the actor source:

```text
Record.createdBy
= establishing Worker
= initial MVP operator

Record.data.repo
= stable Repo EntityPublicKey
```

The operator is therefore not duplicated inside `Record.data`. The establishment Record is the domain source for both the Repo identity and its initial operator relationship.

The exact Protocol/Plugin package name and historical-resolution mechanism are not fixed here; they must follow the repository-wide Protocol-resolution decision rather than creating a one-off naming model in this Spec.

## Establishment

Any Worker may establish a Repo.

Repo establishment must:

- accept or obtain a valid Core `EntityPublicKey` for the Repo;
- validate an establishment Record whose `createdBy` is the establishing Worker and whose payload names the Repo identity;
- make exactly that Worker the single MVP operator;
- durably accept the establishment Record into the configured Record ingress/journal before reporting the Repo established;
- make the established Repo loadable again by its stable identity after restart;
- fail on a conflicting already-accepted or already-chain-confirmed establishment of the same Repo identity rather than silently replacing its operator;
- persist only the Runtime index/state required for efficient lookup in addition to the durable establishment Record itself.

Exact TypeScript operation names are not fixed. Behavior is equivalent to:

```text
establishRepo(establishmentRecord)
loadRepo(repoIdentity)
```

A higher-level caller/signer may construct and sign the establishment Record from a Worker identity and Repo identity. Signing UX, secret-key custody and key generation are outside this capability.

## Operator

The operator is the Worker recorded as `createdBy` on the Repo establishment Record.

Only this initial operator relationship exists in the MVP. There is no separate mutable `operator` field or provider-owned operator row that can override the establishment Record.

This Spec does not introduce owner, admin, maintainer, editor, viewer or other role hierarchies.

Changing operator semantics or transfer behavior is outside the MVP unless later added to Requirements.

## Record status boundary

The same establishment Record can have different runtime/chain statuses without changing its identity or operator meaning:

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

Repository requires a durable Record ingress/journal capable of retaining accepted establishment Records across restart. At minimum, the establishment flow needs behavior equivalent to:

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

Repo identity and operator relationship must survive ordinary application restart in a usable deployment because the exact establishment Record is durably retained.

Runtime may persist a replaceable lookup index equivalent to:

```text
Repo EntityPublicKey -> establishment RecordId
```

The index may additionally cache a derived Repo view or chain-confirmation status for efficient loading, but those derived values must be repairable/rebuildable from the durable journal and, when available, chain state.

Provider-native paths, database IDs, row keys or collection identifiers must not become the Repo identity or operator source.

An in-memory implementation may be used for isolated tests but does not satisfy the usable-deployment persistence contract.

## Conflict semantics

For the MVP, one Repo identity has one accepted establishment Record.

A second attempt to establish the same Repo identity must not silently create a second operator or replace the first accepted establishment. Conflict checks must consider durable accepted/pending state and any available block-confirmed state; a stale or missing lookup index cannot authorize a duplicate establishment.

Cross-node concurrent establishment, fork/reorg arbitration and generic Entity admission are outside this Story unless the later chain/network model introduces explicit requirements for them.

## Boundaries

This Spec does not define:

- generic Entity registration/admission;
- Repo key generation or secret-key custody;
- operator transfer;
- Block packing or chain selection;
- Personal Repo creation or lifecycle;
- member add/remove behavior;
- Asset contribution;
- Asset storage format;
- Project or Board organization;
- HTTP routes or UI;
- a Repository-domain canonical Record store or chain database.

Personal Repo belongs to LabourFlow and may reuse generic LabourChain protocols without becoming a special Repository mode.

## Failure model

Consumers must be able to distinguish at least:

- Repo not found;
- Repo already established / identity conflict;
- invalid Repo or Worker identity according to Core identity representation;
- invalid or rejected establishment Record;
- durable Record ingress/journal unavailable or failed;
- chain-confirmation status unavailable when explicitly requested;
- Runtime lookup-index/provider failure.

## Acceptance tests

Tests must demonstrate that:

- a valid establishment Record can establish a Repo whose identity is a Core `EntityPublicKey`;
- the establishment Record's `createdBy` is the single MVP operator;
- the exact establishment Record is durably accepted before establishment succeeds;
- the same Repo can be loaded again by stable identity after restart;
- Repo identity and operator can be recovered from the durable Record journal even if the lookup index is rebuilt;
- a conflicting second establishment of the same Repo identity is rejected;
- stale/missing Runtime index state cannot replace the establishment Record as the domain source;
- provider-native storage identifiers do not replace Repo identity;
- `Entity.introducedBy` is not used as the operator relation;
- accepted/pending-chain and block-confirmed status are not conflated;
- Personal Repo behavior and generic Entity admission are not introduced by this capability.
