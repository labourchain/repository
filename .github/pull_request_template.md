## Change

<!-- What does this PR change, and why? -->

## Governing spec

<!-- Link the relevant spec. If behavior/invariants changed, update or add the spec first. -->

- [ ] No observable behavior changed, or the governing spec is updated.

## Cordis lifecycle

- [ ] No import-time external side effects were added.
- [ ] New resources are owned and disposed by the Cordis lifecycle.
- [ ] Service/provider dependencies are explicit.

## Repository boundary

- [ ] No RawEntry recognition was added.
- [ ] No Project/Board semantic aggregation was added.
- [ ] No Core protocol semantics were copied into this package.
- [ ] Backend-specific concepts do not leak into the public Repository contract.

## Validation

- [ ] `pnpm run typecheck`
- [ ] `pnpm run test:coverage`
- [ ] `pnpm run build`
- [ ] `npm pack --dry-run`
