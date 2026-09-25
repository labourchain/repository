# @labourchain/repository

[中文](./README.md)

> This English README is a translation. The Chinese [`README.md`](./README.md) is the authoritative version.

`@labourchain/repository` is the LabourChain Repository project.

In the LabourChain model, the Worker is the subject of labour, a Record represents living labour, and an Asset represents objectified labour output. A Repo preserves Assets and participates in Repo-side confirmation of the labour related to contributed Assets. Repo contribution history is projected from on-chain labour facts and relations, while runtime components may cache those views for normal use.

Repository uses Cordis as its runtime plugin model. Repository capability emerges from multiple Cordis plugins. Stable semantics that must remain historically addressable on chain are declared as versioned LabourChain Protocols and implemented by Cordis plugins. Repository does not build a separate Runner, Hoster, or mega-service framework around Cordis.

Requirements, Architecture, and the MVP Specs have completed the current re-projection round. Bootstrap and the durable Record journal are merged, Core Protocols v0.1.0 are released, and draft PR #29 now implements the minimum Member Protocol plus Repo establishment/reload pending independent review/merge.

## Documentation

`docs/` is the long-term project documentation space. It contains the domain baseline, product requirements, and system architecture.

Main entry points:

- [`docs/concepts/`](./docs/concepts/): long-lived domain baseline and standard terminology;
- [`docs/requirements.md`](./docs/requirements.md): the single source of truth for Repository product requirements;
- [`docs/architecture.md`](./docs/architecture.md): Design / Architecture for plugin boundaries, runtime structure, and data flow;
- [`specs/repository-mvp.md`](./specs/repository-mvp.md): MVP umbrella Spec for capability composition, shared invariants, and completion criteria;
- [`specs/`](./specs/): capability Specs split by stable functional boundary.

The current capability Specs cover bootstrap, Repo, Protocol resolution, contribution, Asset storage, and contribution history. Contributor/member grouping is a product or local-software view rather than an on-chain membership capability.

If Concepts, Requirements, Architecture, Spec, or implementation diverge, correct the mismatch at the appropriate upstream layer instead of silently choosing an interpretation in code.

## Development model

```text
Concepts (`docs/concepts/`)
    long-lived domain baseline

Requirements (`docs/requirements.md`)
        ↓
Design / Architecture (`docs/architecture.md`)
        ↓
Specs (`specs/`)
        ↓
Stories
        ↓
Tasks / Implementation (`src/`, `test/`)
```

Requirements define product behavior. Architecture defines system structure, plugin boundaries, dependency direction, and data flow. Specs project those into stable capability contracts. Stories are deliverable development increments. Tasks are the concrete engineering work needed to complete Stories.

Specs are not split one-for-one by Task. One stable capability may support multiple Stories, and one Story may be constrained by several Specs.

## Architecture overview

Repository follows Cordis's plugin-first model.

```text
Repository Node
=
Bootstrap Protocol instance
+ Cordis
+ loaded Protocol implementations (Cordis plugins)
+ Runtime / provider plugins
+ configuration
```

Bootstrap is stable executable code with a process entry point. Its source currently carries the human-readable `repository.bootstrap@0.1.0` Protocol reference; under Core v0.1.0, exact Protocol identity additionally requires the built descriptor and ProtocolHash. After Cordis starts, Repository protocols, storage, index, projection, and adapters continue to be organized as Cordis plugins.

The current Bootstrap provides the executable shell and a programmatic composition API. The concrete Repository product composition is not yet fixed in the executable, and this Story does not introduce an additional configuration loader.

Protocol does not form a second plugin framework. Each Protocol's executable implementation remains a Cordis plugin. Discovery, dependencies, Context, Service, Effect, and lifecycle remain Cordis concerns.

See [`docs/architecture.md`](./docs/architecture.md).

## Repository structure

Documentation and Specs follow the SDD hierarchy. Final package boundaries are still derived from accepted protocol and lifecycle boundaries rather than from Spec file count.

```text
README.md               Chinese project README (authoritative)
README_EN.md            English translation
AGENTS.md               Agent development instructions
docs/concepts/          domain baseline and terminology
docs/requirements.md    product requirements source of truth
docs/architecture.md    Design / Architecture
specs/                  MVP umbrella + stable capability Specs
src/                    Bootstrap runtime and later Repository capabilities
test/                   tests
scripts/                engineering and release checks
.github/                 CI and PR configuration
```

## Development

Requirements:

- Node.js 22.20+ / 24+
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

The current checks mainly protect the Bootstrap runtime, Cordis lifecycle, and package executable boundary. They do not imply that the Repository MVP implementation is complete.

## Status

The current package remains `private: true`.

Bootstrap, the durable Record journal, `member.identity`, and `repo.establishment@0.1.0` are complete. Exact Protocol resolution, Asset, contribution, recovery, and history remain; chain-level Repo membership has been removed from the MVP.
