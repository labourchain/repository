# Repository MVP Specification

- **Status:** Draft
- **Target:** first usable Repository service
- **Requirements source:** [`../docs/requirements.md`](../docs/requirements.md)

This Spec is an engineering projection of `docs/requirements.md`. It defines the service boundaries and contracts needed to implement the current MVP without changing the product model.

## Purpose

The Repository plugin provides a Cordis capability for one active Repo. It manages Repo identity, operator and worker relationships, Asset contribution, Repo-side confirmation of related labour, Asset storage and retrieval, and a contribution-history projection.

Record is not canonical Repository storage. It remains an on-chain labour fact. Repository may cache Records related to its own contributions so normal consumers do not need to rebuild the same history for every request.

The service path is:

```text
Repo identity and membership
  -> Worker produces Record + Asset
  -> Asset contribution
  -> membership check
  -> protocol validation
  -> Asset preservation + Repo confirmation
  -> contribution-history projection
```

## Terminology

### Repo

The Repository workspace represented by the plugin instance. Its durable state includes identity, operator and worker relationships, and accepted Assets.

### Operator

The worker identity allowed to manage membership for the Repo. The MVP does not introduce additional Repository roles.

### Worker / Member

Worker is the LabourChain labour subject. A member is a worker currently allowed to contribute Assets to this Repo.

### Record

An on-chain LabourChain labour fact produced by a worker. A Record can accompany an Asset contribution and receive Repo-side confirmation, but Repository does not own or canonically store it.

### Asset

A LabourChain labour output represented according to its applicable protocol.

### Contribution

The act of a member submitting an Asset to a Repo together with the related worker-produced Record.

### Record projection

A rebuildable local view of Records related to the Repo. It exists for normal query and analysis work and is not the canonical source of Record truth.

## Engineering boundaries

Repository owns the active Repo, operator and worker membership, Asset contribution orchestration, Asset persistence, Repo-side confirmation orchestration, Asset retrieval, and the local contribution-history projection.

Adjacent responsibilities remain outside this package:

- RawEntry recognition and Record drafting belong to LabourFlow or another recognition workflow;
- Project organization, planning, review and analysis remain outside Repository;
- Board presentation remains outside Repository;
- Core owns protocol schemas, hashing, identity, signatures and confirmation semantics;
- concrete database, filesystem, cache and external API integrations remain provider concerns;
- runtime data does not become an Asset merely because it can be stored;
- blockchain packing, peer synchronization, settlement, public/common usage accounting and private-proof mechanisms are not part of this MVP service.

## Invariants

### Membership precedes contribution

A contributor must be a Repo member before an Asset contribution can be accepted. Membership failure occurs before contribution validation, Asset acceptance or Repo confirmation.

Membership does not control whether the worker may produce a Record or Asset outside the Repo.

### Repository accepts Assets, not canonical Records

There is no independent Repository Record-acceptance path. A Record can accompany an Asset contribution and can be cached as part of the Repo contribution-history projection, but it remains an on-chain fact.

The public service and storage provider must not expose a canonical `storeRecord` model for Repository content.

### Validation precedes accepted contribution

The Asset, related Record and required contribution relationships must satisfy their applicable LabourChain protocol rules before the contribution is reported as accepted.

Repository delegates protocol semantics to Core. It does not copy Core schemas or reimplement confirmation rules.

### Asset acceptance and Repo confirmation form one product outcome

A contribution is accepted only when Repository can preserve the Asset and complete the required Repo-side confirmation of the related labour.

The implementation may use staging, rollback or provider transactions to satisfy this invariant. Partial technical state must not be exposed as an accepted contribution.

### Canonical and derived data stay separate

Repo identity, operator and worker relationships, and accepted Assets are canonical Repository state.

Contribution-history Record data is a derived projection. It may be persisted for performance, but it must remain distinguishable from canonical Record storage and may be rebuilt from the chain when the surrounding runtime provides that capability.

### Durable Repository state survives normal restart

Repository-facing behavior must allow a persistent provider to preserve Repo identity, membership and accepted Assets across ordinary application restart. Process memory is not the persistence contract for a usable deployment.

### Project semantics remain external

Asset retrieval and contribution-history access must not require Project or Board concepts.

### Cordis owns plugin resources

Package import performs no external work. Resources owned by the plugin are acquired and disposed through Cordis lifecycle ownership so reload and repeated activation do not duplicate them.

## Service contract

Exact TypeScript names may change while the Spec is Draft. The behavior should remain equivalent to the contracts below.

### Repository establishment and loading

The service can establish a new Repo and later load the same Repo by its stable LabourChain identity.

Establishment records the operator relationship. Repository must reuse LabourChain identity semantics rather than inventing a second Repository-specific identity system.

For the MVP, one active Repo per Repository plugin instance is sufficient.

A Personal Repo uses the same Repository service. The surrounding product can establish it as a worker's default private Asset repository without requiring a separate storage model or a personal `records` collection.

### Worker membership

The service provides behavior equivalent to:

```text
addWorker(operator, worker)
removeWorker(operator, worker)
hasWorker(worker)
listWorkers()
```

Only the Repo operator can add or remove workers. Membership is set-like for the MVP: adding an existing member does not create a duplicate, and removing a missing member does not create new state.

### Asset contribution

The service provides behavior equivalent to:

```text
contributeAsset(contributor, asset, record)
```

A successful contribution follows this logical order:

1. confirm contributor membership;
2. validate the Asset, Record and required contribution relationships through the Core boundary;
3. preserve the Asset as Repo state;
4. complete Repo-side confirmation of the related labour through the Core boundary;
5. update the local contribution-history projection;
6. return the stable Asset identity or reference.

Steps 3 through 5 may be implemented with staging or another atomicity mechanism. Failure must not be reported as an accepted contribution.

Repository does not enrich, classify, summarize or reinterpret the Record or Asset during this flow.

### Asset retrieval

The service supports retrieving an accepted Asset by stable identity or reference, explicit not-found behavior, and simple listing of accepted Assets.

The returned Asset preserves the accepted protocol meaning. Provider-native paths, collection names, keys or row identifiers do not become Repository identity.

### Contribution history

The service exposes the Records related to accepted contributions for the active Repo. This behavior is semantically equivalent to a `listContributionRecords()` view rather than a general `listRecords()` Repository store.

A successful contribution should make its related Record available to this view. The local projection may be persisted so routine analysis does not require a full chain scan. It remains rebuildable derived data.

The first Repository code slice does not need to implement a general chain indexer. Rebuilding projections from the complete chain can be connected when the corresponding chain query service is available.

## Core boundary

Repository consumes Core capabilities for protocol validation, identity semantics and Repo-side confirmation.

Until `labourchain/core-protocols` exposes stable runtime APIs for all required operations, Repository may use narrow internal adapters. These adapters must stay outside the public service contract, fail closed when a required Core capability is unavailable, and avoid duplicating Core protocol definitions.

## Storage provider contract

Repository uses a provider boundary so runtime persistence can change without changing Repository product behavior.

The provider needs capabilities for:

- loading and saving Repo metadata and operator identity;
- loading, saving and removing worker membership;
- storing, retrieving and listing accepted Assets;
- caching and listing contribution-related Record projections.

The Record projection API must be named and documented as cache or projection behavior. It must not imply that Repository is the canonical Record store.

Provider implementations must preserve stable Asset identity, surface storage failures, and keep failed contributions from appearing as accepted state.

### In-memory provider

A minimal in-memory provider may be included for contract tests and local engineering. It is not the persistence solution for a usable small-team deployment.

### Persistent providers

A usable deployment requires a persistent Runtime provider for Repo metadata, membership and Assets. Database, filesystem and other persistence choices belong to the Runtime layer.

Persisting the contribution-history projection is allowed and useful for normal operation, but that cache remains derived from on-chain Records.

## Cordis integration

Repository is exposed as a LabourChain-specific Cordis service, for example `labourchainRepository`.

The implementation declares its dependencies, avoids process-global mutable Repository state, uses Cordis lifecycle ownership for resources, supports clean repeated activation and deactivation, and keeps consumers independent of the concrete storage provider.

## Error model

Consumers need programmatically distinguishable failures for cases that change behavior, including:

- Repository unavailable or not initialized;
- actor is not the Repo operator for membership changes;
- contributor is not a Repo member;
- Core rejects the Asset, Record or contribution relationship;
- a required Core validation or confirmation capability is unavailable;
- Asset identity conflicts with existing Repo state when replacement is not allowed;
- storage or Repo confirmation fails;
- requested Asset is not present.

Errors should provide enough context for debugging without embedding full Asset contents or other large or sensitive payloads by default.

## Acceptance tests

Tests should protect the product contracts and Cordis lifecycle rather than coverage numbers. The first service implementation should demonstrate that:

- a Repo can be established and loaded with a stable identity;
- the operator can add, check, list and remove workers;
- a non-operator cannot change membership;
- a member can contribute a valid Asset with its related Record;
- a non-member contribution is rejected before accepted Repo state or confirmation appears;
- invalid Asset, Record or contribution relationships are rejected;
- an accepted Asset can be retrieved without semantic rewrite;
- a successful contribution appears in the Repo contribution-history view;
- contribution history uses a Record projection rather than canonical Repository Record storage;
- provider or confirmation failure is surfaced instead of being reported as accepted state;
- importing the plugin has no external side effects;
- activation and deactivation do not leak or duplicate resources owned by the plugin.

Do not add tests only to increase coverage. A test belongs here when it protects a requirement, a nontrivial contract, a lifecycle rule or a reproduced regression.

## Implementation completion

The first Repository package implementation is complete when the Cordis service satisfies this Spec, the in-memory provider satisfies the test contract, required Core operations are connected through stable APIs or isolated adapters, and the relevant type checking, tests, build and package-content verification pass on supported Node versions.

Package completion does not claim durable small-team deployment until a persistent Runtime provider is connected.

## Spec changes

During the MVP phase, `docs/requirements.md` remains the product source of truth and this file remains a mutable projection of it. If implementation reveals a changed product need, update the requirements before revising this Spec.

Numbered or immutable Spec history can be introduced later when maintenance makes that traceability useful.
