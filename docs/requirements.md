# Repository Requirements

This document is the single source of truth for Repository product requirements during the MVP phase.

The domain concepts used here are maintained under [`concepts/`](./concepts/), with [`concepts/README.md`](./concepts/README.md) as the terminology index. Concept documents define the shared model; this file states the Repository behavior required by the product. Specifications under `specs/` are engineering projections of these requirements.

If concepts and requirements no longer describe the same product model, review that mismatch before changing the Spec or implementation. If a Spec conflicts with this document, the requirements are authoritative for product behavior.

## Product intent

A LabourChain Repository is a warehouse for Assets produced by workers. It keeps a stable Repository identity, maintains the workers allowed to contribute, preserves accepted Assets, and participates in confirming the labour Records associated with those contributions.

Record is not Repository content in the same sense as Asset. A Record is an on-chain labour fact produced by a worker. Repository contribution history is reconstructed from Records related to that Repo, although runtime services may keep local projections for routine use.

The first usable product should support this loop:

```text
worker establishes or joins a Repo
  -> worker performs labour
  -> labour produces a Record and an Asset
  -> worker contributes the Asset to the Repo
  -> Repo validates the contribution and confirms the related labour
  -> Repo preserves the accepted Asset
  -> the Asset and Repo contribution history remain available later
```

The MVP is successful when this works predictably for a small team without treating Record as a second class of stored Repository content.

## Repository establishment

Any worker can establish a Repository. A Repo needs a stable identity so clients can load it again and distinguish it from other repositories.

Each Repo has an operator responsible for managing its worker relationships. The requirements do not introduce a larger role hierarchy for the MVP.

A worker can also have a default Personal Repo for Assets that have not been contributed to a shared or published Repo. Personal Repo follows the same basic Repository model but is private in the current product model. It stores Assets, not a separate personal `records` collection.

## Worker relationships

Repository maintains which workers may contribute Assets to it. The operator needs to be able to add and remove workers, check membership, and list the current workers.

Membership controls contribution to that Repo. It does not determine whether a worker can perform labour, produce a Record, or produce an Asset outside the Repo.

## Asset contribution and Repository confirmation

Workers contribute Assets to a Repository. A contributor must be a member of that Repo before the contribution can be accepted.

A contribution is accompanied by the worker-produced Record that describes the labour related to the Asset. The Record remains an on-chain labour fact associated with its worker. Repository does not take ownership of it or turn it into an internal Record object.

For a successful contribution, Repository needs to:

- identify the contributing worker;
- confirm that the worker may contribute to the Repo;
- validate the Asset and the related Record according to their LabourChain protocol rules;
- accept and preserve the Asset without silently changing its meaning;
- participate in the Repo-side confirmation of the related labour;
- make the contribution visible later from the Repo contribution-history view.

A failed contribution must not appear as an accepted Repository contribution.

## Preservation

Repository identity, operator and worker relationships, and accepted Assets are durable Repository state. In a usable small-team deployment, a normal application restart must not make that state disappear.

The canonical Record remains on chain. A Repository may keep a local Record projection or cache so normal analysis does not require rebuilding the full history on every request. That projection is derived data and may be rebuilt from the chain.

Corrections or later versions of an Asset or Record follow the protocol that owns that object. Repository does not rewrite accepted facts in place for storage or presentation convenience.

## Asset retrieval and browsing

Consumers need to retrieve accepted Assets through their stable LabourChain identity or reference and distinguish an existing Asset from one that is not present.

For a small-team MVP, consumers also need to inspect the current workers and Assets in a Repo. Advanced search, pagination, and indexing are not product requirements until a real consumer or scale problem requires them.

## Contribution history

Consumers need to inspect the labour history associated with a Repo. This view answers which worker contributions the Repo accepted and confirmed.

Contribution history comes from the Records related to the Repo, not from a canonical `records[]` collection owned by Repository. Runtime caches and indexes may make this view fast, but they do not become the source of truth for Record.

## Protocol validity

Repository only accepts a contribution when its Asset, related Record, and required contribution relationships satisfy the applicable LabourChain protocol rules.

The concrete validation and confirmation APIs are engineering choices defined in the Spec. Repository requirements do not define a second set of protocol semantics.

## Current feature set

The first Repository feature set consists of:

- establishing and loading a Repo with a stable identity;
- supporting a worker's default Personal Repo as the current private Repository form;
- operator-managed worker membership;
- Asset contribution by Repo members;
- validation of the Asset and related Record before contribution acceptance;
- Repo-side confirmation of the related labour;
- durable preservation and retrieval of accepted Assets;
- listing Repo workers and Assets;
- exposing Repo contribution history from related Records without treating those Records as canonical Repository storage.

The concrete Cordis service shape, persistence-provider contract, lifecycle rules, error types, Record projection strategy, tests, and other engineering choices are defined by [`../specs/repository-mvp.md`](../specs/repository-mvp.md).
