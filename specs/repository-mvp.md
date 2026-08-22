# Repository MVP Specification

- **Status:** Draft
- **Target:** first usable Repository service
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Features:** [`../docs/features.md`](../docs/features.md)

This document is the strict engineering contract for the first usable Repository implementation. Product needs are described in `docs/`; this spec defines the boundaries, invariants, service behavior, provider behavior, errors, lifecycle rules, and acceptance tests needed to implement them without expanding the scope implicitly.

## Purpose

Repository provides a workspace-oriented storage and validation capability for recognized LabourChain Records and Assets.

The MVP supports this path:

```text
worker relationship
  -> recognized Record / Asset
  -> authorization
  -> Core validation
  -> persistence
  -> stable retrieval
```

## Terminology

### Repository

A workspace and fact-storage boundary that maintains worker relationships and provides acceptance, persistence orchestration, and retrieval of Records and Assets.

### Worker

An identity that has an active or inactive relationship with a Repository workspace.

Identity format, signatures, and cryptographic semantics belong to LabourChain Core.

### Record

A recognized LabourChain fact that already has a protocol-level representation before Repository acceptance.

### Asset

A storable or referenceable object explicitly captured as part of LabourChain activity.

### Persistence provider

A replaceable backend capability used by Repository to preserve workspace state, worker relationships, Records, and Assets.

## Boundaries

Repository owns:

- one Repository workspace per plugin instance for the MVP;
- worker-to-Repository relationships;
- contribution authorization based on active worker relationship;
- acceptance orchestration for recognized Records and Assets;
- delegation to LabourChain Core validation;
- persistence and retrieval orchestration through a replaceable provider;
- generic enumeration of workers, Records, and Assets.

Repository does not own:

- RawEntry recognition, LLM extraction, protocol detection, or Record drafting;
- Project organization, grouping, planning, progress, retrospective, summary, or semantic analysis;
- Board presentation or UI projections;
- Core protocol schemas, canonical hashing/signing rules, block structure, or consensus;
- database-specific domain semantics such as MongoDB collections, Redis keys, SQL rows, or filesystem paths;
- automatic promotion of runtime state, caches, indexes, temporary API responses, or LLM context into Assets;
- blockchain packing, peer synchronization, or chain settlement in the MVP.

These boundaries are implementation constraints. A capability outside them requires a requirements change before the spec is expanded.

## Invariants

### Membership precedes contribution

A contributor must have an active worker relationship with the Repository before Repository accepts a persistent Record or Asset contribution.

Authorization failure must occur before persistence.

### Recognition precedes Repository acceptance

Repository accepts recognized Records and Assets. It must not contain an alternate RawEntry-to-Record recognition path.

### Validation precedes persistence

A Record or Asset must pass the configured LabourChain Core validation capability before it becomes accepted persistent Repository content.

Validation failure must leave no partially accepted object.

### Accepted facts are preserved

Repository must not silently rewrite accepted Record or Asset semantics for storage, indexing, or UI convenience.

Correction and versioning follow the owning protocol semantics.

### Project semantics stay external

Repository retrieval and enumeration must remain usable without loading or understanding Project entities or Board projections.

### Backend details stay behind the provider contract

The public Repository service must not expose backend-native identifiers or storage structures as canonical Repository behavior.

### Runtime state is not automatically an Asset

Runtime data becomes an Asset only through an explicit capture/archive workflow followed by normal Repository acceptance.

### Cordis owns external resources

Importing the package must have no external side effects.

Connections, watchers, timers, subscriptions, servers, or other external resources owned by Repository or its in-repository provider must be acquired and disposed through the Cordis lifecycle.

Reload must not duplicate stateful registrations or leak owned resources.

## Service capabilities

Exact TypeScript names may be refined while this spec is Draft, but public behavior must remain within the following contract.

### Workspace

The service must expose the active Repository workspace identity and basic metadata required by clients.

The MVP may initialize or load one configured workspace per plugin instance.

### Worker relationships

The service must support operations semantically equivalent to:

```text
activateWorker(worker)
deactivateWorker(worker)
isWorkerActive(worker)
listWorkers(cursor?)
```

Activating an already-active worker and deactivating an already-inactive worker must have deterministic behavior documented by the implementation contract before this spec moves to Accepted.

### Record acceptance

The service must support an operation semantically equivalent to:

```text
acceptRecord(contributor, recognizedRecord)
```

Required order:

1. verify the contributor has an active worker relationship;
2. validate the Record through the Core validation capability;
3. reject authorization or validation failures without persistence;
4. persist the accepted Record through the configured provider;
5. return a stable Repository reference.

Repository must not enrich, classify, summarize, or reinterpret the Record during acceptance.

### Asset acceptance

The service must support an operation semantically equivalent to:

```text
acceptAsset(contributor, recognizedAsset)
```

It follows the same authorization-before-validation-before-persistence ordering as Record acceptance.

### Retrieval

The MVP must support:

- retrieve an accepted Record by stable Repository reference;
- retrieve an accepted Asset by stable Repository reference;
- explicit not-found behavior;
- returned accepted content preserving the submitted semantic content.

### Enumeration

The MVP must support generic enumeration of:

- workers;
- Records;
- Assets.

Enumeration must use a backend-neutral cursor or pagination contract.

Filters may use generic protocol or storage metadata only when they do not introduce Project or application semantics.

## Core validation boundary

Repository consumes Core validation rather than copying protocol rules.

Until `labourchain/core-protocols` exposes a stable runtime service API, Repository may define a narrow adapter interface used by tests and integration work.

That adapter:

- must be isolated from Repository public semantics;
- must be replaceable without changing Flow/Board-facing behavior;
- must not become a second protocol model;
- must fail closed when validation capability required for acceptance is unavailable.

## Persistence provider contract

The first implementation must include an in-memory provider for tests and local development.

The provider must support the operations required for:

- loading workspace state;
- preserving worker relationships;
- storing accepted Records;
- storing accepted Assets;
- retrieving accepted objects;
- enumerating workers, Records, and Assets.

Provider behavior must preserve these properties:

- no partial accepted state after authorization or validation failure;
- stable retrieval references within the provider's persisted Repository state;
- backend failures surfaced in a backend-neutral programmatic form;
- accepted content returned without provider-specific semantic rewriting.

Production MongoDB, Redis, SQL, filesystem, or remote providers belong to the runtime layer unless a later requirement explicitly changes the packaging decision.

## Cordis integration

The public service name must use a LabourChain-specific namespace, such as `labourchainRepository`, rather than a generic flat name.

The implementation must:

- declare service/provider dependencies explicitly;
- avoid process-global mutable state for Repository data;
- register and dispose owned resources through Cordis lifecycle/effects;
- support repeated activation/deactivation in tests without duplicated handles;
- allow consumers to use Repository without knowing the concrete persistence provider.

## Error model

The implementation must expose distinguishable programmatic failures for at least:

- Repository unavailable or not initialized;
- contributor is not an active worker;
- Core validation rejected the object;
- Core validation capability unavailable;
- object reference collision when replacement is not allowed by protocol semantics;
- backend unavailable or failed;
- requested object not found.

Errors must provide enough context for logs without embedding secrets or full Asset content by default.

## Acceptance tests

Before this spec can move to **Implemented**, automated tests must demonstrate at minimum:

- workspace can initialize/load;
- worker can be activated, queried, enumerated, and deactivated;
- active worker can contribute a valid recognized Record;
- inactive/non-member contribution is rejected before persistence;
- invalid Record is rejected before persistence;
- accepted Record can be retrieved with preserved semantic content;
- Asset acceptance follows the same authorization and validation ordering;
- accepted Asset can be retrieved;
- Records, Assets, and workers can be enumerated without Project semantics;
- in-memory provider can be substituted behind the Repository service contract;
- backend failure is surfaced programmatically;
- plugin import causes no external side effects;
- plugin activation/deactivation leaves no owned resource leak;
- repeated activation/reload does not duplicate owned registrations.

Coverage thresholds are quality gates, not a substitute for these contract and invariant tests.

## Implementation completion

The MVP implementation is complete when:

- the Cordis Repository service satisfies this spec;
- the in-memory provider satisfies the provider contract;
- Core validation is connected through the stable Core service or a clearly isolated temporary adapter;
- all acceptance tests pass;
- `pnpm run typecheck` passes;
- `pnpm run test:coverage` passes;
- `pnpm run build` passes;
- `pnpm run package:check` passes on supported CI platforms;
- the published tarball contains runtime artifacts and required package metadata only;
- `README.md` accurately describes the usable repository at a human-facing level.

The package remains private until a separate release-readiness review confirms the first implementation is useful and maintainable.

## Spec changes

While this spec is Draft, accepted requirements may refine it directly.

After the first stable implementation enters maintenance, versioning or numbered spec history may be introduced when preserving long-term change history becomes useful. Until then, this file remains the single MVP contract.
