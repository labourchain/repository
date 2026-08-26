# Repository MVP Specification

- **Status:** Draft
- **Target:** first usable Repository node capability
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)

This file is the umbrella Specification for the Repository MVP. It defines the MVP composition, cross-capability invariants and completion boundary. Stable capability contracts live in separate Specs under this directory.

The Specs are engineering projections of the current Requirements and Architecture. They do not replace product truth or architecture decisions.

## Capability Specs

| Spec | Stable capability boundary |
| --- | --- |
| [`bootstrap.md`](./bootstrap.md) | executable bootstrap and Cordis runtime integration |
| [`repo.md`](./repo.md) | Repo establishment, stable identity, operator and loading |
| [`membership.md`](./membership.md) | operator-controlled Repo contribution membership |
| [`protocol-resolution.md`](./protocol-resolution.md) | exact Protocol identity/version resolution |
| [`contribution.md`](./contribution.md) | Asset contribution, confirmation, commit, staging and recovery |
| [`asset-storage.md`](./asset-storage.md) | durable preservation and retrieval of accepted Assets |
| [`contribution-history.md`](./contribution-history.md) | contribution-history view and derived projection |

These boundaries are capability boundaries, not Story or Task boundaries. A Story may depend on several Specs, and one Spec may be implemented through several Stories and Tasks.

## MVP composition

A usable Repository MVP is formed by a configured Cordis runtime that satisfies all capability Specs required for the following product flow:

```text
start Repository node
  -> establish or load Repo
  -> manage contribution membership
  -> resolve exact Protocol versions
  -> receive Asset + Worker-produced Record + relations
  -> validate required Protocol semantics
  -> satisfy Worker and Repo confirmations
  -> commit canonical contribution
  -> durably retrieve accepted Asset
  -> expose contribution history as a derived view
```

Repository capability may be provided by multiple Cordis plugins. No Spec requires a single Repository mega-service or one plugin per capability document.

## Shared invariants

### Cordis is the runtime plugin model

Repository does not create a second Runner, Hoster, Plugin Manager, Service Container, dependency system or lifecycle system around Cordis.

Protocol plugins, Runtime providers, projections and adapters are all composed through Cordis. A Protocol plugin is a Cordis plugin whose behavior additionally carries stable LabourChain Protocol identity/version semantics.

### Historical Protocol semantics are exact

Historical facts must be interpreted by the exact Protocol identity/version they reference. Missing versions fail explicitly. They must not silently fall back to `latest` or another installed version.

### Record remains a Worker fact

Record is a Worker-produced canonical labour fact. Repository does not create a canonical Record store, `repo.records[]`, general `storeRecord` capability or equivalent ownership model.

### Repository acceptance requires canonical commit and durable Asset retrieval

A contribution is accepted only when:

- the applicable contribution requirements and confirmations are satisfied;
- Core commit has succeeded; and
- the accepted Asset can be durably retrieved.

`COMMITTED` is the Repository contribution acceptance boundary. Later block packing is not part of Repository completion.

### Runtime state does not become canonical by persistence

Staging, cache, index and projection data may be persisted for recovery and performance. Persistence does not turn them into canonical LabourChain facts.

### Recovery converges to canonical state

Runtime restart or crash must not expose uncommitted work as accepted or permanently lose a committed accepted contribution.

When runtime state and canonical facts disagree, recovery must reconcile toward canonical commit state rather than inventing or erasing canonical facts.

### Product boundaries remain external

Personal Repo belongs to LabourFlow. RawEntry recognition and Record drafting belong to LabourFlow or another upper-layer product. Project organization and LabourBoard planning, analysis and presentation remain outside Repository.

## Cross-Spec relationships

The capability Specs depend on each other through contracts rather than ownership:

```text
bootstrap
  -> provides Cordis runtime

repo
  -> provides stable Repo + operator

membership
  -> uses Repo/operator to define contribution eligibility

protocol-resolution
  -> resolves exact historical Protocol implementations

contribution
  -> uses membership + protocol resolution + Core
  -> commits canonical contribution
  -> requires durable Asset retrieval

asset-storage
  -> preserves accepted Asset content

contribution-history
  -> projects committed canonical contribution facts
```

A capability may be implemented by one or more Cordis plugins. These Spec files do not prescribe package boundaries unless an actual protocol/version/lifecycle boundary requires one.

## Shared implementation rules

Implementation must:

- reuse Core identity and Protocol semantics rather than duplicating them;
- fail closed when required Core capability or exact Protocol implementation is unavailable;
- keep concrete database, filesystem and transport choices behind Runtime/plugin boundaries;
- avoid process-global mutable Repository state;
- acquire and dispose plugin-owned resources through Cordis lifecycle ownership;
- avoid prematurely introducing complex ACL, search, synchronization, consensus, settlement or private-proof systems.

Exact TypeScript names, package names, metadata field names, database schemas, HTTP routes and UI are not fixed by the MVP Specs unless a later accepted Requirement or Architecture decision requires them.

## Integrated acceptance

In addition to the acceptance tests defined by each capability Spec, the MVP integration path must demonstrate that:

1. a Repository node can start with its configured Cordis plugins;
2. a Worker can establish a Repo and reload it after restart;
3. the operator can establish persistent membership;
4. a member contribution resolves the exact required Protocol versions;
5. valid confirmations and Core commit produce a committed accepted contribution;
6. its Asset remains retrievable after restart;
7. an interrupted contribution recovers without false acceptance or duplicate canonical commit;
8. the committed contribution appears in contribution history;
9. the same flow does not require Personal Repo, Project or Board concepts;
10. plugin activation/disposal does not leak or duplicate owned resources.

An in-memory-only path may be used for isolated unit or contract tests but does not by itself satisfy the usable Repository MVP because restart and recovery behavior are part of the product requirements.

## MVP exclusions

The Spec set does not require:

- Personal Repo product behavior;
- Project or Board planning, analysis or presentation;
- public/common usage accounting or revenue distribution;
- general Private Repo permission systems;
- zero-knowledge proofs;
- advanced ACL or role hierarchies;
- advanced search, full-text indexing or large-scale query infrastructure;
- block-packing internals;
- node synchronization or consensus;
- a specific database, filesystem, HTTP API or UI;
- a fixed monorepo package layout.

## Implementation completion

Repository MVP implementation is complete when the configured bootstrap and Cordis plugin set satisfy this umbrella Spec and each applicable capability Spec, the persistent runtime path demonstrates restart and recovery behavior, exact Protocol-version resolution is verified, meaningful tests pass, and build/package checks succeed on supported Node versions.

## Spec evolution

A new Task does not require a new Spec.

Create or split a Spec when a capability has a stable independent contract, meaningful invariants and an evolution boundary worth maintaining separately. Stories and Tasks are delivery slices over these contracts.

If implementation exposes a missing product need, update Requirements first. If it exposes a structural issue without changing product behavior, update Architecture first. Then update the affected capability Spec before changing implementation behavior.
