## Change

<!-- What does this PR change, and why? -->

## Requirement / feature

<!-- Link or list the governing REQ-* and FEAT-* IDs from docs/. -->

- REQ-:
- FEAT-:

- [ ] No product capability changed, or the requirements/features layer is updated first.

## Governing spec

<!-- Link/list the SPEC-* that defines the observable contract. -->

- SPEC-:

- [ ] No observable behavior changed, or the governing spec is updated.
- [ ] The spec traces back to the listed REQ-* / FEAT-*.

## Implementation

- [ ] Tests cover the changed contract/invariant before or alongside implementation.
- [ ] Code does not add behavior outside the governing spec.

## Cordis lifecycle

- [ ] No import-time external side effects were added.
- [ ] New resources are owned and disposed by the Cordis lifecycle.
- [ ] Service/provider dependencies are explicit.

## Repository boundary

- [ ] No RawEntry recognition was added.
- [ ] No Project/Board semantic aggregation was added.
- [ ] No Core protocol semantics were copied into this package.
- [ ] Backend-specific concepts do not leak into the public Repository contract.

## Package boundary

- [ ] `docs/` and `specs/` remain source-only development artifacts.
- [ ] No tests, source files, agent/contribution documents, or development scripts leak into the npm package.

## Validation

- [ ] `pnpm run typecheck`
- [ ] `pnpm run test:coverage`
- [ ] `pnpm run build`
- [ ] `pnpm run package:check`
