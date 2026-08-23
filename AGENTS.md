# AGENTS.md

## Repository context

This repository implements LabourChain Repository: a Cordis workspace capability for worker relationships, accepted Record/Asset validation, storage orchestration, and retrieval.

The authoritative human-facing project description is the Chinese [`README.md`](./README.md). [`README_EN.md`](./README_EN.md) is a translation.

Development follows three layers:

```text
Requirements (`docs/requirements.md`)
            ↓
Specification (`specs/`)
            ↓
Implementation (`src/`, `test/`)
```

Do not introduce numbering or traceability IDs during the current MVP phase. Numbered history can be added later when maintenance makes it useful.

## Source of truth

`docs/requirements.md` is the single source of truth for Repository product requirements.

The Spec is a projection of those requirements. It may define engineering decisions needed to implement them, but it must not create new product behavior or change requirement meaning.

If requirements and Spec conflict, requirements win and the Spec must be corrected.

If implementation exposes a missing product need, update `docs/requirements.md` first.

## Specification

Read `specs/repository-mvp.md` before changing observable Repository behavior.

The Spec is where strict engineering boundaries belong. It defines:

- ownership boundaries;
- invariants;
- service behavior;
- provider contracts;
- lifecycle constraints;
- error semantics;
- acceptance tests;
- explicit non-goals where they prevent scope creep or over-engineering.

Do not push implementation convenience upward into requirements. Conversely, do not let the Spec invent a capability that requirements do not ask for.

## Implementation workflow

For behavioral work:

1. confirm the product need exists in `docs/requirements.md`;
2. refine `specs/repository-mvp.md` if the engineering projection must change;
3. add or update tests that protect the relevant contract/invariant;
4. implement the smallest maintainable behavior that satisfies the Spec;
5. run validation;
6. update README/CHANGELOG when the human-visible project state changes.

Implementation-only refactors that preserve observable behavior do not require requirements/spec changes, but existing tests must remain valid.

## Current engineering invariants

These come from the current MVP Spec and must be preserved unless the Spec changes first:

- membership is checked before persistent contribution;
- Core validation happens before storage acceptance;
- Repository accepts recognized Records/Assets rather than performing RawEntry recognition;
- accepted Record/Asset semantics are not silently rewritten;
- Project/Board semantics remain outside the Repository service;
- storage-provider details stay behind the provider contract;
- runtime state is not automatically promoted to an Asset;
- import has no external side effects;
- Cordis-owned resources are acquired/disposed through lifecycle effects;
- the MVP does not add pagination/search/index abstractions without a real requirement;
- use a LabourChain-specific service namespace rather than a generic flat service name.

## Testing discipline

Tests exist to protect requirements, Spec contracts, and lifecycle behavior. Do not add tests solely to raise coverage numbers or to exercise trivial implementation details with no meaningful failure mode.

Coverage is a secondary quality signal, not the reason a test exists.

## Source-only development artifacts

`docs/` and `specs/` are source-repository development artifacts for humans and coding agents. They must not be included in the published npm plugin package.

Tests, scripts, agent instructions, contribution documents, and source files are also development artifacts unless a later packaging decision explicitly changes that.

`pnpm run package:check` verifies the actual npm tarball.

## Validation

Before release-facing changes run:

```bash
pnpm run typecheck
pnpm run test:coverage
pnpm run build
pnpm run package:check
```

CI validates the supported Node.js versions. Do not add operating-system matrices unless a concrete platform-specific behavior makes them necessary.

Do not claim a change is complete without the relevant test/build/package evidence.
