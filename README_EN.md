# @labourchain/repository

[中文](./README.md)

> This English README is a translation. The Chinese [`README.md`](./README.md) is the authoritative version.

`@labourchain/repository` is the LabourChain Repository project.

In the LabourChain model, the Worker is the subject of labour, a Record represents living labour, and an Asset represents objectified labour output. A Repo preserves Assets and participates in Repo-side confirmation of the labour related to contributed Assets. Repo contribution history is projected from on-chain labour facts and relations, while runtime components may cache those views for normal use.

Repository uses Cordis as its runtime plugin model. Repository capability emerges from multiple Cordis plugins. A plugin that defines stable on-chain semantics is additionally declared as a versioned LabourChain Protocol. Repository does not build a separate Runner, Hoster, or mega-service framework around Cordis.

The project is currently in the Design / Architecture convergence stage. The existing Spec and implementation scaffold are not the latest architecture source of truth.

## Documentation

`docs/` is the long-term project documentation space. It contains the domain baseline, product requirements, and system architecture.

Main entry points:

- [`docs/concepts/`](./docs/concepts/): long-lived domain baseline and standard terminology;
- [`docs/requirements.md`](./docs/requirements.md): the single source of truth for Repository product requirements;
- [`docs/architecture.md`](./docs/architecture.md): Design / Architecture for plugin boundaries, runtime structure, and data flow;
- [`specs/repository-mvp.md`](./specs/repository-mvp.md): engineering projection of Requirements and Architecture. It currently predates the latest Design and will be reviewed later.

If Concepts, Requirements, Architecture, Spec, or implementation diverge, correct the mismatch at the appropriate upstream layer instead of silently choosing an interpretation in code.

## Development model

```text
Concepts (`docs/concepts/`)
    long-lived domain baseline

Requirements (`docs/requirements.md`)
        ↓
Design / Architecture (`docs/architecture.md`)
        ↓
Spec (`specs/`)
        ↓
Task / Implementation (`src/`, `test/`)
```

Requirements define product behavior. Architecture defines system structure, plugin boundaries, dependency direction, and data flow. The Spec projects both into an executable engineering contract. Tasks and implementation satisfy that contract.

The current phase is focused on reviewing Requirements and Architecture. `specs/repository-mvp.md` should not be incrementally patched to follow intermediate design discussion; it will be re-projected after the upstream layers are accepted.

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

The final package boundaries are not fixed yet. The current repository mainly contains documentation, a draft Spec, and a minimal Cordis scaffold:

```text
README.md               Chinese project README (authoritative)
README_EN.md            English translation
AGENTS.md               Agent development instructions
docs/concepts/          domain baseline and terminology
docs/requirements.md    product requirements source of truth
docs/architecture.md    Design / Architecture
specs/                  engineering Spec, pending re-projection
src/                    current minimal Cordis scaffold
test/                   tests
scripts/                engineering and release checks
.github/                 CI and PR configuration
```

Final npm package names, monorepo layout, and Protocol plugin boundaries will be decided after Architecture acceptance and then projected into Spec / Task.

## Development

Requirements:

- Node.js 22.20+ / 24+
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

The existing checks validate the current scaffold. They do not imply that the latest Repository Architecture is already implemented.

## Status

The current package remains `private: true`.

Requirements and Architecture are being converged. The old `specs/repository-mvp.md` and `src/` scaffold remain for later re-projection and implementation, and must not be interpreted as an accepted single Repository Service architecture.
