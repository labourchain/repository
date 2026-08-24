# Repository requirements

Repository is the LabourChain warehouse capability for Assets. This page defines the product requirements for the Repository MVP and is the current source of truth for Repository product behavior.

The domain terms used here are defined under [`concepts/`](./concepts/). See [Repo](./concepts/repository.md), [Worker / Member](./concepts/worker.md), [Record](./concepts/record.md), and [Asset](./concepts/asset.md).

## Scope

The Repository MVP covers Repo establishment and loading, membership, Asset contribution, Repo-side labour confirmation, durable Asset storage and retrieval, and Repo contribution history.

Record is an on-chain labour fact. It is not canonical Repository content alongside Asset. Repository may keep projections of Records related to its own contributions for routine queries and analysis.

## Repo establishment and identity

Any Worker can establish a Repo. Each Repo has a stable identity so clients can load the same Repo later and distinguish it from other repositories.

Each Repo has an operator responsible for maintaining the Workers allowed to contribute to it. The MVP does not require a larger role hierarchy.

## Personal Repo

Each Worker has a default Personal Repo for private Assets that have not been contributed to another Repo.

Personal Repo uses the same basic warehouse model as other Repos but remains private in the current product model. It stores Assets and does not maintain a separate personal Record store. Worker labour history still comes from on-chain Records.

## Membership

A Repo maintains the Workers allowed to contribute to it. The operator can add and remove members, check whether a Worker is a member, and inspect the current membership.

Membership only controls contribution to that Repo. It does not restrict a Worker from producing Records or Assets outside the Repo.

## Asset contribution

A Worker contributes an Asset to a Repo. The contribution also relates the worker-produced Record that describes the relevant labour.

The contributor must already be a member of the Repo. An accepted contribution has the following product behavior:

- the contributing Worker and membership relationship are identifiable;
- the Asset, related Record, and contribution relationship satisfy the applicable LabourChain protocols;
- the Repo accepts and preserves the Asset without changing its protocol meaning;
- the Repo confirms the labour related to the contribution;
- the contribution can later be observed in the Repo contribution history.

A failed contribution must not appear as accepted by the Repo.

Repo contribution describes labour that includes an Asset submission. Labour that produces no submitted Asset may still produce a Record.

## Preservation

Repo identity, operator, membership, and accepted Assets are durable Repository state. A normal application restart must not make this state disappear in a usable deployment.

The canonical Record remains on chain. Repository may keep a local Record projection so routine access does not require rebuilding the complete contribution history for every request. The projection is rebuildable data and is not the source of truth for Record.

Corrections and version relationships for an Asset or Record follow the protocol that owns the object. Repository does not silently rewrite accepted facts for storage or presentation convenience.

## Asset retrieval and browsing

Consumers can retrieve an accepted Asset through its stable LabourChain identity or reference and distinguish an existing Asset from one that is not present.

The MVP also allows consumers to inspect the current members and Assets of a Repo. Advanced search, pagination, and indexing are not product requirements until an actual consumer or scale requirement makes them necessary.

## Contribution history

Consumers can inspect labour history associated with a Repo, including contributions that the Repo accepted and confirmed.

Contribution history comes from on-chain Records related to Repo contributions, not from a canonical `records[]` collection owned by Repository. Routine access should not require a full chain reconstruction for every query. Runtime caches or indexes may serve this view.

## Protocol validity

Repository accepts a contribution only when its Asset, related Record, and required contribution relationships satisfy the applicable LabourChain protocols.

Repository does not define a second set of Asset, Record, identity, or confirmation semantics.

## Outside the MVP

The current Repository MVP does not require public or commons usage accounting, benefit distribution, general Private Repo support, zero-knowledge proofs, or Project and Board planning, analysis, and presentation features.

These concepts may remain documented under [`concepts/`](./concepts/) and enter product requirements when they become part of a concrete product scope.