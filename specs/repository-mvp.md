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
| [`contribution.md`](./contribution.md) | Asset contribution, confirmation, Repository commit, staging and recovery |
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
  -> durably accept exact resulting Records
  -> durably retrieve accepted Asset
  -> report Repository COMMITTED / accepted
  -> later observe Block-confirmation status when available
  -> expose contribution history with pending-chain vs block-confirmed state
```

Repository capability may be provided by multiple Cordis plugins. No Spec requires a single Repository mega-service or one plugin per capability document.

A usable composition requires a durable Record ingress/journal for pre-pack accepted Records. Chain-state/Block-confirmation access is a distinct runtime capability used to identify actual chain inclusion. These may share an implementation later, but Repository does not conflate their semantics.

## Shared invariants

### Cordis is the runtime plugin model

Repository does not create a second Runner, Hoster, Plugin Manager, Service Container, dependency system or lifecycle system around Cordis.

Protocol implementations, Runtime providers, projections and adapters are all composed through Cordis. A Protocol implementation is a Cordis plugin that implements one stable LabourChain Protocol identity/version.

### Historical Protocol semantics are exact

Historical facts must be interpreted by the exact Protocol identity/version they reference. Missing versions fail explicitly. They must not silently fall back to `latest` or another installed version.

### Record remains a Worker fact

Record is a Worker-produced LabourChain fact with stable identity/signature semantics supplied by Core. Repository does not turn Record into a Repository-owned domain object or maintain a canonical `repo.records[]` collection.

### Durable Record ingress is not Block confirmation

A configured Repository node must be able to durably retain exact signed Records that belong to Repository-accepted work before those Records are packed into a Block.

Successful durable ingress means the Record can survive restart and continue toward chain inclusion. It does not mean the Record has already been confirmed by the chain.

### Repository acceptance is distinct from chain confirmation

A contribution reaches Repository `COMMITTED` only when:

- the applicable contribution requirements and confirmations are satisfied;
- every required exact Record is durably accepted by the Record journal; and
- the accepted Asset can be durably retrieved.

`COMMITTED` is the Repository product acceptance boundary.

`PACKED` means the relevant Records were included in a valid Block and therefore have chain-confirmation status. Later Block packing is not required before Repository returns accepted.

### Runtime state types remain distinct

Repository Runtime may persist several kinds of state with different roles:

```text
accepted Record journal
    -> durable and required until safe chain handoff/inclusion
    -> not itself Block confirmation

staging
    -> in-flight processing/recovery before Repository commit

index/cache/projection
    -> derived query acceleration
    -> rebuildable/reconcilable from durable sources
```

Persistence alone does not turn staging/index/cache/projection into chain-confirmed facts.

### Recovery converges to durable Repository state

Runtime restart or crash must not expose pre-commit work as accepted or lose already Repository-committed work.

Recovery must reconcile exact Record-journal state, Asset durability and staging so repeated recovery does not create duplicate Record acceptance, singular confirmations or Asset finalization.

Block-confirmation status is reconciled separately from chain state when that capability is available.

### Product boundaries remain external

Personal Repo belongs to LabourFlow. RawEntry recognition and Record drafting belong to LabourFlow or another upper-layer product. Project organization and LabourBoard planning, analysis and presentation remain outside Repository.

## Cross-Spec relationships

The capability Specs depend on each other through contracts rather than ownership:

```text
bootstrap
  -> provides Cordis runtime

durable Record ingress / journal
  -> Runtime/composition dependency
  -> retains exact accepted Records across restart

chain-state / Block-confirmation access
  -> Runtime/composition dependency
  -> tells whether RecordIds are included in accepted Blocks

repo
  -> uses Core EntityPublicKey + establishment Record
  -> persists accepted establishment Record through durable ingress
  -> derives initial operator from Record.createdBy

membership
  -> uses Repo/operator to define contribution eligibility
  -> membership facts follow the same accepted-vs-packed distinction

protocol-resolution
  -> resolves exact historical Protocol implementations

contribution
  -> uses membership + protocol resolution + durable Record ingress
  -> reaches Repository COMMITTED before Block packing
  -> requires durable Asset retrieval

asset-storage
  -> preserves accepted Asset content

contribution-history
  -> projects Repository-committed contributions
  -> augments them with Block-confirmation status when available
```

A capability may be implemented by one or more Cordis plugins. These Spec files do not prescribe package boundaries unless an actual protocol/version/lifecycle boundary requires one.

## Shared implementation rules

Implementation must:

- reuse Core Protocol, Entity, Record, signature and Block semantics rather than duplicating them;
- persist exact accepted Records through an explicit Runtime/composition dependency rather than a Repository-domain `records[]` model;
- distinguish durable pending-chain acceptance from actual Block confirmation;
- fail closed when required durable ingress, Core primitive or exact Protocol implementation is unavailable;
- keep concrete database, filesystem and transport choices behind Runtime/plugin boundaries;
- avoid process-global mutable Repository state;
- acquire and dispose plugin-owned resources through Cordis lifecycle ownership;
- avoid prematurely introducing complex ACL, search, synchronization, consensus, settlement or private-proof systems.

Exact TypeScript names, package names, metadata field names, database schemas, HTTP routes and UI are not fixed by the MVP Specs unless a later accepted Requirement or Architecture decision requires them.

## Integrated acceptance

In addition to the acceptance tests defined by each capability Spec, the MVP integration path must demonstrate that:

1. a Repository node can start with its configured Cordis plugins;
2. a Worker can establish a Repo from an exact establishment Record and reload it after restart;
3. the operator can establish persistent membership;
4. a member contribution resolves the exact required Protocol versions;
5. valid confirmations, durable Record ingress and durable Asset retrieval produce Repository `COMMITTED` / accepted state;
6. the accepted Asset remains retrievable after restart;
7. an interrupted contribution recovers without false acceptance or duplicate durable Record acceptance;
8. a Repository-committed contribution appears in contribution history as pending-chain before Block inclusion;
9. when chain-state access reports Block inclusion, the same history entry can be represented as block-confirmed without changing its Repository acceptance identity;
10. the same flow does not require Personal Repo, Project or Board concepts;
11. plugin activation/disposal does not leak or duplicate owned resources.

An in-memory-only path may be used for isolated unit or contract tests but does not by itself satisfy the usable Repository MVP because restart and recovery behavior are part of the product requirements.

Block packing itself is outside this Repository MVP. Integration tests may use a narrow fake/fixture chain-state adapter to test status transitions without implementing a packer or consensus system.

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
- a Repository-domain canonical Record store or second blockchain;
- a specific database, filesystem, HTTP API or UI;
- a fixed monorepo package layout.

## Implementation completion

Repository MVP implementation is complete when the configured bootstrap and Cordis plugin set satisfy this umbrella Spec and each applicable capability Spec, the durable Record ingress path demonstrates restart/recovery behavior, pending-chain and Block-confirmed status are not conflated, exact Protocol-version resolution is verified, meaningful tests pass, and build/package checks succeed on supported Node versions.

## Spec evolution

A new Task does not require a new Spec.

Create or split a Spec when a capability has a stable independent contract, meaningful invariants and an evolution boundary worth maintaining separately. Stories and Tasks are delivery slices over these contracts.

If implementation exposes a missing product need, update Requirements first. If it exposes a structural issue without changing product behavior, update Architecture first. Then update the affected capability Spec before changing implementation behavior.
