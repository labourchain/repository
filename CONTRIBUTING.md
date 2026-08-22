# Contributing

Thank you for contributing to LabourChain Repository.

This project uses spec-driven development. The goal is not only to make code pass, but to keep the Repository boundary understandable and maintainable over time.

## Before opening a change

Read:

1. `SPEC.md`
2. `AGENTS.md`
3. the relevant tests and implementation

For domain behavior changes, identify the affected `REP-*` requirements before writing implementation code.

## Change types

### Spec change

Use a spec change when you are adding, removing, or changing Repository behavior or public semantics.

A spec change should explain:

- the concrete problem;
- affected requirement IDs;
- current behavior/assumption;
- proposed behavior;
- compatibility or migration impact;
- what remains explicitly out of scope.

Implementation may follow in the same PR only when the change remains small and independently reviewable. Larger semantic changes should land the spec first.

### Implementation change

Implementation PRs must state which `REP-*` requirements they satisfy.

Keep them narrow. Avoid combining unrelated refactors, provider additions, protocol redesign, and product UI changes.

### Refactor

Refactors that do not change public/domain behavior do not require new requirements, but the PR must state that no `REP-*` semantics are intended to change and tests must demonstrate preserved behavior.

## Development

Requirements:

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

Install dependencies and run all gates:

```bash
pnpm install
pnpm check
```

Individual gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

## Tests

Behavior changes require tests.

Prefer this order:

1. domain/unit tests;
2. provider contract tests;
3. Cordis lifecycle/injection tests;
4. integration tests;
5. provider-specific tests.

Reference `REP-*` requirement IDs in test names or nearby comments when practical.

Do not lower coverage thresholds simply to pass CI.

## Pull requests

A good PR includes:

- a concise problem statement;
- affected `REP-*` IDs, or `none (no semantic change)`;
- a summary of the implementation;
- verification commands and results;
- known limitations or deferred work;
- compatibility notes when public APIs change.

Small PRs are preferred because they make architecture and maintenance intent reviewable.

## Public API and compatibility

Before the first stable release, breaking changes are allowed only when the spec and changelog describe the migration.

Do not expose persistence-provider-specific types through the public Repository API.

## Generated or AI-assisted contributions

AI assistance is allowed. It does not lower the review standard.

Generated changes must still be:

- traceable to requirements;
- readable by maintainers;
- tested;
- scoped;
- documented where behavior changes;
- free of speculative abstractions outside the accepted spec.

Avoid large generated rewrites that no contributor can reasonably review or maintain.
