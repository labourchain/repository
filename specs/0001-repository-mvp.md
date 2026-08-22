# SPEC-0001: Repository MVP

- **Status:** Draft
- **Target:** first usable Repository service
- **Scope:** workspace membership, Record/Asset acceptance, validation boundary, persistence boundary, retrieval
- **Out of scope:** raw-entry recognition, Project semantics, analysis, blockchain packing/consensus, production runtime backends

## 1. Purpose

Repository is the LabourChain capability that turns a set of accepted facts and assets into a usable workspace for a small team without introducing project-management semantics or blockchain requirements.

The MVP must support the minimum closed loop required by Flow and Board:

1. a worker belongs to a Repository workspace;
2. an upstream package produces a recognized Record;
3. Repository checks that the contributor is allowed to contribute;
4. Repository validates the accepted object through the Core validation boundary;
5. Repository persists the Record or Asset through a replaceable backend;
6. consumers can retrieve stored objects and references;
7. higher-level packages may organize or analyze those objects without Repository understanding Project semantics.

This spec intentionally leaves blockchain archival for a later layer. Repository must not make future chain integration harder, but chain behavior is not an MVP requirement.

## 2. Terminology

### Repository

A workspace and fact-storage boundary. It maintains worker membership and provides storage, validation, and retrieval of accepted Records and Assets.

A Repository is **not** a Project and does not classify stored objects by project meaning.

### Worker

An identity that may become a member of a Repository. Only an identity with an active Repository membership may contribute persistent LabourChain Records or Assets through the Repository service.

The identity format and cryptographic semantics belong to Core protocols and are not redefined here.

### Record

A recognized LabourChain fact that already conforms to a protocol-level representation before Repository acceptance.

Raw natural-language input is not a Record. Raw-entry recognition and draft conversion belong to LabourFlow.

### Asset

A storable or referenceable object associated with LabourChain activity. Repository may persist or reference Assets, but must not attach Project semantics to them.

The canonical Asset representation is defined outside this package. Runtime-generated data becomes an Asset only after an explicit capture/archive step; caches and indexes are not Assets by default.

### Project

An organization of Records and Assets used for planning, analysis, review, and other project-level capabilities. Project semantics are explicitly outside Repository.

## 3. Architectural boundaries

### 3.1 Repository owns

Repository owns the following application/domain capabilities:

- Repository workspace identity/configuration;
- worker-to-Repository membership;
- contribution authorization based on Repository membership;
- acceptance of already-recognized Records and Assets;
- delegation to Core validation before accepted objects become persistent Repository content;
- persistence/retrieval orchestration through a replaceable backend capability;
- stable object retrieval and generic enumeration required by upstream consumers.

### 3.2 Repository does not own

Repository must not own:

- RawEntry parsing, LLM extraction, protocol detection, or Record drafting;
- Project membership, Project grouping, planning, progress, retrospectives, or semantic aggregation;
- Board views or UI-specific projections;
- Core protocol schemas, canonical hashing/signing rules, block structure, or consensus;
- MongoDB-, Redis-, SQL-, filesystem-, search-index-, or cache-specific behavior in the domain service;
- LLM or agent behavior;
- implicit conversion of runtime state into canonical Assets.

### 3.3 Dependency direction

The intended direction is:

```text
Flow / Board / Project
        |
        v
Repository service
   |           |
   v           v
Core       Runtime provider
```

Core protocol logic must not depend on Repository application semantics. Runtime providers must implement capabilities consumed by Repository rather than forcing backend-specific concepts into the Repository contract.

## 4. Core invariants

The MVP implementation must preserve these invariants.

### INV-1: Membership precedes contribution

A worker must have an active relationship with the target Repository before Repository accepts a persistent Record or Asset contribution from that worker.

### INV-2: Repository accepts recognized objects, not raw entries

Repository must not contain a hidden RawEntry-to-Record conversion path. If an input is not yet a recognized Record/Asset, the caller must use LabourFlow or another recognition package first.

### INV-3: Validation precedes persistence

A Record or Asset must pass the configured Core validation boundary before it becomes accepted persistent Repository content.

The bootstrap may use a test validator while the Core runtime API is being finalized, but production behavior must not silently bypass validation.

### INV-4: Repository is project-agnostic

Repository may expose generic metadata and retrieval operations, but it must not classify, aggregate, summarize, rank, or mutate facts based on Project semantics.

A Project package may reference Repository object IDs and build its own organization/projections externally.

### INV-5: Backend details are replaceable

The Repository domain/service contract must not expose MongoDB collections, Redis keys, SQL rows, filesystem paths, or other backend-specific storage concepts as canonical public semantics.

### INV-6: Stored accepted objects are not silently rewritten

Repository must not silently mutate an accepted Record/Asset to satisfy storage or UI convenience. Corrections and versioning must follow the owning protocol's semantics.

### INV-7: Runtime data is not automatically an Asset

Indexes, caches, LLM context, temporary downloads, API responses, and database projections remain runtime state unless an explicit capture/archive operation produces an Asset accepted by Repository.

### INV-8: Cordis lifecycle owns external resources

Any provider connection, file watcher, server, timer, subscription, or other external resource created by this package must be acquired and disposed within the Cordis lifecycle. Importing the package must have no external side effects.

## 5. MVP service capabilities

This section defines capabilities, not final TypeScript method names. Exact API names may be refined before this spec moves from Draft to Accepted, but implementations must not exceed the semantic scope below without a spec change.

### Workspace

- read Repository identity and basic metadata required by clients;
- initialize or load one Repository workspace for the running plugin instance.

**MVP decision:** one configured Repository workspace per plugin instance is sufficient. Multi-Repository hosting in one service instance is Future unless required by an actual deployment.

### Membership

- add/activate a worker relationship;
- remove/deactivate a worker relationship;
- test whether a worker may contribute;
- enumerate current members for workspace administration.

Membership persistence must use the same backend abstraction as other Repository state unless Core later makes membership a different canonical fact type.

### Record acceptance

The service must support an operation semantically equivalent to:

```text
acceptRecord(contributor, recognizedRecord)
```

Required behavior:

1. verify contributor membership;
2. validate the Record through Core validation;
3. reject invalid or unauthorized input without partial persistence;
4. persist the accepted Record through the backend;
5. return a stable reference to the stored accepted object.

Repository must not enrich or reinterpret the Record as part of acceptance.

### Asset acceptance

The service must support the equivalent flow for Assets:

```text
acceptAsset(contributor, recognizedAsset)
```

Repository may store Asset content, metadata, or an external reference according to the Asset protocol and backend capability, but must not silently promote arbitrary runtime state to an Asset.

### Retrieval

The MVP must support:

- get by stable Repository object reference/ID;
- enumerate Records with generic cursor/pagination behavior;
- enumerate Assets with generic cursor/pagination behavior;
- enumerate membership.

Optional generic filters may be added only when they operate on protocol/storage metadata without embedding Project semantics. Project-specific queries belong outside this package.

## 6. Provider boundary

Repository persistence must be expressed through an internal/provider contract that can be replaced independently from the Repository domain service.

The first implementation should include an in-memory provider for tests and local development. Production backends such as MongoDB or other runtime infrastructure belong to the LabourChain runtime layer and may be supplied by separate Cordis plugins.

Provider behavior must support atomic acceptance at the level needed to satisfy INV-3: invalid or unauthorized objects must not appear as partially accepted Repository content.

## 7. Core validation boundary

Repository must consume Core protocol semantics rather than copy them.

Until `labourchain/core-protocols` exposes a stable runtime service API, this package may define a narrow adapter interface used by tests and integration work. That adapter is temporary infrastructure, not a competing protocol model.

The adapter must be replaceable without changing Flow/Board-facing Repository semantics.

## 8. Cordis plugin requirements

The implementation must follow these lifecycle rules:

- no process-global mutation at module import;
- explicit service/provider dependencies;
- no hidden singleton used as cross-plugin state;
- resources acquired by activation must be disposed by Cordis effect/lifecycle cleanup;
- deactivation must leave no timers, sockets, watchers, or open backend handles owned by the plugin;
- service consumers must not need to know the concrete persistence provider;
- HMR/reload must not duplicate registered resources or leak stateful handles.

The public service name should use the LabourChain namespace (for example, `labourchainRepository`) rather than a generic flat name such as `repository`.

## 9. Error model

The implementation must expose distinguishable programmatic failures for at least:

- repository not initialized/available;
- contributor is not an active member;
- Core validation failed;
- object already exists / stable-reference collision when the owning protocol disallows replacement;
- backend unavailable;
- requested object not found.

Error messages must contain enough context for logs without embedding secrets or full Asset content by default.

## 10. Test requirements

Before SPEC-0001 can become Accepted/Implemented, automated tests must demonstrate at minimum:

1. member can contribute a valid recognized Record;
2. non-member contribution is rejected and nothing is persisted;
3. invalid Record is rejected and nothing is persisted;
4. accepted Record can be retrieved unchanged;
5. Asset acceptance follows the same membership/validation order;
6. Repository enumeration does not require Project semantics;
7. backend can be substituted with an in-memory test provider;
8. plugin activation/deactivation does not leak owned resources;
9. repeated lifecycle activation does not duplicate stateful registrations;
10. package import has no external side effects.

Coverage gates are engineering quality gates, not a substitute for these invariant tests.

## 11. Non-goals for the first implementation

The following are explicitly Future/other-package concerns:

- blockchain packing and chain registration;
- cryptographic signing UX;
- P2P replication or consensus;
- Project model and Project queries;
- weekly summaries, retrospectives, recommendations, or LLM analysis;
- RawEntry ingestion/recognition;
- UI;
- production MongoDB/Redis implementations in this repository;
- search ranking and analytics;
- multi-tenant hosting of many Repository workspaces in one plugin instance;
- automatic archival of runtime state as Assets.

## 12. Acceptance criteria

SPEC-0001 may be marked **Implemented** when:

- the Repository Cordis service implements the capabilities and invariants above;
- the in-memory provider supports the contract needed by tests;
- Core validation is integrated through the agreed stable service or a clearly isolated temporary adapter;
- `pnpm run typecheck` passes;
- `pnpm run test:coverage` passes;
- `pnpm run build` passes;
- `npm pack --dry-run` contains only intended publish files;
- CI passes on supported operating systems;
- README public behavior matches the implementation;
- package publication remains disabled until a separate release-readiness review confirms the plugin is actually useful and maintainable.

## 13. Spec evolution

Changes to any invariant, ownership boundary, or public service behavior require one of:

- an amendment to this spec while it is Draft;
- a new spec that explicitly supersedes part of SPEC-0001 after it is Accepted.

Implementation-only refactors that preserve observable behavior do not require a new spec, but must remain covered by tests.
