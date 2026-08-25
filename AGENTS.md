# AGENTS.md

## Repository context

This repository develops LabourChain Repository using Cordis as its runtime plugin model.

The authoritative human-facing project description is the Chinese [`README.md`](./README.md). [`README_EN.md`](./README_EN.md) is a translation.

The long-lived domain baseline is documented under [`docs/concepts/`](./docs/concepts/). Product behavior is defined by [`docs/requirements.md`](./docs/requirements.md). System structure and plugin boundaries are defined by [`docs/architecture.md`](./docs/architecture.md).

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
Specification (`specs/`)
        ↓
Task / Implementation (`src/`, `test/`)
```

Concepts do not directly replace Requirements. Requirements define product truth. Architecture constrains how those requirements are structured and executed. Specs are projections of both Requirements and Architecture.

The current `specs/repository-mvp.md` predates the latest Architecture and must not be treated as the authoritative runtime design until it is explicitly re-projected. Do not update the Spec or start domain implementation merely to make it match an intermediate discussion.

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

Do not invent a Root Protocol, protocol-of-protocols runtime layer, self-registering Runner registry or other recursive bootstrap model unless a real requirement later proves one necessary.

## Repository model

Repository does not need one mega-service that owns all behavior.

Repository capability can emerge from multiple Cordis plugins implementing Repo, membership, Asset, relation, confirmation, contribution, storage, projection or adapter responsibilities according to their real protocol and lifecycle boundaries.

Do not split plugins mechanically by CRUD method or Requirement. Prefer boundaries that share protocol semantics, versioning and lifecycle. Closely coupled protocols may live together when they have no useful independent lifecycle.

Generic Asset and Asset-Record relation capabilities should remain reusable outside Repository. LabourFlow Personal Repo may reuse such protocols without loading the complete Repository product runtime.

Personal Repo itself belongs to LabourFlow, not to this Repository package as a special Repository mode.

## Contribution model

A Worker produces Record and may produce or modify Asset outside Repository. Repository receives an Asset contribution and participates in Repo-side confirmation of the related labour.

The current contribution progression is:

```text
STAGED
  ↓ required confirmations satisfied
CONFIRMED
  ↓ accept / commit succeeds
COMMITTED
  ↓ later Core block packing
PACKED
```

Only COMMITTED means the Repo has accepted the contribution. PACKED is a later Core concern.

STAGED is runtime state, not a canonical chain fact. Runtime providers may persist staging for recovery, but persistence does not make it canonical.

Repository does not own canonical Record storage. Contribution history is a projection of chain facts and relations. Do not introduce canonical `storeRecord`, `getRecord`, `repo.records[]` or equivalent Repository-owned history models.

## Runtime providers

Storage, cache, index, staging, projection and external adapters are normal Cordis plugin/provider concerns unless they themselves define stable chain protocol semantics.

Runtime persistence must not silently redefine Asset, Record, confirmation, identity or contribution semantics. Cache and projection data must remain distinguishable from canonical facts.

Concrete database, filesystem and index choices are not fixed by the current Architecture.

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

Do not add abstractions merely to make diagrams look complete. Reuse Cordis capabilities unless LabourChain has a real semantic requirement that Cordis does not cover.

## Testing discipline

Tests protect Requirements, Spec contracts, meaningful protocol behavior, Cordis lifecycle behavior and reproduced regressions. Test count, CI job count and coverage percentage are not quality goals by themselves.

Do not design implementation tests from the stale MVP Spec until the Spec has been re-projected from the accepted Requirements and Architecture.

## Current implementation status

`src/` currently contains only a minimal Cordis scaffold. It is not evidence that the final Architecture should be a single Repository service.

The current package remains private. Do not begin broad implementation until Requirements and Architecture are accepted and `specs/repository-mvp.md` has been rewritten from them.

## Validation

When implementation work resumes, use the relevant project checks and report actual evidence. Do not claim completion without validation.
