# Repository Requirements

This document is the single source of truth for Repository product requirements during the MVP phase.

Specifications under `specs/` are engineering projections of these requirements. They may make implementation decisions needed to satisfy the requirements, but they must not introduce new product behavior or change the meaning of a requirement. If a Spec and this document conflict, this document wins and the Spec must be corrected.

## Product intent

LabourChain needs a shared Repository workspace in which a small team can preserve recognized labour Records and related Assets, maintain the relationship between workers and the workspace, and make those materials available to other LabourChain products.

Repository is the common workspace and storage capability used after a Record or Asset has been recognized. LabourFlow can turn raw labour input into a recognized Record; Board and Project can later organize and analyze Records and Assets stored in Repository.

The first usable product should support this closed loop:

```text
worker joins Repository
  -> a recognized Record / Asset is contributed
  -> Repository validates and preserves it
  -> the stored material remains available later
  -> other LabourChain products retrieve and use it
```

The MVP is successful when this loop works predictably for a small team.

## Required capabilities

### Repository workspace

The system needs a Repository workspace with a stable identity that clients can load and recognize.

The workspace is the shared place in which worker relationships, Records, and Assets are kept.

### Worker relationships

Repository needs to maintain which workers belong to the workspace.

Users need to be able to:

- add a worker to the Repository;
- remove a worker from the Repository;
- check whether a worker belongs to the Repository;
- list workers in the Repository.

A worker must belong to the Repository before contributing persistent Repository content.

### Record contribution

LabourFlow and other compatible workflows need to submit recognized Records to Repository.

For an accepted Record, Repository needs to:

- know who is contributing it;
- verify that the contributor belongs to the Repository;
- validate the Record according to LabourChain protocol rules;
- preserve the accepted Record without silently changing its meaning;
- make the accepted Record available for later retrieval.

Rejected Records must not become accepted Repository content.

### Asset contribution

Repository needs to preserve Assets and Asset references associated with work in the workspace.

For an accepted Asset, Repository needs to:

- know who is contributing it;
- verify that the contributor belongs to the Repository;
- validate the Asset according to its applicable LabourChain protocol rules;
- preserve the accepted Asset or reference without silently changing its meaning;
- make it available for later retrieval.

Rejected Assets must not become accepted Repository content.

### Preservation

Accepted worker relationships, Records, and Assets are Repository state and must remain available for later use.

In a usable small-team deployment, normal application restart must not cause accepted Repository state to disappear.

Corrections or later versions of a Record or Asset follow the semantics of the protocol that owns that object; Repository does not rewrite an accepted fact in place merely for storage or presentation convenience.

### Retrieval

Consumers need to retrieve accepted Records and Assets through stable identities or references without depending on the details of the storage implementation.

A consumer should be able to distinguish an existing object from one that is not present.

### Enumeration

Consumers need to inspect the contents of a Repository.

Repository needs to list:

- workers;
- Records;
- Assets.

The MVP only requires reliable enumeration for a small team. More advanced query, pagination, indexing, or search behavior should be added only when a real consumer requires it.

### Validation

Repository accepts only Records and Assets that satisfy the applicable LabourChain protocol validation rules.

LabourChain Core remains the authority for protocol semantics; Repository uses those semantics when deciding whether an object can be accepted.

## Current feature set

The first Repository feature set therefore consists of:

- workspace load and identity;
- worker membership management;
- contribution checks based on membership;
- recognized Record acceptance;
- Asset / Asset-reference acceptance;
- protocol validation before acceptance;
- preservation of accepted Repository state;
- stable Record and Asset retrieval;
- listing workers, Records, and Assets.

These features describe the product behavior required for the MVP. The concrete Cordis service shape, persistence-provider contract, lifecycle rules, error types, test strategy, and other engineering choices are defined by [`../specs/repository-mvp.md`](../specs/repository-mvp.md).
