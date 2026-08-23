# Contributing

Contributions are welcome. This repository uses a three-layer development workflow so product requirements, engineering contracts, and implementation remain distinct.

## Before coding

1. Read the authoritative Chinese `README.md` and the English `AGENTS.md`.
2. If the change touches the domain model, start from [`docs/concepts/README.md`](./docs/concepts/README.md) and read the relevant concept documents under `docs/concepts/`.
3. Read `docs/requirements.md`; it is the single source of truth for Repository product requirements.
4. Read the relevant file under `specs/` for the engineering projection of those requirements.

Concept documents provide long-lived domain baselines rather than product behavior. If concepts and requirements appear inconsistent, review the mismatch explicitly before changing the Spec or code.

If implementation work reveals a missing product need, update `docs/requirements.md` first. If the product need is already clear but the engineering contract is incomplete, update the Spec before implementation.

## Development flow

```text
Requirements
    ↓
Spec
    ↓
Tests / Implementation
```

Concept documentation sits outside this three-layer development chain and provides stable terminology and a longer-lived baseline for reviewing the product model.

The Spec may choose engineering mechanisms, but it must not add product behavior absent from the requirements source.

Pure refactors that preserve observable behavior do not require requirements/spec changes, but existing tests must remain valid.

## Pull requests

Prefer small PRs with one reason to change.

A behavior-changing PR should include:

- a requirements update when the product need changes;
- a Spec update when the engineering contract changes;
- a concept-document update only when the domain model itself changes;
- tests for meaningful changed contracts or invariants;
- implementation;
- README/CHANGELOG updates when the human-visible project state changes;
- no unrelated refactors.

## Project documentation and packaging

`docs/` is long-term project documentation for concepts, requirements, and other project material. It may later be published through GitHub Pages or another documentation site.

`specs/` contains engineering specifications.

These documents are maintained in Git but are not runtime npm package contents. Do not add them, tests, scripts, or agent/contribution documents to the npm package allowlist. `pnpm run package:check` verifies the actual tarball.

## Validation

Run before requesting review:

```bash
pnpm run check
pnpm run package:check
```

CI validates supported Node.js versions. Cross-operating-system matrices should only be added when the plugin has a demonstrated platform-specific behavior that needs coverage.

## Maintainability

Prefer readable, explicit code over abstractions for hypothetical future requirements. Tests should protect meaningful contracts and failure modes rather than exist for coverage alone.
