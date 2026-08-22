## Change

<!-- What does this PR change, and why? -->

## Requirements / Features

<!-- Link the relevant docs when product behavior changes. -->

- [ ] No product capability changed, or `docs/requirements.md` / `docs/features.md` is updated first.

## Spec

<!-- Link the governing spec when observable behavior or engineering boundaries change. -->

- [ ] No observable contract changed, or the relevant file under `specs/` is updated.

## Implementation

- [ ] Tests cover the changed contract or invariant.
- [ ] Code does not add behavior outside the governing Spec.

## Cordis lifecycle

- [ ] No import-time external side effects were added.
- [ ] New resources are owned and disposed by the Cordis lifecycle.
- [ ] Service/provider dependencies are explicit.

## Package contents

- [ ] `docs/` and `specs/` remain source-only development artifacts.
- [ ] No tests, source files, agent/contribution documents, or development scripts leak into the npm package.

## Validation

- [ ] `pnpm run typecheck`
- [ ] `pnpm run test:coverage`
- [ ] `pnpm run build`
- [ ] `pnpm run package:check`
