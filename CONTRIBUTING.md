# Contributing

Contributions are welcome. This repository uses a three-layer development workflow so product needs, engineering contracts, and implementation remain distinct.

## Before coding

1. Read the authoritative Chinese `README.md` and the English `AGENTS.md`.
2. Read `docs/requirements.md` and `docs/features.md` for the current product need.
3. Read `specs/repository-mvp.md` for the strict engineering contract.

If implementation work reveals a missing product need, update `docs/` first. If the product need is already clear but the engineering contract is incomplete, update the Spec before implementation.

## Development flow

For new or changed behavior:

```text
Requirements / Features
        ↓
Spec
        ↓
Tests
        ↓
Implementation
```

Requirements describe what the product needs. The Spec owns strict boundaries, invariants, lifecycle rules, provider contracts, errors, and acceptance behavior. Code should satisfy the Spec without broadening it implicitly.

Pure refactors that preserve observable behavior do not require requirements/spec changes, but existing tests must remain valid.

## Pull requests

Prefer small PRs with one reason to change.

A behavior-changing PR should include:

- the relevant requirement or feature document update when product behavior changes;
- the relevant Spec update when the engineering contract changes;
- tests for the changed contract or invariant;
- implementation;
- README/CHANGELOG updates when the human-visible project state changes;
- no unrelated refactors.

## Development documents and packaging

`docs/` and `specs/` are maintained in Git for humans and coding agents but are not runtime package contents.

Tests, scripts, agent instructions, and contribution documents are also development artifacts unless a later packaging decision explicitly changes that.

Do not add these files to the npm package allowlist. `pnpm run package:check` verifies the actual tarball.

## Validation

Run before requesting review:

```bash
pnpm run check
pnpm run package:check
```

CI repeats frozen dependency installation, type checking, coverage-gated tests, build, and tarball-content verification on supported platforms.

## Maintainability

Prefer readable, explicit code over abstractions for hypothetical future requirements. Cordis services and effects should make ownership and lifecycle visible. New providers should implement narrow capabilities rather than coupling Repository behavior to a particular database or external system.
