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

## Canonical establishment fact

Repo establishment is represented by one canonical Record under the applicable Repo establishment Protocol/Plugin semantics.

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

The operator is therefore not duplicated inside `Record.data`. The establishment Record is the canonical source for both the Repo identity and its initial operator relationship.

The exact Protocol/Plugin package name, hash field migration, and runtime loading mechanism are not fixed here; they must follow the repository-wide historical Protocol-resolution decision rather than creating a one-off naming model in this Spec.

## Establishment

Any Worker may establish a Repo.

Repo establishment must:

- accept or obtain a valid Core `EntityPublicKey` for the Repo;
- create the Repo establishment fact with the establishing Worker as `Record.createdBy`;
- make exactly that Worker the single MVP operator;
- commit the establishment fact through the configured canonical chain/fact capability;
- make the established Repo loadable again by its stable identity;
- fail on a conflicting already-established Repo identity rather than silently replacing its canonical establishment;
- persist only the Runtime index/state required for ordinary restart lookup.

Exact TypeScript operation names are not fixed. Behavior is equivalent to:

```text
establishRepo(worker, repoIdentity)
loadRepo(repoIdentity)
```

A higher-level signer/identity provider may generate the Repo key pair before `establishRepo`; that generation mechanism is outside this capability.

## Operator

The operator is the Worker recorded as `createdBy` on the canonical Repo establishment Record.

Only this initial operator relationship exists in the MVP. There is no separate mutable `operator` field or provider-owned operator row that can override the canonical establishment fact.

This Spec does not introduce owner, admin, maintainer, editor, viewer or other role hierarchies.

Changing operator semantics or transfer behavior is outside the MVP unless later added to Requirements.

## Canonical fact access boundary

Core currently defines deterministic Plugin, Entity, Record, and Block primitives; canonical Record persistence/query and chain-state access are Runtime/composition concerns rather than `core.entity` behavior.

Repository therefore requires a configured canonical fact capability that can, at minimum, support the establishment flow's equivalent of:

```text
commit canonical Repo establishment Record
resolve/query canonical Repo establishment by stable identity or canonical Record reference
```

This Spec does not prescribe the concrete service API, database, transport, or package that supplies that capability.

Repository must not satisfy this dependency by introducing a canonical `repo.records[]`, generic `storeRecord()`, or a second chain database owned by the Repo domain package.

If the canonical fact capability is unavailable, establishment/loading must fail explicitly rather than treating local Runtime state as canonical truth.

## Persistence and Runtime index

Repo identity and operator relationship must survive ordinary application restart in a usable deployment because they are recoverable from canonical establishment facts.

Runtime may persist a replaceable lookup index equivalent to:

```text
Repo EntityPublicKey -> canonical establishment Record reference
```

The index may additionally cache a derived Repo view for efficient loading, but it remains non-canonical and must be repairable/rebuildable from canonical facts when the configured chain/fact capability supports the required query.

Provider-native paths, database IDs, row keys or collection identifiers must not become the canonical Repo identity or operator source.

An in-memory implementation may be used for isolated tests but does not satisfy the usable-deployment persistence contract.

## Conflict semantics

For the MVP, one Repo identity has one canonical establishment fact.

A second attempt to establish the same Repo identity must not silently create a second operator or replace the first canonical establishment. The configured canonical fact/chain state determines whether the identity is already established; a stale or missing Runtime index cannot authorize a duplicate establishment.

This rule is Repo-specific. It does not define generic Entity registration/admission policy for all LabourChain identities; that remains a separate design question.

## Boundaries

This Spec does not define:

- generic Entity registration/admission;
- Repo key generation or secret-key custody;
- operator transfer;
- Personal Repo creation or lifecycle;
- member add/remove behavior;
- Asset contribution;
- Asset storage format;
- Project or Board organization;
- HTTP routes or UI;
- a canonical Record store or chain database owned by Repository.

Personal Repo belongs to LabourFlow and may reuse generic LabourChain protocols without becoming a special Repository mode.

## Failure model

Consumers must be able to distinguish at least:

- Repo not found;
- Repo already established / identity conflict;
- invalid Repo or Worker identity according to Core identity representation;
- invalid or rejected establishment fact;
- canonical fact capability unavailable;
- canonical commit/query failure;
- Runtime index/provider failure.

## Acceptance tests

Tests must demonstrate that:

- a Worker can establish a Repo using a valid `EntityPublicKey` identity;
- the canonical establishment Record uses that Worker as `createdBy`;
- the establishing Worker is therefore the single MVP operator;
- the same Repo can be loaded again by stable identity;
- Repo identity and operator can be recovered after restart from canonical fact state plus replaceable Runtime indexing;
- a conflicting second establishment of the same Repo identity is rejected;
- stale/missing Runtime index state cannot replace canonical establishment truth;
- provider-native storage identifiers do not replace Repo identity;
- `Entity.introducedBy` is not used as the operator relation;
- Personal Repo behavior and generic Entity admission are not introduced by this capability.
