# AGENTS.md

This repository uses spec-driven development. Human and AI contributors follow the same engineering contract.

## Read before changing code

Read in this order:

1. `SPEC.md`
2. `README.md`
3. the relevant source and tests
4. `CONTRIBUTING.md`

Do not infer Repository behavior from UI needs or implementation convenience when the spec says otherwise.

## Scope

Repository owns:

- workspace/repository state needed by the service;
- worker membership relationships;
- accepted Record persistence/query;
- accepted Asset persistence/query;
- validation/authorization orchestration;
- a Cordis service boundary for these capabilities.

Repository does not own:

- Raw Entry conversion (LabourFlow);
- Project organization/planning/analysis (Board/project package);
- core protocol semantics (core-protocols);
- MongoDB/Redis/LLM/GitHub-specific domain behavior (runtime providers);
- blockchain consensus/packing/sync.

Do not add these concerns without an accepted spec change.

## Spec-driven workflow

For behavior changes:

1. identify the affected `REP-*` requirements;
2. update `SPEC.md` first if required behavior is missing or changing;
3. keep the implementation PR limited to the accepted semantic change;
4. add tests that cite the relevant requirement IDs;
5. update README/CHANGELOG when public behavior changes;
6. run `pnpm check`.

A refactor that changes no behavior does not need a spec edit, but the PR must explicitly say which public behavior remains unchanged.

## Cordis rules

- Use `Service` when exposing a named capability to other plugins.
- Declare required dependencies with `inject`/service dependency metadata.
- Do not hide required dependencies in process globals, module singletons, or late service lookup.
- Bind external resources to the Cordis lifecycle; cleanup must be deterministic.
- Keep provider replacement at service/plugin boundaries rather than `if provider === ...` branches inside domain methods.
- Use LabourChain-prefixed service names because Cordis service names share a context namespace.
- Test lifecycle behavior with a real Cordis `Context`, not only mocked classes.

## Design rules

- Prefer small, direct domain interfaces over speculative abstractions.
- Separate domain policy, Cordis integration, and provider implementation once they contain meaningful independent behavior.
- Do not create layers/files solely to look modular.
- Do not silently mutate accepted Records or Assets for storage convenience.
- Do not make Project a storage primitive.
- Do not accept Raw Entries as Records.
- Do not make cache state authoritative by accident.
- Keep infrastructure-specific types out of the public Repository API.

## Testing

The expected testing order is:

1. pure/domain unit tests;
2. shared persistence-provider contract tests;
3. Cordis service lifecycle/injection tests;
4. integration tests for accepted MVP flows;
5. durable-provider tests only when such a provider exists.

Tests for behavior SHOULD cite `REP-*` IDs in their names or nearby comments.

Never lower coverage thresholds merely to make a PR pass. A threshold change requires an explicit rationale and review.

## Maintainability

This repository is intended for long-term contribution, not one-shot code generation.

Contributors must:

- choose descriptive domain names;
- keep exported APIs documented;
- leave tests for non-trivial behavior;
- keep generated artifacts out of Git unless a regeneration path is documented;
- avoid copy-pasted parallel implementations when a provider contract can express the same behavior;
- preserve a readable commit/PR scope;
- report known limitations instead of hiding them behind TODO-heavy scaffolding.

AI-generated changes are reviewed by the same standard as human changes. Large generated rewrites without a clear requirement mapping, tests, and readable ownership boundaries should be rejected.

## Validation

Before handoff or merge, run:

```bash
pnpm check
```

If validation cannot be run, report exactly which commands were not run and why. Never state that a change is complete or fixed without evidence.
