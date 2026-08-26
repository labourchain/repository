# @labourchain/repository

[中文](./README.md)

> This English README is a translation. The Chinese [`README.md`](./README.md) is the authoritative version.

`@labourchain/repository` is the LabourChain Repository project.

In the LabourChain model, the Worker is the subject of labour, a Record represents living labour, and an Asset represents objectified labour output. A Repo preserves Assets and participates in Repo-side confirmation of the labour related to contributed Assets. Repo contribution history is projected from on-chain labour facts and relations, while runtime components may cache those views for normal use.

Repository uses Cordis as its runtime plugin model. Repository capability emerges from multiple Cordis plugins. A plugin that defines stable on-chain semantics is additionally declared as a versioned LabourChain Protocol. Repository does not build a separate Runner, Hoster, or mega-service framework around Cordis.

Requirements, Architecture, and the MVP Specs have now completed one round of re-projection. The next development stage derives Stories and engineering Tasks from the stable capability Specs.

## Documentation

`docs/` is the long-term project documentation space. It contains the domain baseline, product requirements, and system architecture.

Main entry points:

- [`docs/concepts/`](./docs/concepts/): long-lived domain baseline and standard terminology;
- [`docs/requirements.md`](./docs/requirements.md): the single source of truth for Repository product requirements;
- [`docs/architecture.md`](./docs/architecture.md): Design / Architecture for plugin boundaries, runtime structure, and data flow;
- [`specs/repository-mvp.md`](./specs/repository-mvp.md): MVP umbrella Spec for capability composition, shared invariants, and completion criteria;
- [`specs/`](./specs/): capability Specs split by stable functional boundary.

The current capability Specs cover bootstrap, Repo, membership, Protocol resolution, contribution, Asset storage, and contribution history.

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
+ loaded Protocol plugins
+ Runtime / provider plugins
+ configuration
```

Bootstrap is stable executable code with a process entry point. It creates a Cordis application when started, and its stable version is also declared using the Protocol format. After Cordis starts, Repository protocols, storage, index, projection, and adapters continue to be organized as Cordis plugins.

A Protocol plugin is not a second plugin framework. It is a Cordis plugin whose behavior carries long-lived on-chain semantics and version constraints. Discovery, dependencies, Context, Service, Effect, and lifecycle remain Cordis concerns.

See [`docs/architecture.md`](./docs/architecture.md).

## Repository structure

Documentation and Specs now follow the SDD hierarchy. Final package boundaries are still derived later from accepted protocol and lifecycle boundaries rather than from Spec file count.

```text
README.md               Chinese project README (authoritative)
README_EN.md            English translation
AGENTS.md               Agent development instructions
docs/concepts/          domain baseline and terminology
docs/requirements.md    product requirements source of truth
docs/architecture.md    Design / Architecture
specs/                  MVP umbrella + stable capability Specs
src/                    current minimal Cordis scaffold
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

The existing checks still mainly validate the current scaffold. They do not imply that the Repository MVP implementation is complete.

## Status

The current package remains `private: true`.

Requirements, Architecture, and capability Specs have completed the current re-projection round. `src/` is still a minimal Cordis scaffold. Implementation should now proceed from Specs into Stories and Tasks rather than restoring the previous single Repository Service model.
