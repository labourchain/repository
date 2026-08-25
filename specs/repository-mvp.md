# Repository MVP Specification

- **Status:** Draft
- **Target:** first usable Repository node capability
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)

This Spec is the engineering projection of the current Repository Requirements and Architecture. It defines the contracts that implementation and tests must satisfy without replacing Cordis with a Repository-specific runtime model or redefining LabourChain protocol semantics.

## Purpose

Repository provides LabourChain warehouse capability for Assets and participates in Repo-side confirmation of labour related to accepted contributions.

The MVP must support Repo identity and loading, operator and membership relationships, Asset contribution, Repo-side confirmation, durable Asset preservation and retrieval, contribution history, and exact Protocol-version interpretation for historical facts.

Record remains a Worker-produced on-chain labour fact. Repository does not own a canonical Record store.

Repository capability may be formed by multiple Cordis plugins. This Spec does not require a single Repository service or a one-plugin-per-requirement layout.

## Runtime model

Repository follows the Cordis plugin runtime model.

A usable Repository node starts from a stable bootstrap implementation. The bootstrap has an executable entry point, creates the Cordis application, and loads the configured plugins through Cordis. Its stable implementation version is declared using the LabourChain Protocol format, so a running node is an instance of a specific Bootstrap Protocol version.

After Cordis starts, Repository must not introduce a second Runner, Hoster, Plugin Manager, Service Container, dependency system, or lifecycle system. Plugin dependencies, Context, Service, Effect, activation and disposal use Cordis mechanisms.

Exact package names and workspace layout are not part of this Spec.

## Plugin model

All Repository runtime capabilities are Cordis plugins.

A plugin that defines semantics which on-chain facts may reference over time is additionally treated as a Protocol plugin. A Protocol plugin must have a stable Protocol identity and Protocol version according to LabourChain Core semantics.

The distinction between Protocol plugins and Runtime or product plugins is a responsibility distinction, not a second plugin type system.

Plugin boundaries should follow protocol versioning, lifecycle and independent reuse. Requirements must not be mechanically converted into one plugin per CRUD operation.

Generic Protocol capabilities that are independently useful outside Repository, such as Asset or Asset-Record relation semantics, must not require consumers to load the complete Repository product runtime. This allows LabourFlow and other products to reuse those protocols independently.

## Protocol version resolution

Historical facts are interpreted and validated against the exact Protocol identity and version that they reference.

The runtime must satisfy the following behavior:

- more than one version of the same Protocol may be loaded at the same time;
- a historical fact is dispatched to the implementation matching its referenced Protocol identity and version;
- an unavailable required version fails explicitly;
- the runtime must not silently fall back to `latest`, another installed version, or an implementation selected only because it is newer;
- introducing a new Protocol version must not silently change the semantics of an older version already referenced by historical facts.

This Spec does not prescribe the final metadata field names or package naming convention. The implementation must expose enough stable metadata for Cordis-loaded Protocol implementations to be resolved by Protocol identity and version.

Repository must not copy or redefine Core schemas for Record, Asset, identity, signature, confirmation, commit or block semantics.

## Repo capability

Repository must provide behavior equivalent to the following operations. Exact TypeScript API names and whether the behavior is exposed through one or several Cordis services remain implementation choices.

### Establish and load Repo

A Worker can establish a Repo and later load the same Repo by stable LabourChain identity.

Establishment records the Repo operator relationship. Repository must reuse LabourChain identity semantics and must not create a second Repository-specific identity namespace.

Repo identity and operator state must survive ordinary application restart in a usable deployment.

### Membership

The Repo operator can add and remove Workers from the Repo membership set. Consumers can check membership and list current members.

Behavior is equivalent to:

```text
addMember(repo, operator, worker)
removeMember(repo, operator, worker)
hasMember(repo, worker)
listMembers(repo)
```

Only the operator may change membership. Membership determines whether a Worker may contribute an Asset to the Repo; it does not determine whether that Worker may create Records or Assets elsewhere.

Adding an existing member must not create duplicate membership. Removing a missing member must not create new state.

Membership state must survive ordinary application restart in a usable deployment.

## Asset contribution

Repository receives an Asset contribution associated with a Worker-produced Record and the relations and confirmations required by the applicable Protocols.

Repository does not transform RawEntry into Record and does not become the Record producer.

A contribution may be reported as accepted only after all of the following are true:

1. the contributor is a current Repo member;
2. every required Protocol identity and version is available;
3. the Asset, Record and contribution relations are valid under their referenced Protocol versions;
4. the required Worker confirmation is satisfied;
5. the required Repo-side confirmation is satisfied;
6. the contribution has successfully reached canonical committed state through Core;
7. the accepted Asset can be durably retrieved by its stable LabourChain identity or reference.

Block packing is not part of Repository acceptance. A contribution may be accepted while committed but not yet packed.

Repository must not enrich, classify, summarize or silently rewrite the Asset or Record during this flow.

## Contribution execution state

The MVP uses the following execution model:

```text
STAGED
  -> required confirmations satisfied
CONFIRMED
  -> Core commit succeeds
COMMITTED
  -> later Core block packing
PACKED
```

`STAGED` is runtime state and is not a canonical fact merely because it is persisted.

`CONFIRMED` describes that the confirmation conditions required by the applicable Protocol have been satisfied. It does not mean that Repository has accepted the contribution.

`COMMITTED` is the Repository acceptance boundary.

`PACKED` belongs to later Core block packing and is outside Repository completion.

The state labels above describe the contribution execution flow. They do not require Repository to invent new canonical entities when the same meaning is already represented by Core facts and Protocol-defined relations.

## Staging, durability and recovery

A usable deployment must use durable staging for contribution data needed to recover safely across process restart.

An in-memory staging implementation may be used for isolated tests, but it does not satisfy the usable-deployment persistence contract.

The staging and recovery implementation must satisfy these invariants:

- staged or confirmed-but-uncommitted work must never be exposed as an accepted contribution;
- process restart must not lose the information required to determine whether an in-flight contribution was committed;
- if Core commit succeeded before a crash, recovery must converge to an accepted state in which the Asset is retrievable;
- if Core commit did not succeed, recovery must not invent a committed contribution;
- retrying recovery must not create duplicate accepted Assets, duplicate contribution commits, or duplicate confirmations where the applicable Protocol defines them as singular facts;
- staging cleanup may occur after commit, but cleanup failure must not make a committed contribution appear uncommitted.

The implementation may resume, reconcile or discard uncommitted staged work as long as these invariants hold. This Spec does not prescribe a database transaction model or staging schema.

Runtime storage must retain enough correlation information to reconcile staged work with the corresponding canonical commit state without relying on process memory.

## Asset persistence and retrieval

A committed contribution must make its accepted Asset durably retrievable.

Repository must support behavior equivalent to:

```text
getAsset(repo, assetIdentityOrReference)
listAssets(repo)
```

Retrieval must distinguish an existing accepted Asset from a missing Asset.

Provider-native file paths, database keys, row IDs or collection names must not replace LabourChain Asset identity.

Storage and indexing must not silently alter the accepted Protocol meaning of the Asset.

The concrete persistence technology is a Runtime provider concern and is not fixed by this Spec.

## Contribution history

Repository must expose a view of labour related to accepted Repo contributions.

Contribution history is derived from canonical Records, Assets, confirmations and relations associated with committed Repo contributions. Repository must not model it as a canonical `repo.records[]` collection or expose a general canonical Record-store API.

Runtime plugins may persist cache, index or projection data so ordinary history queries do not require a full-chain scan. Such data must remain distinguishable from canonical facts and must be rebuildable or repairable from canonical sources when the required chain-query capability is available.

Recovery after a crash between commit and projection update must not permanently omit the committed contribution from Repository history.

## Runtime provider contracts

Repository may use one or several Runtime provider plugins. Provider boundaries must be replaceable without changing LabourChain protocol semantics.

A usable deployment needs provider capabilities sufficient for:

- durable Repo identity and operator state;
- durable membership state;
- durable accepted Asset payload or content required for retrieval;
- durable contribution staging and recovery correlation;
- contribution-history cache, index or projection when used for routine queries.

Providers may expose more specialized internal operations, but they must not present derived Record projections as canonical Record storage.

Storage failures must be surfaced to the calling capability and must not result in a false accepted state.

## Cordis integration contract

Repository plugins must behave as normal Cordis plugins.

Implementation must:

- acquire and release plugin-owned resources through Cordis lifecycle ownership;
- declare runtime dependencies through Cordis-compatible mechanisms;
- avoid process-global mutable Repository state;
- allow repeated activation and deactivation without duplicating plugin-owned resources;
- use Cordis Context and Service mechanisms when plugins share runtime capabilities;
- avoid creating Repository-specific substitutes for Cordis dependency, lifecycle or plugin-management behavior.

Package import alone must not start network listeners, open persistent storage, mutate global process state or perform other external work.

## Core boundary

Repository consumes Core facts and Protocol semantics rather than redefining them.

The implementation may use narrow adapters while Core runtime APIs are still stabilizing, but such adapters must:

- remain internal implementation details;
- fail closed when a required Core capability or exact Protocol version is unavailable;
- avoid copying Core protocol definitions into Repository as a second source of truth;
- be replaceable when the corresponding Core capability becomes directly available.

Repository does not implement block packing, peer synchronization or consensus.

## External product boundaries

Personal Repo is a LabourFlow product module, not a special Repository mode. Repository may provide generic Protocol plugins that LabourFlow can reuse, but this package does not own Personal Repo establishment or lifecycle.

RawEntry recognition, natural-language input and Record drafting belong to LabourFlow or other upper-layer products.

Project organization and LabourBoard planning, review, analysis and presentation remain external. Repository retrieval, membership and contribution history must work without Project or Board concepts.

## Failure model

Consumers must be able to distinguish failures that require different handling. At minimum, implementation must surface distinct failure categories for:

- Repo not found or unavailable;
- actor is not the Repo operator for a membership change;
- contributor is not a Repo member;
- required Protocol identity or version is unavailable;
- Asset, Record or contribution relation is rejected by the applicable Protocol;
- required confirmation is absent or rejected;
- Core commit fails or its result cannot be determined safely;
- staging or recovery fails;
- accepted Asset persistence or retrieval fails;
- requested Asset is not present.

Errors should contain enough context for diagnosis without embedding full Asset payloads or other large or sensitive data by default.

## Acceptance tests

Tests protect requirements, protocol-version behavior, meaningful recovery paths and Cordis lifecycle contracts. Coverage percentage alone is not an acceptance criterion.

The MVP test set must demonstrate at least that:

- a Repo can be established and loaded again with the same identity;
- operator and membership state survive restart with a persistent test provider;
- the operator can add, list, check and remove members;
- a non-operator cannot change membership;
- a non-member contribution cannot become accepted;
- a valid member contribution using available exact Protocol versions can become committed and its Asset can be retrieved;
- an invalid Asset, Record or relation is rejected before accepted state is exposed;
- a required missing Protocol version fails rather than falling back to another version;
- two versions of the same Protocol can coexist and historical facts resolve to their referenced version;
- a crash before commit does not expose the staged contribution as accepted;
- a crash after successful commit but before staging cleanup can recover to an accepted, retrievable Asset without duplicating the commit;
- accepted Assets remain retrievable after ordinary restart;
- contribution history contains committed contributions and does not behave as canonical Repository Record storage;
- package import performs no external work;
- Cordis activation and disposal do not leak or duplicate plugin-owned resources.

Do not add tests solely to increase coverage. Each test should protect a user-visible requirement, a nontrivial protocol or recovery invariant, a Cordis lifecycle contract, or a reproduced regression.

## MVP exclusions

This Spec does not require:

- Personal Repo product behavior;
- Project or Board planning, analysis or presentation;
- public/common usage accounting or revenue distribution;
- a general Private Repo permission system;
- zero-knowledge proofs;
- advanced ACL or role hierarchies;
- advanced search, full-text indexing or large-scale query infrastructure;
- block-packing internals;
- node synchronization or consensus;
- a specific database, filesystem, HTTP API or UI;
- a fixed monorepo package layout.

## Implementation completion

The Repository MVP implementation is complete when the configured Cordis plugin set and bootstrap behavior satisfy this Spec, the required persistent Runtime provider path demonstrates restart and recovery behavior, exact Protocol-version resolution is verified, the relevant tests pass, and build and package checks succeed on supported Node versions.

An in-memory-only implementation may satisfy isolated contract tests but does not by itself satisfy the usable Repository MVP.

## Spec changes

`docs/requirements.md` remains the source of product truth and `docs/architecture.md` remains the source of structural design decisions. This Spec is their mutable engineering projection during the MVP phase.

If implementation exposes a missing product need, change Requirements first. If it exposes a structural problem without changing product behavior, change Architecture first. Then update this Spec before changing implementation behavior.

Numbered or immutable Spec history can be introduced later if maintenance requires that traceability.
