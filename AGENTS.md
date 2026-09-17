# AGENTS.md

## Repository context

This repository develops LabourChain Repository using Cordis as its runtime plugin model.

The authoritative human-facing project description is the Chinese [`README.md`](./README.md). [`README_EN.md`](./README_EN.md) is a translation.

The long-lived domain baseline is documented under [`docs/concepts/`](./docs/concepts/). Product behavior is defined by [`docs/requirements.md`](./docs/requirements.md). System structure and plugin boundaries are defined by [`docs/architecture.md`](./docs/architecture.md). Engineering contracts are defined under [`specs/`](./specs/).

The current model treats Worker / Member as the labour subject, Record as living labour, Asset as objectified labour output, Repo as an Asset warehouse that participates in contribution confirmation, and Project as an organizational form over workers, Records and Assets.

Do not replace this model with a conventional CRUD container model for convenience.

## Source hierarchy

Development follows:

```text
Concepts (`docs/concepts/`)
    long-lived domain baseline

Requirements (`docs/requirements.md`)
        ↓
Design / Architecture (`docs/architecture.md`)
        ↓
Specifications (`specs/`)
        ↓
Stories
        ↓
Tasks / Implementation (`src/`, `test/`)
```

Concepts do not directly replace Requirements. Requirements define product truth. Architecture constrains how those requirements are structured and executed. Specs are engineering projections of both Requirements and Architecture.

Specs are organized by stable capability boundary, not by Task. [`specs/repository-mvp.md`](./specs/repository-mvp.md) is the umbrella Spec for MVP composition and shared invariants. Capability Specs define bootstrap, Repo, membership, Protocol resolution, contribution, Asset storage and contribution history.

A Story is a deliverable development increment and may depend on several Specs. Tasks are concrete implementation work for a Story. Do not create one Spec per Task.

If Concepts, Requirements, Architecture, Spec or implementation become inconsistent, correct the mismatch at the appropriate upstream layer before continuing downstream.

## Cordis architecture

Repository follows Cordis's plugin-first model. Do not create a second plugin framework around Cordis.

Plugin discovery, dependency handling, Context, Service, Effect and lifecycle ownership belong to Cordis. Avoid introducing Repository-specific Runner, Hoster, Plugin Manager, Service Container or lifecycle abstractions that duplicate Cordis.

A LabourChain Protocol plugin is a Cordis plugin whose behavior carries stable on-chain protocol semantics and an explicit protocol version. It is not a parallel plugin type system.

Protocol versions are stable historical semantics. When a new protocol version changes those semantics, implement the new version separately rather than changing the meaning of the old version in place. A node may need multiple protocol versions simultaneously to interpret historical facts.

Historical facts must be handled by the exact protocol identity and version they reference. Do not silently route them to `latest`.

## Bootstrap

The executable bootstrap is special only because it has a process entry point and starts a Cordis application.

Its stable executable version is declared using the Protocol format, so a running node is an instance of a particular Bootstrap Protocol version. After Cordis starts, normal capabilities are loaded and managed through Cordis plugins.

Bootstrap uses the compatible Cordis 4.x range beginning at `^4.0.2` and shares the host Cordis module instance with loaded plugins. Do not bundle a private second Cordis runtime into the executable.

Do not invent a Root Protocol, protocol-of-protocols runtime layer, self-registering Runner registry or other recursive bootstrap model unless a real requirement later proves one necessary.

See [`specs/bootstrap.md`](./specs/bootstrap.md) for the executable runtime contract.

## Repository model

Repository does not need one mega-service that owns all behavior.

Repository capability can emerge from multiple Cordis plugins implementing Repo, membership, Asset, relation, confirmation, contribution, storage, projection or adapter responsibilities according to their real protocol and lifecycle boundaries.

Do not split plugins mechanically by CRUD method, Requirement, Story, Task or Spec file. Prefer boundaries that share protocol semantics, versioning and lifecycle. Closely coupled protocols may live together when they have no useful independent lifecycle.

Generic Asset and Asset-Record relation capabilities should remain reusable outside Repository. LabourFlow Personal Repo may reuse such protocols without loading the complete Repository product runtime.

Personal Repo itself belongs to LabourFlow, not to this Repository package as a special Repository mode.

## Record durability and chain-confirmation boundary

Core defines deterministic Plugin, Entity, Record and Block primitives. It does not by itself imply a Record database, queue, node or Repository-specific commit service.

Repository must distinguish:

```text
Durable Record ingress / journal
    -> exact accepted Records survive restart before Block packing
    -> supports Repository COMMITTED / accepted state
    -> does not imply chain confirmation

Chain-state / Block-confirmation access
    -> tells whether RecordIds were included in accepted Blocks
    -> supplies chain confirmation/order
```

These can later share one node-runtime implementation, but their semantics must remain distinct.

Do not fill either dependency by making the Repo domain own a canonical `repo.records[]`, generic Repository Record database, second blockchain or duplicated Cordis lifecycle system.

Repo identity uses Core `EntityPublicKey` semantics. The Repo establishment Record carries the Repo identity in its payload and uses `Record.createdBy` as the initial MVP operator. `Entity.introducedBy` is not ownership, membership or operator state.

Runtime Repo indexes may persist `Repo identity -> establishment RecordId` for efficient load/restart behavior, but the index remains replaceable and does not override the exact establishment Record.

## Contribution model

A Worker produces Record and may produce or modify Asset outside Repository. Repository receives an Asset contribution and participates in Repo-side confirmation of the related labour.

The current Repository progression is:

```text
STAGED
  ↓ required domain confirmations satisfied
CONFIRMED
  ↓ exact Records durable + accepted Asset durable
COMMITTED
  ↓ later valid Block inclusion
PACKED
```

`COMMITTED` is the Repository product acceptance boundary. It can be pending-chain.

`PACKED` is Block-confirmed chain status. It is not required before Repository returns accepted.

Never describe a merely durable pending Record as already block-confirmed/canonical-chain state.

STAGED is temporary Runtime state. A usable deployment requires durable recovery information, but persistence alone does not make staging accepted.

Recovery must converge toward the durable Repository state: pre-commit work must not appear accepted; already durably accepted Records/Assets must not be lost or duplicated. Block-confirmation status is reconciled separately from chain state.

See [`specs/contribution.md`](./specs/contribution.md) and [`specs/asset-storage.md`](./specs/asset-storage.md).

Repository does not own all chain Records. Contribution history is a projection over Repository-accepted records/relations plus optional Block-confirmation evidence. Do not introduce canonical `repo.records[]` or equivalent Repository-owned chain-history models.

## Runtime providers

Storage, durable Record ingress, staging, cache, index, projection and external adapters are normal Cordis plugin/provider concerns unless they themselves define stable chain protocol semantics.

Runtime persistence must not silently redefine Asset, Record, confirmation, identity or contribution semantics.

Not every Runtime datum is equally disposable:

- accepted pending Record journal is durable operational state until safe chain handoff/inclusion;
- staging is recoverable in-flight state;
- indexes/caches/projections are derived and should be repairable/rebuildable.

Concrete database, filesystem and index choices are not fixed by the current Specs.

Do not create a standalone provider Spec merely because multiple capabilities need persistence. Each capability Spec defines the persistence behavior it requires; provider package boundaries should follow actual implementation and lifecycle needs.

## Engineering discipline

Do not prematurely lock:

- final npm package names or monorepo layout;
- Protocol metadata field names;
- database schemas;
- REST / HTTP routes;
- UI;
- complex ACL or role systems;
- search infrastructure;
- Project / Board behavior;
- block packing internals;
- node synchronization;
- private-proof or settlement mechanisms.

Do not add abstractions merely to make diagrams or Spec trees look complete. Reuse Cordis capabilities unless LabourChain has a real semantic requirement that Cordis does not cover.

## Testing discipline

Tests protect Requirements, Spec contracts, meaningful protocol behavior, recovery behavior, Cordis lifecycle behavior and reproduced regressions. Test count, CI job count and coverage percentage are not quality goals by themselves.

Derive acceptance tests from the capability Specs relevant to the Story being implemented. Do not mechanically execute every test idea in every Spec for every Task.

## Current implementation status

Bootstrap Story #4 is complete and merged on `main`.

Story #5 is active on `feat/5-repo`. Its Repo identity/operator and Repository-commit-vs-chain-confirmation design alignment is being completed before domain implementation is added.

Issue #15 tracks ownership of the reusable durable Record ingress/journal and chain-state adapter boundaries exposed by #5. Do not invent a pre-pack canonical database merely to unblock tests.

The current package remains private.

## Validation

Use the relevant project checks when the corresponding integration is available and report actual evidence.

Core deterministic primitives are available in `labourchain/core-plugins`, but full Repository integration cannot be claimed until the required Runtime provider boundaries are available and persistent restart behavior is demonstrated.
