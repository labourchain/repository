# @labourchain/repository

[中文](./README.md)

> This English README is a translation. The Chinese [`README.md`](./README.md) is the authoritative version.

`@labourchain/repository` is the LabourChain repository plugin.

In the LabourChain model, the worker is the subject of labour, a Record represents living labour, and an Asset represents objectified labour output. Repository acts as the warehouse for Assets and participates in confirming the labour Records associated with contributed Assets. A Repository contribution history can be reconstructed from on-chain Records, while runtime services may cache those projections for everyday use.

The repository is currently in the MVP development stage and is implemented as a Cordis plugin.

## Documentation

`docs/` is not limited to development requirements. It is the long-term project documentation space for theoretical and product material formed around Repository, and may later be published through GitHub Pages or another documentation site.

Current documents:

- [`docs/theory/labour-model.md`](./docs/theory/labour-model.md): the political-economy theory baseline for workers, living labour, dead labour, repositories, and projects;
- [`docs/requirements.md`](./docs/requirements.md): the single source of truth for Repository product requirements;
- [`specs/repository-mvp.md`](./specs/repository-mvp.md): the engineering contract, boundaries, invariants, and acceptance criteria projected from the requirements.

Theory documents provide a long-term conceptual baseline, but they do not replace the requirements layer. If requirements, Spec, or implementation conflict with the theory baseline, the conflict should be reviewed explicitly rather than silently resolved in code.

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

Theory documents sit outside this development chain and provide longer-lived conceptual context and comparison baselines.

Requirements state what the product needs. The Spec turns those needs into a verifiable engineering contract. Implementation and tests satisfy the Spec.

If implementation work exposes a missing product need, update the requirements first, then revise the Spec and code.

## Repository structure

```text
README.md            Chinese project README (authoritative)
README_EN.md         English translation
AGENTS.md            Agent development instructions (English)
docs/                theory, requirements, and other project documentation
specs/               engineering specifications
src/                 Cordis plugin implementation
test/                tests
scripts/             engineering and release checks
.github/              CI and PR configuration
```

`docs/` and `specs/` remain in the Git repository but are excluded from the published npm plugin package. Their exclusion from the runtime package does not make them disposable development artifacts.

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
