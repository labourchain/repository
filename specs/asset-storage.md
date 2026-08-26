# Asset Storage Specification

- **Status:** Draft
- **Scope:** durable preservation and retrieval of accepted Repo Assets
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Repository preserves Assets accepted through committed Repo contributions and makes them retrievable by stable LabourChain identity or reference.

This Spec defines Repository storage behavior, not the canonical Asset protocol schema.

## Storage contract

A usable deployment must durably preserve the Asset data required for later retrieval.

Behavior is equivalent to:

```text
storeAcceptedAsset(repo, asset)
getAsset(repo, assetIdentityOrReference)
listAssets(repo)
```

Exact API names and provider interfaces remain implementation choices.

Only Assets belonging to accepted committed contributions may appear in the accepted Asset view.

## Identity

Asset lookup must use stable LabourChain identity or reference semantics.

Provider-native paths, filenames, row IDs, database keys or collection names must not replace canonical Asset identity.

Storage must preserve the accepted Protocol meaning of the Asset and must not silently rewrite, normalize, classify or enrich canonical Asset content for provider convenience.

## Durability

Accepted Assets must remain retrievable after ordinary application restart.

An in-memory provider may be used for isolated tests but does not satisfy the usable-deployment durability contract.

Storage may be implemented by filesystem, database, object storage or another Runtime provider. This Spec does not select a concrete technology.

## Relationship to contribution

Asset storage participates in the acceptance contract defined in [`contribution.md`](./contribution.md).

A contribution must not be reported as accepted until its committed Asset can be durably retrieved.

If Core commit has already succeeded but Asset finalization is interrupted, recovery must be able to converge to a retrievable accepted Asset rather than treating the canonical commit as nonexistent.

## Listing and lookup

Repository must support:

- explicit successful retrieval of an existing accepted Asset;
- explicit not-found behavior for a missing Asset;
- simple listing of accepted Assets for a Repo.

Advanced search, pagination, full-text indexing and large-scale query infrastructure are outside the MVP.

Internal indexes may be used, but they are Runtime data and do not become canonical facts.

## Boundaries

This Spec does not define:

- Asset protocol fields;
- Asset version or correction semantics;
- Record storage;
- contribution-history projection;
- Project organization;
- Personal Repo behavior;
- provider-specific schema or filesystem layout.

## Failure model

Consumers must be able to distinguish at least:

- requested Asset not found;
- accepted Asset persistence failure;
- accepted Asset retrieval failure;
- identity conflict according to applicable Protocol semantics;
- provider unavailable or corrupted state detected during retrieval.

## Acceptance tests

Tests must demonstrate that:

- an accepted Asset can be retrieved by stable LabourChain identity/reference;
- a missing Asset returns explicit not-found behavior;
- accepted Assets can be listed for a Repo;
- accepted Assets survive restart with a persistent test provider;
- provider-native identifiers do not replace LabourChain Asset identity;
- failed or uncommitted contributions do not appear in the accepted Asset view;
- storage does not silently alter accepted Asset semantics;
- a post-commit interruption can recover to a retrievable Asset when the contribution recovery path is exercised.
