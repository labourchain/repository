# Repository Features

This document describes the first usable feature set of `@labourchain/repository` in product terms. Exact service contracts and strict engineering boundaries are defined in [`../specs/repository-mvp.md`](../specs/repository-mvp.md).

## Repository workspace

The plugin can initialize or load one Repository workspace and expose its basic identity to consumers.

For the MVP, one workspace per plugin instance is sufficient.

## Worker membership

Repository maintains the workers currently related to the workspace.

The feature includes:

- add or activate a worker;
- remove or deactivate a worker;
- inspect whether a worker is active;
- list current workers.

## Contribution authorization

When a worker submits content, Repository checks the worker relationship before accepting persistent content.

Rejected contributions must not leave partial accepted state.

## Record acceptance

Repository accepts a recognized Record and processes it through the common acceptance flow:

```text
recognized Record
  -> worker check
  -> Core validation
  -> persistence
  -> stable reference
```

The stored Record can later be retrieved without requiring the caller to know the persistence backend.

## Asset acceptance

Repository accepts an explicitly captured or recognized Asset or Asset reference through the same basic flow:

```text
recognized Asset
  -> worker check
  -> Core validation
  -> persistence
  -> stable reference
```

## Stable retrieval

Consumers can retrieve accepted Records and Assets through stable Repository references.

Not-found behavior should be explicit and programmatically distinguishable.

## Generic enumeration

Repository can enumerate:

- Records;
- Assets;
- worker relationships.

Enumeration uses a generic pagination or cursor model suitable for different storage providers.

## Replaceable persistence provider

Repository uses a persistence capability rather than binding its public behavior to one database implementation.

The MVP includes an in-memory provider for tests and local development. Runtime packages may provide additional backends later.

## Cordis service integration

Repository is exposed as a Cordis capability with explicit dependencies and lifecycle ownership.

The implementation should support predictable activation, deactivation, reload, and test isolation.
