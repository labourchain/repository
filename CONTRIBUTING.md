# Contributing

Contributions are welcome. This repository uses a Requirements -> Spec -> Implementation workflow so product intent, formal contracts, and code remain separable and traceable.

## Before coding

1. Read `README.md` and `AGENTS.md`.
2. Find the relevant `REQ-*` and `FEAT-*` under `docs/`.
3. Find the governing `SPEC-*` under `specs/`.
4. Keep the change inside Repository's boundary: workspace membership, accepted Record/Asset storage and validation orchestration, and retrieval.

If the desired behavior is not represented by an existing requirement/feature, update `docs/` first. If requirements/features are accepted but the contract is missing or incomplete, update `specs/` before implementation.

## Three-layer change rule

For new or changed behavior, the normal sequence is:

```text
REQ-* -> FEAT-* -> SPEC-* -> tests -> implementation
```

A spec must not silently invent a new product capability. Code must not silently broaden a spec.

Pure refactors that preserve observable behavior do not require requirement/spec changes, but must keep existing tests passing.

## Pull requests

Prefer small PRs with one reason to change.

A behavior-changing PR should include:

- the relevant `REQ-*` / `FEAT-*` references;
- the governing `SPEC-*`;
- tests for the invariant or contract being changed;
- implementation;
- README/CHANGELOG updates when user-visible behavior changes;
- no unrelated refactors.

## Source-only development artifacts

The following are maintained in Git but are not runtime package contents:

- `docs/` requirements/features;
- `specs/` formal development specifications;
- `test/` and `scripts/`;
- `AGENTS.md`, `CONTRIBUTING.md`, and `CHANGELOG.md`.

Do not add them to the npm package allowlist. The package verification gate rejects development-artifact leakage.

## Validation

Run before requesting review:

```bash
pnpm run check
pnpm run package:check
```

CI repeats frozen dependency installation, type checking, coverage-gated tests, build, and actual tarball-content verification on supported platforms.

## Maintainability

Readable, explicit code is preferred over abstraction added for hypothetical future features. Cordis services and effects should make ownership/lifecycle visible. New providers should implement a narrow capability rather than coupling the domain service to a specific database or external system.
