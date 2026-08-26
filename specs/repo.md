# Repo Specification

- **Status:** Draft
- **Scope:** Repo establishment, stable identity, operator relationship and loading
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

This Spec defines the stable Repository capability for establishing and loading a Repo.

A Repo is a LabourChain warehouse identity used to preserve Assets and participate in contribution confirmation. This Spec does not define membership behavior beyond the initial operator relationship; membership is covered by [`membership.md`](./membership.md).

## Establishment

Any Worker may establish a Repo.

Repo establishment must:

- create or obtain a stable LabourChain Repo identity;
- associate exactly one MVP operator with the Repo;
- use LabourChain identity semantics rather than a Repository-specific identity namespace;
- make the established Repo loadable again by its stable identity;
- persist the state required for ordinary restart recovery in a usable deployment.

Exact TypeScript operation names are not fixed. Behavior is equivalent to:

```text
establishRepo(worker)
loadRepo(repoIdentity)
```

## Operator

The operator is the Worker allowed to manage Repo membership in the MVP.

This Spec does not introduce owner, admin, maintainer, editor, viewer or other role hierarchies.

Changing operator semantics or transfer behavior is outside the MVP unless later added to Requirements.

## Persistence

Repo identity and operator relationship must survive ordinary application restart in a usable deployment.

Provider-native paths, database IDs, row keys or collection identifiers must not become the canonical Repo identity.

An in-memory implementation may be used for isolated tests but does not satisfy the usable-deployment persistence contract.

## Boundaries

This Spec does not define:

- Personal Repo creation or lifecycle;
- member add/remove behavior;
- Asset contribution;
- Asset storage format;
- Project or Board organization;
- HTTP routes or UI.

Personal Repo belongs to LabourFlow and may reuse generic LabourChain protocols without becoming a special Repository mode.

## Failure model

Consumers must be able to distinguish at least:

- Repo not found;
- Repo establishment failure;
- identity conflict or invalid identity according to applicable Core semantics;
- persistence failure;
- Repo state unavailable after a provider failure.

## Acceptance tests

Tests must demonstrate that:

- a Worker can establish a Repo;
- the Repo receives a stable LabourChain identity;
- the establishing Worker is recorded as operator;
- the same Repo can be loaded again by identity;
- Repo identity and operator survive restart with a persistent test provider;
- provider-native storage identifiers do not replace Repo identity;
- Personal Repo behavior is not introduced by this capability.
