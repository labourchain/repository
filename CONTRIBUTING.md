# Contributing

Contributions are welcome. This repository is maintained as a spec-driven Cordis plugin, so behavioral changes start from the contract rather than from code shape.

## Before coding

1. Read `README.md`, `AGENTS.md`, and the governing file under `specs/`.
2. Keep the change inside Repository's boundary: workspace membership, accepted Record/Asset storage and validation orchestration, and retrieval.
3. If the proposal changes an invariant or public behavior, update the spec first.

## Pull requests

Prefer small PRs with one reason to change.

A behavior-changing PR should include:

- the relevant spec/change rationale;
- tests for the invariant or contract being changed;
- implementation;
- README/CHANGELOG updates when user-visible behavior changes;
- no unrelated refactors.

## Validation

Run before requesting review:

```bash
pnpm run check
npm pack --dry-run
```

CI repeats type checking, coverage-gated tests, build, and tarball inspection on supported platforms.

## Maintainability

Readable, explicit code is preferred over abstraction added for hypothetical future features. Cordis services and effects should make ownership/lifecycle visible. New providers should implement a narrow capability rather than coupling the domain service to a specific database or external system.
