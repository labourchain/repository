# Development Documents

`docs/` contains the human-facing product and feature reasoning that precedes formal specifications.

These files are maintained in the source repository because they help humans and coding agents understand **why** a capability exists and **what** users need before implementation choices are made.

They are development artifacts, not runtime assets, and are intentionally excluded from the published npm package together with `specs/`.

## Three-layer development model

```text
Requirements / Features        Specifications              Implementation
        docs/                      specs/                  src/ + test/
          |                           |                         |
          | why / what                | exact contract          | executable behavior
          +-------------------------->+------------------------>+
```

### 1. Requirements and features — `docs/`

This layer describes the problem and expected capability in product language.

It answers:

- who needs the capability;
- what they need to accomplish;
- why the capability belongs to Repository;
- what observable outcome is expected;
- what is explicitly outside the product boundary;
- which features satisfy which requirements.

Requirements use stable IDs such as `REQ-001`.
Features use stable IDs such as `FEAT-001`.

This layer should avoid implementation details unless a technical constraint is itself a product requirement.

### 2. Specifications — `specs/`

This layer translates accepted requirements/features into testable system contracts.

A spec defines:

- service boundaries;
- invariants;
- input/output behavior;
- lifecycle behavior;
- provider boundaries;
- error semantics;
- acceptance tests;
- explicit non-goals.

Each spec must name the `REQ-*` and `FEAT-*` items it covers.

A spec should not invent a new product requirement. If a missing product decision is discovered while writing a spec, update `docs/` first.

### 3. Implementation — `src/` and `test/`

Implementation satisfies an accepted specification with the smallest maintainable change.

Tests provide executable evidence that the spec is satisfied. Implementation must not silently broaden the feature beyond the governing spec.

## Change flow

For a new behavior:

```text
Problem / request
      |
      v
Update requirement (REQ)
      |
      v
Define or update feature (FEAT)
      |
      v
Write/update specification (SPEC)
      |
      v
Add contract/invariant tests
      |
      v
Implement
      |
      v
Validate and review
```

If an implementation reveals that the requirement was wrong or incomplete, move back up the chain rather than encoding the missing decision only in code.

## Current documents

- [`requirements.md`](./requirements.md) — Repository product requirements and boundaries.
- [`features.md`](./features.md) — feature catalog and requirement mapping.
- [`../specs/0001-repository-mvp.md`](../specs/0001-repository-mvp.md) — first formal Repository service specification.

## Packaging rule

`docs/` and `specs/` are source-repository development artifacts. They must not be shipped in the runtime npm package.

The package uses a positive `files` allowlist and CI verifies the generated tarball. A change that causes `docs/` or `specs/` to appear in the package is a release failure.
