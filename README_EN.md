# @labourchain/repository

[中文](./README.md)

> This English README is a translation. The Chinese [`README.md`](./README.md) is the authoritative version.

`@labourchain/repository` is the LabourChain Repository plugin for maintaining a shared workspace for a small team.

Repository maintains worker-to-workspace relationships, accepts recognized Records and Assets, and provides storage, validation, and retrieval capabilities. It serves as the shared fact-storage foundation used by higher-level products such as LabourFlow, Board, and Project, while keeping a stable path for later integration with LabourChain Core signing, packing, and archival capabilities.

The repository is currently in the MVP bootstrap stage and is implemented as a Cordis plugin.

## Current goal

The first version aims to support the following basic operations reliably for a small team:

- initialize and load one Repository workspace;
- maintain worker relationships in the workspace;
- accept and store Records;
- accept and store Assets;
- validate accepted objects through LabourChain Core capabilities;
- retrieve Records and Assets through stable references;
- enumerate members and stored content;
- use replaceable persistence providers.

Detailed requirements are maintained in:

- [`docs/requirements.md`](./docs/requirements.md)
- [`docs/features.md`](./docs/features.md)

Strict behavioral contracts, boundaries, invariants, and acceptance criteria are maintained in:

- [`specs/repository-mvp.md`](./specs/repository-mvp.md)

## Development model

This repository uses a three-layer development process:

```text
Requirements and Features
  docs/
    ↓
Spec
  specs/
    ↓
Implementation
  src/ + test/
```

`docs/` describes what is needed. `specs/` turns those needs into verifiable engineering contracts. Implementation and tests satisfy the accepted Spec.

If implementation work exposes a missing requirement, return to the requirements layer first, then revise the Spec and code.

## Repository structure

```text
README.md            Chinese project README (authoritative)
README_EN.md         English translation
AGENTS.md            Agent development instructions (English)
docs/                requirements and feature documents
specs/               engineering specifications
src/                 Cordis plugin implementation
test/                tests
scripts/             engineering and release checks
.github/              CI and PR configuration
```

`docs/` and `specs/` are development documents maintained in Git and are excluded from the published npm plugin package.

## Development

Requirements:

- Node.js 22.20+
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

`pnpm run check` runs type checking, coverage-gated tests, and the production build. `pnpm run package:check` verifies the final npm tarball so development documents, source files, and tests do not enter the runtime package.

## Status

The package remains `private: true` until the first Repository Service implementation passes release review.
