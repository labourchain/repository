# Repository Requirements

- **Status:** Working product requirements
- **Applies to:** `@labourchain/repository`
- **Implementation authority:** requirements are refined into formal contracts under `specs/`

## 1. Product intent

LabourChain needs a small-team workspace in which recognized labour facts can be contributed, preserved, and retrieved without requiring every consumer to understand storage infrastructure, Project semantics, or blockchain settlement.

Repository is that boundary.

A Repository is a workspace that workers can belong to and contribute to. It keeps accepted Records and Assets available as shared facts while higher-level packages such as LabourFlow, Project, and Board remain responsible for recognition, organization, planning, and analysis.

The first version exists to make the following closed loop possible:

```text
Worker
  -> LabourFlow recognizes a Record
  -> Repository accepts and preserves it
  -> another authorized consumer retrieves it
  -> Project / Board may organize or analyze it separately
```

The MVP succeeds when this loop works predictably for a small team without introducing blockchain or project-management complexity into Repository.

## 2. Product boundary

Repository is responsible for:

- representing one shared workspace;
- knowing which workers belong to that workspace;
- accepting already-recognized Records and Assets from members;
- preserving accepted objects without silent semantic rewriting;
- making accepted objects retrievable by stable reference;
- exposing generic lists of stored Records, Assets, and members;
- delegating protocol correctness to LabourChain Core validation;
- remaining independent from a particular storage backend.

Repository is not responsible for:

- recognizing RawEntry or natural language as a Record;
- deciding which Project an object belongs to;
- project planning, status, progress, retrospective, or summaries;
- LLM/agent interpretation;
- Board presentation or analytics;
- defining Core protocol schemas or canonical cryptographic semantics;
- blockchain packing, consensus, synchronization, or settlement;
- automatically turning caches, indexes, API responses, or other runtime state into Assets.

## 3. Requirements

### REQ-001 — Shared Repository workspace

A small team needs a stable Repository workspace that can be loaded by the running LabourChain application and identified independently from individual Records or Assets.

**Expected outcome:** clients can determine which Repository workspace they are operating against.

**MVP constraint:** one configured Repository workspace per plugin instance is sufficient.

### REQ-002 — Explicit worker membership

A Repository needs an explicit relationship between the workspace and the workers allowed to contribute to it.

**Expected outcome:** the system can add/activate, remove/deactivate, inspect, and enumerate Repository membership.

Membership is a contribution boundary, not a complete organization/permission system.

### REQ-003 — Membership-gated contribution

A worker who is not an active member of the target Repository must not be able to create persistent Repository content through the Repository service.

**Expected outcome:** unauthorized Record/Asset contributions fail without leaving partial accepted state.

### REQ-004 — Accept recognized Records

LabourFlow and other recognition packages need a stable place to submit Records after recognition is complete.

**Expected outcome:** Repository can accept a recognized Record, validate it, preserve it, and return a stable reference.

Repository must not perform hidden RawEntry-to-Record recognition during acceptance.

### REQ-005 — Accept explicit Assets

Workers and higher-level packages need to preserve Assets that are explicitly recognized/captured as part of LabourChain activity.

**Expected outcome:** Repository can accept an Asset or Asset reference according to its protocol, validate it, preserve it, and return a stable reference.

Runtime state is not an Asset merely because Repository can technically access it.

### REQ-006 — Core validation before acceptance

Consumers need Repository content to respect LabourChain protocol rules without Repository duplicating those rules.

**Expected outcome:** an object that fails the configured Core validation boundary is rejected before persistent acceptance.

Repository must consume Core semantics rather than fork them.

### REQ-007 — Preserve accepted object semantics

Consumers need an accepted Record or Asset to remain the same fact they submitted, subject only to protocol-defined correction/versioning rules.

**Expected outcome:** reading an accepted object returns its preserved semantic content; storage or UI convenience must not silently rewrite it.

### REQ-008 — Stable retrieval

Flow, Board, Project, migration tools, and other consumers need to retrieve accepted objects without knowing the concrete persistence backend.

**Expected outcome:** accepted objects can be retrieved through stable Repository references/IDs.

### REQ-009 — Generic enumeration

Consumers need to discover Repository content without Repository imposing application-specific classification.

**Expected outcome:** Repository can enumerate Records, Assets, and membership using generic pagination/cursor behavior.

Project-specific filtering, grouping, ranking, or semantic search is not required here.

### REQ-010 — Project independence

The same Repository facts may be used by different Project/Board interpretations over time.

**Expected outcome:** Repository storage and retrieval remain usable without creating, loading, or understanding Project entities.

### REQ-011 — Replaceable persistence

LabourChain deployments need to use different persistence infrastructure without changing the meaning of Repository operations.

**Expected outcome:** an in-memory provider can be used for tests/local development and production providers can be supplied separately without changing the public Repository contract.

Backend-specific identifiers and data structures must not become Repository domain semantics unless a later requirement explicitly makes them so.

### REQ-012 — Lifecycle-safe runtime integration

A Repository plugin may own provider connections or other runtime resources. Hosts need activation, deactivation, reload, and testing to be predictable.

**Expected outcome:** resources owned by Repository are acquired and released through the Cordis lifecycle, with no import-time external side effects or reload leaks.

## 4. MVP acceptance boundary

The first usable Repository version must satisfy `REQ-001` through `REQ-012` only to the depth required for a small-team local/test deployment.

The MVP does **not** require:

- a production MongoDB/Redis provider in this package;
- multiple Repository workspaces in one service instance;
- complex roles or permissions beyond active membership;
- Project APIs;
- full-text or semantic search;
- blockchain archival;
- peer replication;
- UI;
- automatic ingestion from third-party systems.

## 5. Future requirements (not accepted into MVP)

The following are candidates for later requirements and must not be implemented as implicit MVP behavior:

- multi-Repository hosting;
- richer membership roles/capabilities;
- remote/federated Repository synchronization;
- explicit archival of selected runtime data as Assets;
- chain anchoring or archival policies;
- generic query/index capabilities proven necessary by multiple consumers.

Each item requires its own requirement decision before a new spec is written.

## 6. Requirement change rule

A code or spec change that implies a new user-visible capability, changes the Repository boundary, or changes one of the expected outcomes above must update this requirements layer first.

Implementation convenience is not sufficient reason to change a requirement.
