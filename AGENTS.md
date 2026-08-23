# AGENTS.md

## Repository context

This repository implements LabourChain Repository as a Cordis plugin.

The authoritative human-facing project description is the Chinese [`README.md`](./README.md). [`README_EN.md`](./README_EN.md) is a translation.

The domain baseline is documented under [`docs/concepts/`](./docs/concepts/). Start with [`docs/concepts/README.md`](./docs/concepts/README.md) for terminology and navigation.

The current model treats Worker / Member as the labour subject, Record as living labour, Asset as objectified labour output, Repo as an Asset warehouse that participates in contribution confirmation, and Project as an organizational form over workers, living labour and dead labour.

Do not replace this model with a conventional CRUD container model for convenience.

## Concepts and product truth

Concept documents define long-lived domain terms and relationships. They are not executable product requirements.

`docs/requirements.md` is the single source of truth for Repository product requirements. Specifications under `specs/` are engineering projections of those requirements.

If concepts, requirements, Spec or implementation become inconsistent, review the mismatch at the appropriate layer before changing code. The Spec must not create product behavior that is absent from requirements.

## Current Repository model

Repository canonical state consists of Repo identity, operator and worker relationships, and accepted Assets.

A worker contributes an Asset together with the related worker-produced Record. Repository validates the contribution and participates in Repo-side confirmation of that labour. Record remains an on-chain fact and is not canonical Repository storage.

Repository may keep Record projections for contribution history and normal analysis. Treat those projections as rebuildable cache or index data. Do not introduce canonical `storeRecord`, `getRecord` or general `listRecords` Repository behavior.

Membership controls whether a worker may contribute an Asset to a Repo. It does not control whether the worker may produce labour, Records or Assets elsewhere.

Personal Repo uses the same Repository model as the worker's default private Asset repository. Do not add a separate personal Record store.

## Development flow

Development follows three layers:

```text
Requirements (`docs/requirements.md`)
            ↓
Specification (`specs/`)
            ↓
Implementation (`src/`, `test/`)
```

Do not introduce numbering or traceability IDs during the current MVP phase. Add historical numbering later only if maintenance makes it useful.

For behavioral work:

1. read the relevant concept document when the change touches the domain model;
2. confirm the product need exists in `docs/requirements.md`;
3. refine the relevant Spec if the engineering projection must change;
4. add or update tests that protect a meaningful contract or invariant;
5. implement the smallest maintainable behavior that satisfies the Spec;
6. run validation;
7. update README or CHANGELOG when the human-visible project state changes.

Implementation-only refactors that preserve observable behavior do not require requirements or Spec changes, but existing tests must remain valid.

## Engineering discipline

Strict engineering boundaries belong in the Spec unless they are themselves product needs.

Avoid speculative abstractions. Do not add pagination, search or index APIs without a real requirement. Do not add role systems where operator plus membership is enough. Do not copy Core protocol semantics into Repository. Do not turn caches or projections into canonical facts. Do not model chain history as entity-owned arrays for database convenience. Add operating-system CI coverage only when a concrete platform-specific behavior needs it.

Cordis-owned external resources must be acquired and disposed through lifecycle ownership. Package import must not perform external work.

## Testing discipline

Tests protect requirements, Spec contracts, lifecycle behavior and reproduced regressions. Do not add tests only to raise coverage numbers or exercise trivial implementation details with no independent failure value.

Coverage is a secondary quality signal.

## Project documentation and packaging

`docs/` is long-term project documentation. `docs/concepts/` contains stable terminology and domain concepts; `docs/requirements.md` contains current Repository product requirements. `specs/` contains engineering specifications.

These documents stay in the Git repository and do not belong in the runtime npm plugin package. Tests, scripts, agent instructions, contribution documents and source files are also excluded unless packaging requirements later change.

`pnpm run package:check` verifies the actual npm tarball.

## Validation

Before release-facing changes run:

```bash
pnpm run typecheck
pnpm run test:coverage
pnpm run build
pnpm run package:check
```

CI validates the supported Node.js versions. Do not claim a change is complete without the relevant test, build and package evidence.
