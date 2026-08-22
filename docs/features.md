# Repository Feature Catalog

- **Status:** MVP feature map
- **Source:** [`requirements.md`](./requirements.md)
- **Formal contract:** [`../specs/0001-repository-mvp.md`](../specs/0001-repository-mvp.md)

This document converts product requirements into discrete capabilities before they are formalized as service contracts.

A feature describes **what capability exists**. It does not prescribe a final TypeScript API, persistence schema, or UI.

## Feature map

| Feature | Capability | Requirements | MVP |
| --- | --- | --- | --- |
| FEAT-001 | Repository workspace identity/load | REQ-001 | Yes |
| FEAT-002 | Worker membership management | REQ-002 | Yes |
| FEAT-003 | Contribution authorization | REQ-003 | Yes |
| FEAT-004 | Record acceptance | REQ-004, REQ-006, REQ-007 | Yes |
| FEAT-005 | Asset acceptance | REQ-005, REQ-006, REQ-007 | Yes |
| FEAT-006 | Stable object retrieval | REQ-008 | Yes |
| FEAT-007 | Generic content enumeration | REQ-009, REQ-010 | Yes |
| FEAT-008 | Replaceable persistence provider | REQ-011 | Yes |
| FEAT-009 | Cordis lifecycle integration | REQ-012 | Yes |

## FEAT-001 — Repository workspace identity/load

Repository exposes enough workspace information for clients to know which Repository instance they are using.

### Includes

- initialize or load one configured Repository workspace;
- expose stable workspace identity/basic metadata required by consumers.

### Does not include

- hosting multiple repositories in one service instance;
- project metadata;
- organization-management UI.

## FEAT-002 — Worker membership management

Repository maintains the active worker relationships that define who belongs to the workspace.

### Includes

- activate/add membership;
- deactivate/remove membership;
- inspect whether a worker is active;
- enumerate current membership.

### Does not include

- role-based authorization;
- organization hierarchy;
- Project membership.

## FEAT-003 — Contribution authorization

Repository checks active membership before accepting persistent contributions.

### Includes

- authorize a contributor against Repository membership;
- reject non-member contributions before persistence;
- guarantee rejected authorization leaves no partially accepted object.

### Does not include

- a general-purpose permissions engine;
- authentication/login UX;
- protocol-level signature verification owned by Core.

## FEAT-004 — Record acceptance

Repository accepts an already-recognized Record as shared Repository content.

### Input assumption

The caller has already produced a recognized Record. Repository does not receive RawEntry as an alternate input form.

### Behavior

1. verify contributor membership;
2. invoke Core validation;
3. reject unauthorized/invalid input without partial persistence;
4. persist the accepted Record through the configured provider;
5. return a stable Repository reference.

### Does not include

- natural-language recognition;
- protocol detection;
- project classification;
- semantic enrichment.

## FEAT-005 — Asset acceptance

Repository accepts an explicitly captured/recognized Asset or Asset reference as shared Repository content.

### Behavior

1. verify contributor membership;
2. invoke Core validation appropriate to the Asset representation;
3. reject unauthorized/invalid input without partial persistence;
4. persist content/metadata/reference according to the configured provider and protocol;
5. return a stable Repository reference.

### Does not include

- automatically archiving caches, API responses, temporary files, LLM context, or indexes;
- deciding whether an arbitrary runtime object should become an Asset.

## FEAT-006 — Stable object retrieval

Consumers can retrieve accepted Repository content through stable Repository references without knowing the concrete backend.

### Includes

- get an accepted Record by stable reference/ID;
- get an accepted Asset by stable reference/ID;
- explicit not-found behavior.

### Does not include

- backend-native query APIs;
- Project-specific lookups.

## FEAT-007 — Generic content enumeration

Consumers can enumerate Repository facts without requiring project semantics.

### Includes

- list Records;
- list Assets;
- list membership;
- generic pagination/cursor behavior.

### Allowed filters

Only generic protocol/storage metadata that does not introduce Project or application semantics.

### Does not include

- Project grouping;
- planning/status filters;
- semantic ranking;
- Board-specific projections.

## FEAT-008 — Replaceable persistence provider

Repository orchestration uses a persistence capability rather than binding public behavior to one database.

### MVP provider

An in-memory provider is sufficient for tests and local development.

### Provider obligations

- preserve accepted object semantics;
- provide the persistence/retrieval operations required by FEAT-001 through FEAT-007;
- avoid partial accepted state when authorization or validation fails;
- expose failures in a backend-neutral form to the Repository service.

### Does not include

- production MongoDB/Redis/SQL implementation in this repository;
- exposing collection/key/table details through the public Repository service.

## FEAT-009 — Cordis lifecycle integration

Repository behaves as a well-owned Cordis capability.

### Includes

- explicit service/provider dependencies;
- no external work at module import;
- lifecycle-owned provider/resource acquisition;
- cleanup on deactivation;
- no duplicated handles on reload;
- LabourChain-prefixed service naming.

### Does not include

- introducing Cordis abstractions into pure Core protocol semantics;
- global singleton state as a substitute for a service/provider.

## Traceability rule

A formal spec must state which feature IDs it covers.

Implementation PRs should identify the governing `SPEC-*`; the spec provides the trace back to `FEAT-*` and `REQ-*`.

The intended chain is:

```text
REQ-* -> FEAT-* -> SPEC-* -> tests/code
```

A new implementation capability with no feature/requirement trace is considered scope expansion and should move back to the requirements layer first.
