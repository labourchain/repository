# Repository MVP Specification

- **Status:** Draft
- **Target:** first usable Repository service
- **Requirements source:** [`../docs/requirements.md`](../docs/requirements.md)

This document is an engineering projection of `docs/requirements.md`.

It may choose concrete service shapes, lifecycle rules, provider contracts, errors, and testable invariants needed to satisfy the requirements. It must not create product behavior that is absent from the requirements source. When this Spec conflicts with `docs/requirements.md`, the requirements document is authoritative and this Spec must be changed.

## Purpose

The Repository plugin provides a Cordis capability for one Repository workspace, worker membership, validation and preservation of recognized LabourChain Records and Assets, and later retrieval of that stored material.

The MVP service path is:

```text
worker membership
  -> recognized Record / Asset
  -> membership check
  -> Core validation
  -> storage provider
  -> retrieval / enumeration
```

## Terminology

### Repository

The workspace represented by this plugin instance. It contains worker membership and accepted Records and Assets.

### Worker

A LabourChain identity that may belong to the Repository workspace.

Identity representation, signatures, and other identity protocol semantics come from LabourChain Core.

### Record

A recognized LabourChain Record with a protocol-level representation before Repository acceptance.

### Asset

An Asset or Asset reference represented according to its applicable LabourChain protocol.

### Storage provider

A replaceable runtime capability used by Repository to preserve and retrieve workspace state. The provider is an implementation mechanism; it does not define Repository product semantics.

## Engineering boundaries

The MVP implementation is intentionally narrow.

Repository owns:

- the active Repository workspace exposed by one plugin instance;
- worker membership in that workspace;
- membership checks for contributions;
- acceptance orchestration for recognized Records and Assets;
- delegation to LabourChain Core validation;
- storage/retrieval orchestration;
- listing workers, Records, and Assets.

Repository must not absorb adjacent product responsibilities while implementing these requirements:

- RawEntry recognition, LLM extraction, protocol detection, or Record drafting remain in LabourFlow or another recognition workflow;
- Project organization, planning, review, summary, and analysis remain outside Repository;
- Board presentation and projections remain outside Repository;
- Core protocol schemas, hashing, signatures, block semantics, and protocol validation rules remain in Core;
- concrete database, filesystem, cache, external API, and similar runtime integrations remain provider concerns;
- runtime data is not silently promoted into an Asset;
- blockchain packing, peer synchronization, and settlement are not part of this MVP Repository implementation.

These boundaries exist to prevent implementation convenience from expanding the product scope.

## Invariants

### Membership precedes contribution

A contributor must belong to the Repository before a persistent Record or Asset contribution can be accepted.

Membership failure occurs before validation or storage.

### Recognition precedes Repository acceptance

Repository receives protocol-recognized Records and Assets. It does not implement a RawEntry-to-Record conversion path.

### Validation precedes storage

A Record or Asset must pass the applicable LabourChain Core validation before it becomes accepted Repository content.

Validation failure must leave no accepted stored object.

### Accepted content is preserved

Repository must preserve the accepted semantic content of a Record or Asset.

Storage encoding, indexing, caching, or presentation must not silently change that semantic content. Correction/versioning follows the object's owning protocol.

### Stored state survives when backed by persistent storage

The Repository service must not rely on process memory as its canonical storage contract.

A persistent provider must be able to preserve workspace state across normal application restart without requiring changes to Repository-facing behavior.

An in-memory provider is permitted for tests and development only; it does not by itself satisfy the small-team persistence requirement.

### Project semantics remain external

Retrieval and enumeration must not require Project or Board semantics.

### Storage details remain behind the provider boundary

The public Repository service must not expose provider-native concepts such as MongoDB collections, Redis keys, SQL rows, or filesystem paths as Repository semantics.

### Cordis owns plugin resources

Importing the package must perform no external work.

Resources created by this plugin or an in-repository test provider must be acquired and disposed through Cordis lifecycle ownership. Reload or repeated activation must not duplicate owned resources.

## Service contract

Exact TypeScript names may still be refined while this Spec is Draft, but behavior should remain equivalent to the following minimal contract.

### Workspace

The service exposes the workspace identity and basic metadata required for clients to recognize which Repository they are using.

For the MVP, one configured workspace per Repository plugin instance is sufficient.

### Worker membership

The service provides operations semantically equivalent to:

```text
addWorker(worker)
removeWorker(worker)
hasWorker(worker)
listWorkers()
```

The first implementation should use simple deterministic set-like membership semantics:

- adding an existing worker succeeds without duplicating membership;
- removing a missing worker succeeds without creating other state.

This keeps the MVP model to the membership relationship required by the requirements rather than introducing role or status machinery prematurely.

### Record acceptance

The service provides an operation semantically equivalent to:

```text
acceptRecord(contributor, record)
```

Required order:

1. confirm contributor membership;
2. validate the Record through the Core validation boundary;
3. store the accepted Record;
4. return its stable identity/reference.

Failure before step 3 must leave no accepted Record.

Repository does not enrich, classify, summarize, or reinterpret the Record during acceptance.

### Asset acceptance

The service provides an operation semantically equivalent to:

```text
acceptAsset(contributor, asset)
```

It follows the same membership -> validation -> storage ordering as Record acceptance and returns the accepted Asset identity/reference.

### Retrieval

The MVP supports:

- retrieving a Record by stable identity/reference;
- retrieving an Asset by stable identity/reference;
- explicit not-found behavior;
- returning accepted semantic content unchanged.

Repository must not invent a second identity system when the accepted protocol object already provides the stable identity required for retrieval.

### Enumeration

The MVP supports simple listing of:

- workers;
- Records;
- Assets.

No cursor, pagination, semantic search, indexing contract, or Project-specific filtering is required in the first implementation. Those capabilities should be specified only when an actual consumer or scale requirement appears.

## Core validation boundary

Repository consumes Core validation rather than reproducing protocol rules.

Until `labourchain/core-protocols` exposes its stable runtime validation API, the Repository implementation may use a narrow internal adapter.

The adapter must:

- expose only the validation capability Repository needs;
- remain isolated from the public Repository service contract;
- be replaceable without changing Repository-facing behavior;
- fail closed when required validation is unavailable;
- not duplicate Core protocol schemas or validation logic.

## Storage provider contract

Repository uses a storage-provider interface so persistence implementation can live in the Runtime layer without changing Repository product behavior.

The provider needs only the capabilities required by this MVP:

- load/save workspace metadata;
- load/save/remove worker membership;
- store/get/list accepted Records;
- store/get/list accepted Assets.

Provider implementations must preserve these properties:

- rejected contributions never appear as accepted content;
- accepted object identity/reference remains stable for later retrieval;
- returned Record/Asset semantic content is preserved;
- provider failures are surfaced to Repository without being disguised as successful acceptance.

### In-memory provider

This repository should include a minimal in-memory provider for contract tests and local engineering work.

It is a test implementation of the provider contract, not the persistence solution for a real small-team deployment.

### Persistent providers

A usable deployment requires a persistent Runtime provider so accepted Repository state survives normal restart, as required by `docs/requirements.md`.

MongoDB, SQL, filesystem, or other persistent provider choices belong to the Runtime layer and do not need to be implemented in this repository's first code slice.

## Cordis integration

Repository is exposed as a Cordis service using a LabourChain-specific service name such as `labourchainRepository`.

The implementation must:

- declare dependencies explicitly;
- avoid process-global mutable Repository state;
- use Cordis lifecycle/effects for owned resources;
- allow clean repeated activation/deactivation in tests;
- allow consumers to use Repository without knowing the concrete storage provider.

## Error model

The service should expose programmatically distinguishable failures for:

- Repository unavailable/not initialized;
- contributor is not a member;
- Core validation rejected the object;
- required Core validation capability unavailable;
- stored object already conflicts with an existing identity/reference when replacement is not allowed;
- storage provider failure;
- requested object not found.

Errors should provide enough context for debugging without embedding full Asset content or other large/sensitive payloads by default.

## Acceptance tests

Before the Repository service implementation is considered complete, tests should demonstrate the behavior that materially protects the requirements and Cordis lifecycle:

- workspace can initialize/load;
- worker can be added, checked, listed, and removed;
- adding the same worker does not duplicate membership;
- a member can contribute a valid recognized Record;
- a non-member contribution is rejected before storage;
- an invalid Record is rejected before storage;
- an accepted Record can be retrieved unchanged;
- Asset acceptance follows the same membership and validation ordering;
- an accepted Asset can be retrieved unchanged;
- workers, Records, and Assets can be listed without Project semantics;
- the Repository service works against the in-memory provider contract;
- a storage-provider failure is surfaced as failure rather than accepted state;
- importing the plugin has no external side effects;
- activation/deactivation does not leak or duplicate resources owned by the plugin.

Do not add tests solely to increase coverage. Coverage is a secondary quality signal; contract and invariant value determines whether a test belongs here.

## Implementation completion

The Repository package's first implementation is complete when:

- the Cordis service satisfies this Spec;
- the in-memory provider satisfies the provider contract for tests;
- Core validation is connected through the stable Core service or the isolated temporary adapter;
- the acceptance tests pass;
- type checking, tests, build, and package-content verification pass on the supported Node versions;
- the npm tarball contains runtime artifacts and required package metadata without `docs/` or `specs/`.

This package-level completion does not claim that a small-team deployment is durable until a persistent Runtime provider is connected.

## Spec changes

During the MVP phase, `docs/requirements.md` remains the single product source of truth and this file remains a mutable projection of it.

If implementation reveals a missing or changed product need, update `docs/requirements.md` first and then revise this Spec.

Numbered/immutable Spec history can be introduced later when maintenance makes historical traceability useful.
