## Change

<!-- What does this PR change, and why? -->

## Requirements

<!-- `docs/requirements.md` is the single product source of truth. -->

- [ ] No product requirement changed, or `docs/requirements.md` is updated first.

## Spec

<!-- Update the governing Spec when the engineering projection changes. -->

- [ ] No observable contract changed, or the relevant file under `specs/` is updated.
- [ ] The Spec does not introduce product behavior absent from the requirements source.

## Implementation

- [ ] Tests protect the changed contract/invariant rather than coverage alone.
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
