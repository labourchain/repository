# Repository Requirements

## Product intent

LabourChain needs a shared Repository workspace in which a small team can preserve recognized labour facts and related assets, keep worker relationships clear, and make those materials available to other LabourChain products.

Repository is the common storage and workspace capability used after a Record or Asset has already been recognized by an upstream workflow such as LabourFlow.

The first usable version should support a simple closed loop:

```text
Worker
  -> LabourFlow produces a Record
  -> Repository accepts and preserves it
  -> another consumer retrieves it
  -> Board / Project uses the stored facts for organization or analysis
```

The MVP is successful when this loop works predictably for a small team.

## Workspace

A running Repository plugin should be able to initialize or load one workspace and expose enough information for clients to know which workspace they are using.

For the MVP, one configured Repository workspace per plugin instance is sufficient.

## Worker relationships

Repository should maintain the relationship between the workspace and the workers who belong to it.

The system should support:

- adding or activating a worker relationship;
- removing or deactivating a worker relationship;
- checking whether a worker currently belongs to the Repository;
- listing current workers.

A worker relationship is used when deciding whether a contribution may be accepted.

## Record contribution

LabourFlow and other recognition packages need a stable place to submit Records after recognition is complete.

Repository should be able to:

- receive a recognized Record from a worker;
- check the worker relationship;
- validate the Record through LabourChain Core;
- preserve the accepted Record;
- return a stable reference that other consumers can use later.

A rejected contribution should not leave partially accepted Repository state.

## Asset contribution

Workers and higher-level packages need to preserve Assets and Asset references associated with LabourChain activity.

Repository should support the same basic acceptance flow for an Asset:

- receive an explicitly captured or recognized Asset;
- check the worker relationship;
- validate it through the appropriate Core capability;
- preserve the accepted Asset or reference;
- return a stable reference.

## Fact preservation

Consumers need an accepted Record or Asset to remain the same fact they submitted, subject to the correction or versioning semantics of the owning protocol.

Repository storage should preserve accepted semantic content rather than rewriting it for storage convenience.

## Retrieval

Consumers such as LabourFlow, Board, Project, migration tools, and administrative tools need to retrieve accepted content without knowing the concrete persistence backend.

Repository should provide stable retrieval for Records and Assets.

## Enumeration

Consumers need to discover Repository content.

Repository should support generic enumeration of:

- Records;
- Assets;
- worker relationships.

The MVP should use a pagination or cursor model that can continue to work when the persistence backend changes.

## Core validation

Repository should use LabourChain Core as the source of protocol validation semantics.

The Repository layer should be able to call a stable Core validation capability before an accepted object becomes persistent content.

Until the Core runtime API is finalized, the implementation may use a narrow adapter that can later be replaced without changing Repository-facing behavior.

## Replaceable persistence

Repository should not require one specific database in order to satisfy its public behavior.

The MVP should include an in-memory provider suitable for tests and local development. Other persistence providers can be supplied by runtime plugins later.

Changing the persistence provider should not change the meaning of Repository operations.

## Cordis integration

Repository should behave as a normal Cordis capability:

- activation and deactivation are predictable;
- dependencies are explicit;
- resources are owned through the Cordis lifecycle;
- reload does not duplicate owned resources;
- importing the package performs no external work.

## MVP completion

The first usable Repository version should demonstrate the complete small-team path with an in-memory provider:

```text
load workspace
  -> add worker
  -> accept valid Record / Asset
  -> preserve content
  -> retrieve or enumerate content
```

The detailed engineering boundaries, invariants, errors, provider contract, and acceptance tests are defined in [`../specs/repository-mvp.md`](../specs/repository-mvp.md).
