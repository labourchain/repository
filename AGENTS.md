# AGENTS.md

## Scope

This repository implements LabourChain Repository: workspace membership plus storage, validation orchestration, and retrieval of recognized Records and Assets.

Work is spec-driven. Read `specs/0001-repository-mvp.md` before changing behavior.

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

## Spec-driven workflow

For behavior changes:

1. identify the governing spec;
2. update/add the spec first when observable behavior or invariants change;
3. add failing contract/invariant tests;
4. implement the smallest change that satisfies the spec;
5. run validation;
6. update README/CHANGELOG when user-visible behavior changes.

Do not expand the domain model merely to make an implementation convenient.

## Validation

Before release-facing changes run:

```bash
pnpm run typecheck
pnpm run test:coverage
pnpm run build
npm pack --dry-run
```

Do not claim a change is complete without the relevant tests/build evidence.
