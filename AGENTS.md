# AGENTS.md

## Repository context

This repository implements LabourChain Repository: a Cordis workspace capability for worker relationships, accepted Record/Asset storage, validation orchestration, and retrieval.

The authoritative human-facing project description is the Chinese [`README.md`](./README.md). [`README_EN.md`](./README_EN.md) is a translation.

Development follows three layers:

```text
Requirements and Features (`docs/`)
            ↓
Specification (`specs/`)
            ↓
Implementation (`src/`, `test/`)
```

Do not introduce numbering or traceability IDs during the current MVP phase. The documents are small and actively changing; numbered change history can be introduced later when maintenance requires it.

## How to use the three layers

### Requirements and features

Read `docs/requirements.md` and `docs/features.md` to understand what the Repository product currently needs to provide.

Requirements and feature documents should stay product-oriented. Do not turn them into exhaustive architecture boundary lists or implementation contracts.

When implementation exposes a missing product need, update the relevant document in `docs/` first.

### Specification

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

If a desired behavior is not supported by the requirements, do not add it only to the Spec.

### Implementation

Implementation should be the smallest maintainable change that satisfies the accepted Spec.

For behavioral work:

1. confirm the requirement/feature is present in `docs/`;
2. refine `specs/repository-mvp.md` when the engineering contract must change;
3. add or update contract/invariant tests;
4. implement the behavior;
5. run validation;
6. update README/CHANGELOG when the human-visible project state changes.

Implementation-only refactors that preserve observable behavior do not require a docs/spec rewrite, but must remain covered by tests.

## Current engineering invariants

These come from the current MVP Spec and must be preserved unless the Spec changes first:

- worker relationship is checked before persistent contribution;
- Core validation happens before persistence;
- Repository accepts recognized Records/Assets rather than performing RawEntry recognition;
- accepted Record/Asset semantics are not silently rewritten;
- Project/Board semantics remain outside the Repository service;
- backend-specific storage concepts stay behind the provider boundary;
- runtime state is not automatically promoted to an Asset;
- import has no external side effects;
- Cordis-owned resources are acquired/disposed through lifecycle effects;
- reload must not leak or duplicate owned resources;
- use a LabourChain-specific service namespace rather than a generic flat service name.

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

Do not claim a change is complete without the relevant test/build/package evidence.
