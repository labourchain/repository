# AGENTS.md

## Repository context

This repository implements LabourChain Repository as a Cordis plugin.

The authoritative human-facing project description is the Chinese [`README.md`](./README.md). [`README_EN.md`](./README_EN.md) is a translation.

The current domain baseline is documented in [`docs/theory/labour-model.md`](./docs/theory/labour-model.md):

- Worker / Member is the labour subject;
- Record represents living labour;
- Asset represents objectified labour output / dead labour;
- Repo is a warehouse for Assets and participates in confirming labour associated with contributions;
- Project is an organizational form over workers, living labour, and dead labour.

Do not silently replace these concepts with conventional CRUD or database-container models.

## Theory and product truth

Theory documents provide long-term conceptual baselines. They are not themselves executable product requirements.

`docs/requirements.md` is the single source of truth for Repository product requirements. Specifications under `specs/` are engineering projections of those requirements.

If theory, requirements, Spec, or implementation appear inconsistent, do not choose one implicitly. Surface the mismatch and correct the appropriate layer first.

The current requirements/spec are being reviewed against the theory baseline before domain implementation proceeds.

## Development flow

Development follows three layers:

```text
Requirements (`docs/requirements.md`)
            ↓
Specification (`specs/`)
            ↓
Implementation (`src/`, `test/`)
```

Do not introduce numbering or traceability IDs during the current MVP phase. Numbered history can be added later when maintenance makes it useful.

For behavioral work:

1. read the relevant theory document when the change touches the domain model;
2. confirm the product need exists in `docs/requirements.md`;
3. refine the relevant Spec if the engineering projection must change;
4. add or update tests that protect the meaningful contract or invariant;
5. implement the smallest maintainable behavior that satisfies the Spec;
6. run validation;
7. update README/CHANGELOG when the human-visible project state changes.

Implementation-only refactors that preserve observable behavior do not require requirements/spec changes, but existing tests must remain valid.

## Engineering discipline

Strict engineering boundaries belong in the Spec, not in the human-facing README or product requirements unless they are themselves product needs.

Avoid speculative abstractions. In particular:

- do not add pagination/search/index abstractions without a real requirement;
- do not add role/status systems where simple membership satisfies the product need;
- do not copy Core protocol semantics into Repository;
- do not turn runtime caches or projections into canonical domain facts;
- do not model chain history as entity-owned arrays merely because it is convenient for a database;
- do not add operating-system CI matrices unless a concrete platform-specific behavior requires them.

Cordis-owned external resources must be acquired and disposed through lifecycle ownership, and package import must not perform external work.

## Testing discipline

Tests exist to protect requirements, Spec contracts, and meaningful lifecycle behavior. Do not add tests solely to raise coverage numbers or exercise trivial implementation details with no independent failure value.

Coverage is a secondary quality signal, not the reason a test exists.

## Project documentation and packaging

`docs/` is long-term project documentation. It may contain theory, requirements, design reasoning, and material that can later be published through GitHub Pages or another documentation site.

`specs/` contains engineering specifications.

Neither `docs/` nor `specs/` belongs in the runtime npm plugin package. Tests, scripts, agent instructions, contribution documents, and source files are also excluded unless a later packaging decision explicitly changes that.

`pnpm run package:check` verifies the actual npm tarball.

## Validation

Before release-facing changes run:

```bash
pnpm run typecheck
pnpm run test:coverage
pnpm run build
pnpm run package:check
```

CI validates the supported Node.js versions.

Do not claim a change is complete without the relevant test/build/package evidence.
