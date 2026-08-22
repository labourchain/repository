# AGENTS.md

## Scope

This repository implements LabourChain Repository: workspace membership plus storage, validation orchestration, and retrieval of recognized Records and Assets.

Development follows a strict three-layer chain:

```text
REQ-* / FEAT-* (docs/) -> SPEC-* (specs/) -> tests/code (test/, src/)
```

Read the governing requirement/feature/spec chain before changing behavior.

## Invariants

- Repository is not Project. Do not add project grouping, planning, progress, summaries, or analysis here.
- Repository does not convert RawEntry into Record. That belongs to LabourFlow.
- A worker must belong to the Repository before contributing persistent Records or Assets.
- Accepted objects are validated through the Core validation boundary before persistence.
- Do not copy or fork Core protocol semantics into this repository.
- Storage backends are replaceable providers; backend-specific concepts must not leak into the public Repository contract.
- Runtime state is not automatically an Asset. Archival/capture must be explicit.
- Do not silently rewrite accepted Records/Assets for storage or UI convenience.
- No import-time external side effects.
- Cordis-owned resources must be acquired/disposed through lifecycle effects; reload must not leak or duplicate handles.
- Keep the service namespace explicit (`labourchain...`) because Cordis service names share a flat namespace.

## Requirements -> Spec -> Implementation workflow

For behavior changes:

1. identify the product requirement (`REQ-*`) and feature (`FEAT-*`) under `docs/`;
2. if the desired capability is missing or changed, update the requirements/features layer first;
3. update or add the governing `SPEC-*` under `specs/`;
4. add failing contract/invariant tests for the spec;
5. implement the smallest change that satisfies the spec;
6. run validation;
7. update README/CHANGELOG when user-visible behavior changes.

Do not let a spec invent a product requirement, and do not let code invent behavior absent from its governing spec.

Implementation-only refactors that preserve observable behavior may skip requirements/spec changes, but must remain covered by tests.

## Source-only development artifacts

`docs/`, `specs/`, `test/`, `scripts/`, `AGENTS.md`, `CONTRIBUTING.md`, and `CHANGELOG.md` are development/repository artifacts, not runtime package contents.

Do not add them to the npm package allowlist. `pnpm run package:check` must fail if these artifacts leak into the tarball.

## Validation

Before release-facing changes run:

```bash
pnpm run typecheck
pnpm run test:coverage
pnpm run build
pnpm run package:check
```

Do not claim a change is complete without the relevant tests/build/package evidence.
