# @labourchain/repository

[中文](./README.md)

> This English README is a translation. The Chinese [`README.md`](./README.md) is the authoritative version.

`@labourchain/repository` is the LabourChain Repository plugin for maintaining a shared workspace for a small team.

Repository maintains worker-to-workspace relationships, accepts recognized Records and Assets, and provides validation, storage, and retrieval capabilities. LabourFlow can submit recognized labour Records to Repository, while Board / Project can later read the stored material for organization and analysis.

The repository is currently in the MVP development stage and is implemented as a Cordis plugin.

## Current feature goal

The first version should let a small team reliably:

- create and identify a Repository workspace;
- add, remove, and inspect workers in the workspace;
- accept and validate recognized Records;
- accept and validate Assets / Asset references;
- preserve accepted content and retrieve it later;
- enumerate workers, Records, and Assets in the workspace.

The single source of truth for product requirements is:

- [`docs/requirements.md`](./docs/requirements.md)

Detailed engineering contracts, boundaries, invariants, and acceptance criteria are projected from those requirements into:

- [`specs/repository-mvp.md`](./specs/repository-mvp.md)

## Development model

This repository uses a three-layer development flow:

```text
Requirements
  docs/requirements.md
    ↓
Spec
  specs/
    ↓
Implementation
  src/ + test/
```

Requirements state what the product needs. The Spec turns those needs into a verifiable engineering contract. Implementation and tests satisfy the Spec.

If implementation work exposes a missing product need, update the requirements first, then revise the Spec and code.

## Repository structure

```text
README.md            Chinese project README (authoritative)
README_EN.md         English translation
AGENTS.md            Agent development instructions (English)
docs/                requirements
specs/               engineering specifications
src/                 Cordis plugin implementation
test/                tests
scripts/             engineering and release checks
.github/              CI and PR configuration
```

`docs/` and `specs/` are development documents maintained in Git and are excluded from the published npm plugin package.

## Development

Requirements:

- Node.js 22.20+ / 24+
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

## Status

The package remains `private: true` until the first Repository Service implementation passes release review.
