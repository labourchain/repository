# LabourChain Repository Specification

Status: **Draft / Pre-implementation**  
Spec version: **0.1.0**  
Normative language: the terms **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are used as requirement keywords.

## 1. Purpose

The LabourChain Repository is the workspace and fact-storage boundary used by LabourFlow, LabourBoard, and other LabourChain packages.

The Repository exists to keep a small team's accepted records and assets available, attributable to a workspace and its worker relationships, while keeping higher-level product semantics outside the storage boundary.

This specification intentionally describes the smallest usable Repository. It does not specify blockchain consensus, project analysis, raw-entry extraction, or infrastructure-specific persistence behavior.

## 2. Context and terminology

### 2.1 Workspace / Repository

A **Repository** is a LabourChain workspace that stores accepted records and assets and maintains the relationship between that workspace and its workers.

In this specification, "workspace" describes the user-facing organizational boundary and "Repository" describes the domain/service capability. They refer to the same managed scope unless a later spec explicitly separates them.

### 2.2 Worker

A **Worker** is an identity recognized as a member/contributor of a Repository.

The Repository does not define the global identity protocol. It only maintains and enforces Repository membership relationships using identity references supplied by the relevant core protocol capability.

### 2.3 Record

A **Record** is an already-recognized LabourChain fact that conforms to a supported record protocol.

A free-form Raw Entry is not a Record. LabourFlow is responsible for transforming Raw Entries into recognized Record drafts and for obtaining any required human confirmation before submission.

### 2.4 Asset

An **Asset** is a storable or referenceable object accepted by the Repository under an applicable asset/protocol contract.

Assets may represent files, snapshots, external references, or other durable materials. This spec does not require a specific binary storage strategy.

### 2.5 Project

A **Project** is an organization of assets and records used for project-oriented planning, analysis, review, and guidance.

Project semantics are explicitly outside the Repository. Repository storage and query APIs MUST NOT require Project classification as an intrinsic storage dimension.

### 2.6 Runtime provider

A **Runtime provider** supplies non-domain runtime capabilities such as database persistence, cache, filesystem access, external APIs, or other I/O.

Runtime state is not automatically an Asset. Archiving runtime output as an Asset is an explicit action outside the default persistence path.

## 3. Architectural boundary

### REP-ARCH-001 — Narrow domain scope

The Repository MUST be limited to:

- workspace/repository identity and metadata needed for operation;
- worker membership relationships;
- accepted Record storage and retrieval;
- accepted Asset storage and retrieval;
- validation and authorization orchestration required before persistence;
- query capabilities needed by consumers such as LabourFlow and LabourBoard.

### REP-ARCH-002 — Project independence

The Repository MUST NOT implement project grouping, project planning, project review, project progress calculation, or project analytics.

A Project package MAY query Repository records/assets and MAY persist resulting confirmed records back into the Repository.

### REP-ARCH-003 — Raw Entry independence

The Repository MUST NOT parse, classify, summarize, normalize, or otherwise convert Raw Entries into Records.

Only recognized Record submissions are accepted by the Record persistence boundary.

### REP-ARCH-004 — Runtime independence

Repository domain APIs MUST NOT expose MongoDB-, Redis-, SQL-, filesystem-, or vendor-specific concepts.

Persistence implementations MUST be replaceable without changing Repository domain behavior.

### REP-ARCH-005 — Core protocol independence

The Repository MUST consume core protocol/validation capabilities rather than reimplement canonical record, asset, identity, signature, or protocol semantics locally.

Changes to core protocol semantics belong to the core-protocols package/repository, not this repository.

### REP-ARCH-006 — No blockchain dependency for MVP

The MVP MUST function without block packing, consensus, P2P synchronization, or chain registration.

Future chain integration MUST be additive beneath or beside the Repository boundary so that Flow/Board consumers do not require a domain rewrite.

## 4. Cordis contract

### REP-CORDIS-001 — Service boundary

The Repository MUST expose its public capability through a Cordis `Service` named:

`labourchainRepository`

The service name is intentionally prefixed because Cordis services share a named context namespace.

### REP-CORDIS-002 — Explicit dependencies

Required services MUST be declared through Cordis dependency injection (`inject` or the equivalent class-service dependency declaration).

The implementation MUST NOT depend on hidden process globals or service-locator fallbacks for required domain dependencies.

### REP-CORDIS-003 — Lifecycle ownership

Resources acquired by Repository plugins/providers MUST be owned by the relevant Cordis lifecycle.

Any resource requiring cleanup MUST provide a deterministic disposer through the owning service/provider/effect lifecycle.

### REP-CORDIS-004 — Provider replacement

Persistence MUST be represented by a replaceable provider capability.

The Repository service MUST NOT select storage implementations with environment-specific `if mongo ... else memory ...` branching inside domain methods.

### REP-CORDIS-005 — Service disappearance

If a required provider disappears, the Repository plugin MUST rely on Cordis dependency lifecycle behavior rather than continue operating against a stale provider reference.

## 5. MVP behavior

### REP-MVP-001 — Workspace availability

A consumer MUST be able to create or resolve a Repository workspace and obtain a stable Repository identifier.

The exact core-protocol representation of the Repository identifier is delegated to the core protocol layer.

### REP-MVP-002 — Worker membership

A Repository MUST support adding, removing, and listing worker membership relationships.

Membership changes MUST be queryable as current workspace state.

This specification does not yet require historical membership event replay; that behavior may be added by a later spec when core-record integration is finalized.

### REP-MVP-003 — Contribution gate

A worker MUST belong to the target Repository before the Repository accepts a new labour Record attributed to that worker.

A rejected write MUST NOT be persisted as an accepted Record.

### REP-MVP-004 — Record validation before persistence

Every submitted Record MUST be validated against its declared/supported protocol capability before it becomes accepted Repository data.

Validation failure MUST return a structured failure and MUST NOT persist the Record as accepted data.

### REP-MVP-005 — Record identity

An accepted Record MUST have a stable identity supplied by or derivable under the applicable core protocol semantics.

The Repository MUST NOT silently generate a second application-only identity that replaces the protocol identity.

### REP-MVP-006 — Record retrieval

Consumers MUST be able to retrieve an accepted Record by its stable identity.

### REP-MVP-007 — Record query

Consumers MUST be able to query accepted Records by Repository scope and by the minimum neutral dimensions required for the MVP:

- worker/creator reference;
- time range;
- protocol/type reference when available from the Record envelope.

Project is not a required intrinsic query dimension.

### REP-MVP-008 — Asset persistence

The Repository MUST support accepting and retrieving Assets through a storage-neutral abstraction.

The MVP MAY store asset metadata/reference separately from asset bytes as long as retrieval semantics are explicit and tests cover the chosen behavior.

### REP-MVP-009 — Asset validation

If an Asset type is governed by a protocol/validator, validation MUST occur before the Asset is marked accepted.

### REP-MVP-010 — Referential integrity

When a stored Record references an Asset or another Record, the Repository SHOULD preserve the reference exactly as submitted under the applicable protocol.

The MVP MAY allow unresolved external references; it MUST NOT rewrite references into Repository-local project classifications.

### REP-MVP-011 — Deterministic errors

Domain failures MUST be distinguishable at least across these categories:

- workspace not found;
- worker not a member / contribution not authorized;
- validation failed;
- record not found;
- asset not found;
- persistence/provider failure.

The concrete TypeScript error model is an implementation decision, but callers MUST NOT need to parse free-form log text to determine the category.

### REP-MVP-012 — No silent mutation

The Repository MUST NOT silently mutate an accepted Record payload to fit storage requirements.

Storage-specific serialization MAY transform representation only if round-trip semantics preserve the accepted domain object.

## 6. Planned service surface

The following surface is informative for implementation planning and becomes normative only when an implementation PR maps it to the requirements above.

```ts
interface LabourchainRepositoryService {
  // workspace
  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace>
  getWorkspace(id: WorkspaceId): Promise<Workspace | null>

  // membership
  addWorker(workspaceId: WorkspaceId, worker: WorkerRef): Promise<void>
  removeWorker(workspaceId: WorkspaceId, worker: WorkerRef): Promise<void>
  listWorkers(workspaceId: WorkspaceId): Promise<WorkerRef[]>

  // records
  putRecord(workspaceId: WorkspaceId, record: Record): Promise<AcceptedRecord>
  getRecord(workspaceId: WorkspaceId, recordId: RecordId): Promise<Record | null>
  queryRecords(query: RecordQuery): Promise<RecordPage>

  // assets
  putAsset(workspaceId: WorkspaceId, asset: AssetInput): Promise<AcceptedAsset>
  getAsset(workspaceId: WorkspaceId, assetId: AssetId): Promise<Asset | null>
  queryAssets(query: AssetQuery): Promise<AssetPage>
}
```

Names may change before the first stable implementation. The semantic requirements (`REP-*`) take precedence over this sketch.

## 7. Persistence provider contract

### REP-PERSIST-001 — Provider is an implementation seam

The Repository MUST consume persistence through an abstract provider/service boundary.

### REP-PERSIST-002 — Memory provider for tests

The first implementation SHOULD include an in-memory provider suitable for deterministic unit/integration tests.

### REP-PERSIST-003 — Durable provider is not required for first slice

A MongoDB or other durable provider MAY be added after the in-memory behavior closes the MVP contract.

Durable-provider implementation MUST NOT change domain behavior.

### REP-PERSIST-004 — Cache is not source of truth

Redis or any future cache provider MUST NOT be treated as the authoritative Repository fact store unless a future spec explicitly changes that role.

## 8. Security and authorization boundary

### REP-AUTH-001 — Minimal authorization

The MVP authorization rule is membership-based contribution gating as defined by `REP-MVP-003`.

This spec does not define a complete role/permission system.

### REP-AUTH-002 — Identity verification delegation

Cryptographic identity/signature verification, when required by a core protocol, MUST be delegated to the relevant core capability.

The Repository MUST NOT invent an incompatible identity scheme.

## 9. Observability and failure behavior

### REP-OPS-001 — No swallowed failures

Validation, authorization, and persistence failures MUST be observable to the caller.

### REP-OPS-002 — Logging is diagnostic only

Logs MAY provide diagnostics but MUST NOT be the only representation of a domain failure.

### REP-OPS-003 — No partial accepted write

An operation that reports failure MUST NOT leave the target Record/Asset visible as accepted Repository data.

Provider-specific transactional mechanics are deferred to the provider implementation.

## 10. Testing requirements

### REP-TEST-001 — Domain behavior

Tests MUST cover the MVP acceptance/rejection behavior independently of any durable database.

### REP-TEST-002 — Cordis lifecycle

Tests MUST mount the Repository through a real Cordis `Context` and verify that required services/providers participate in the expected lifecycle.

### REP-TEST-003 — Provider contract

Every persistence provider implementation MUST pass the same provider contract test suite.

### REP-TEST-004 — Requirement traceability

Behavior tests SHOULD cite the relevant `REP-*` requirement IDs in test names or nearby comments.

### REP-TEST-005 — Coverage gate

CI MUST enforce automated test coverage thresholds. Initial thresholds are defined in repository tooling and may only be lowered through an explicit reviewed change.

## 11. Quality and maintainability requirements

### REP-QUAL-001 — Readable public API

Public service methods and exported types MUST have stable, domain-oriented names and must not expose infrastructure-specific types.

### REP-QUAL-002 — Small modules

Implementation SHOULD keep domain policy, Cordis integration, and provider implementation in separate modules once each concern contains meaningful behavior.

Do not split files solely to create architectural appearance.

### REP-QUAL-003 — Contribution-friendly changes

New features MUST include tests and documentation/spec updates where behavior changes.

Generated code MUST NOT be committed without a documented regeneration path.

### REP-QUAL-004 — No speculative framework

The implementation MUST NOT add abstraction layers for blockchain, project analytics, LLM extraction, or provider types that are not required by an accepted spec requirement.

### REP-QUAL-005 — Backward compatibility after first stable contract

Before version `1.0.0`, incompatible API changes are allowed only when the spec and changelog explicitly describe the migration.

After the first stable release, incompatible public API changes require a major version or an explicit compatibility mechanism.

## 12. Non-goals

The following are not part of this specification:

- Raw Entry capture, parsing, or LLM conversion;
- LabourFlow UI;
- LabourBoard UI;
- Project organization, planning, review, or analysis;
- meeting-summary-specific entities;
- blockchain packaging, consensus, P2P networking, or chain registration;
- token/reward accounting;
- complete organization RBAC;
- MongoDB, Redis, S3, or GitHub-specific domain APIs;
- automatic conversion of runtime state into Assets.

## 13. Spec-driven change process

### 13.1 Requirement IDs

Normative behavior uses stable IDs in the form `REP-<AREA>-NNN`.

Existing IDs MUST NOT be silently reused for unrelated semantics.

### 13.2 Change order

For any domain behavior change:

1. update this specification;
2. explain the problem and affected requirement IDs;
3. review/accept the semantic change;
4. implement the smallest compliant change;
5. add/update tests;
6. update CHANGELOG when user-visible/public behavior changes.

Mechanical refactors that do not alter behavior may omit a spec change, but the PR MUST state that no `REP-*` semantics changed.

### 13.3 Source of truth

When README examples, comments, implementation, and this specification disagree on domain behavior, `SPEC.md` is the source of truth until the discrepancy is resolved by a reviewed spec change.

## 14. MVP acceptance checklist

The Repository MVP is complete when all of the following are demonstrated by automated tests:

- a Repository workspace can be created/resolved;
- worker membership can be added, removed, and listed;
- non-members cannot contribute accepted labour Records;
- members can submit recognized Records;
- invalid Records are rejected before persistence;
- accepted Records can be retrieved and queried;
- Assets can be stored and retrieved through the neutral interface;
- the same domain tests run against the in-memory persistence provider;
- Repository behavior is mounted and exercised through Cordis lifecycle tests;
- `pnpm check` and CI pass.

## 15. Deferred questions

These questions are intentionally unresolved until implementation or core-protocol work makes them necessary:

1. Whether membership history itself is persisted purely as core Records or additionally projected into provider state.
2. The exact core protocol/type used for generic Asset metadata.
3. The canonical pagination/cursor shape shared with other LabourChain packages.
4. Whether durable provider packages live in this repository or the separate LabourChain runtime repository.
5. The exact transition point at which accepted Repository data is signed/packed for chain archival.

None of these questions block the first in-memory, non-chain MVP slice.