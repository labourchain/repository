# Repository MVP Specification

- **Status:** Draft
- **Target:** first usable Repository node capability
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)

This file is the umbrella Specification for the Repository MVP. It defines the MVP composition, cross-capability invariants and completion boundary. Stable capability contracts live in separate Specs under this directory.

The Specs are engineering projections of the current Requirements and Architecture. They do not replace product truth or architecture decisions.

## Capability Specs

| Spec | Stable capability boundary |
| --- | --- |
| [`bootstrap.md`](./bootstrap.md) | executable bootstrap and Cordis runtime integration |
| [`member.md`](./member.md) | human Member identity capability over Core Entity identity |
| [`repo.md`](./repo.md) | Repo establishment, stable identity, ownership, operator trace and loading |
| [`protocol-resolution.md`](./protocol-resolution.md) | exact ProtocolHash / verified artifact resolution |
| [`contribution.md`](./contribution.md) | Asset contribution, confirmation, Repository commit, staging and recovery |
| [`asset-storage.md`](./asset-storage.md) | durable preservation and retrieval of accepted Assets |
| [`contribution-history.md`](./contribution-history.md) | contribution-history view and derived projection |

These boundaries are capability boundaries, not Story or Task boundaries. A Story may depend on several Specs, and one Spec may be implemented through several Stories and Tasks.

## MVP composition

A usable Repository MVP is formed by a configured Cordis runtime that satisfies all capability Specs required for the following product flow:

```text
start Repository node
  -> recognize/load human Member identity
  -> establish or load Repo
  -> resolve exact ProtocolHash / verified implementations
  -> receive Asset + Member-produced Record + relations
  -> validate required Protocol semantics
  -> satisfy Member and Repo confirmations
  -> durably accept exact resulting Records
  -> durably retrieve accepted Asset
  -> report Repository COMMITTED / accepted
  -> later observe Block-confirmation status when available
  -> expose contribution history with pending-chain vs block-confirmed state
```

Repository capability may be provided by multiple Cordis plugins. No Spec requires a single Repository mega-service or one plugin per capability document.

A usable composition requires a durable Record ingress/journal for pre-pack accepted Records. Chain-state/Block-confirmation access is a distinct runtime capability used to identify actual chain inclusion. These may share an implementation later, but Repository does not conflate their semantics.

## Shared invariants

### Cordis is the runtime plugin model

Repository does not create a second Runner, Hoster, Plugin Manager, Service Container, dependency system or lifecycle system around Cordis.

Protocol implementations, Runtime providers, projections and adapters are all composed through Cordis. A Protocol implementation is a Cordis plugin that implements one stable LabourChain Protocol identity/version.

### Member and Repo reuse Core identity

Member and Repo do not create separate identity namespaces. Both are protocol compositions over Core `EntityPublicKey` identities.

`Member` is the program/protocol term for a human participant. `Worker` remains a conceptual labour-subject term where useful and must not be confused with runtime/process worker types.

A Member may compose Repo capability on the same Entity identity/keypair. Repo establishment may identify that Member as the Repo owner, but this does not itself define ownership of Assets, labour results, private-property status or economic rights.

### Repo contributors are a derived/product view

Labourer and Repo remain independent identities. The MVP does not create a `repo.membership` fact or require membership as contribution eligibility.

Repo-accepted contributions are the durable relationship between them. A product may derive contributor/member lists from contribution history, and may store groups, tags or filters as local software data. These organization views are not chain validity inputs.

Repo decisions that are represented on chain are signed by the Repo identity and record the actual operator in signed Protocol data. Organization authorization and governance remain outside the Repository MVP.

### Historical Protocol semantics are exact

Historical facts carry a human-readable Protocol reference and an exact `ProtocolHash`. The hash is the machine authority for selecting the descriptor / executable artifact used to interpret that fact. Resolution must verify the exact artifact through the Core boundary and cross-check the human-readable reference; missing exact hashes fail explicitly.

A historical fact must never silently fall back to `latest`, a different artifact with the same version string, a nearest compatible version, or another installed implementation.


### Repository Runtime is not the chain trust root

Repository Runtime is the normal production path for validating, relating, retaining and preparing candidate Records, but chain validity does not depend on a producer having executed the official Repository implementation.

Before Block confirmation, a node may replace, add or discard candidate Records. A specific signed Record remains bound by its RecordId and signature; changing signed content requires a value that independently satisfies the corresponding Record identity and signature rules.

When the next Core Block contract is implemented, the Header carries a `vroot` deterministically derived from the Block Records' direct `(protocol, protocolHash)` references. There is no separate ValidationManifest or Header-level plugin list. Peer validation recomputes `vroot` from the actual Records, then L1 resolves those exact ProtocolHashes and validates the Records and their Protocol-defined relationships independently of the producer's Runtime state.

Records in one Block may form one or more Protocol-defined production trees / forests or other explicit dependency structures. The validator must validate those relationships as part of Block validity. Repo ownership and decision-operator facts are not production-causality edges and do not require every fact type to participate in one global DAG.

The MVP does not require a general smart-contract VM, trusted execution environment, full Block packer, peer validator, synchronization or consensus implementation. It only preserves the Runtime and Protocol boundaries those later capabilities will consume.

### Labour Records remain labour facts

A Record describing labour is produced/signed by the Member acting as labour subject, with stable identity/signature semantics supplied by Core. Other Protocol facts may assign authorship to another Entity identity; Repo decision facts are signed by the Repo identity and retain their actual operator in signed Protocol data. Repository does not turn either kind of Record into a Repository-owned domain object or maintain a canonical `repo.records[]` collection.

### Durable Record ingress is not Block confirmation

A configured Repository node must be able to durably retain exact signed Records that belong to Repository-accepted work before those Records are packed into a Block.

Successful durable ingress means the Record can survive restart and continue toward chain inclusion. It does not mean the Record has already been confirmed by the chain.

### Repository acceptance is distinct from chain confirmation

Repository execution and chain confirmation are separate status dimensions.

A contribution reaches Repository `COMMITTED` only when:

- the applicable contribution requirements and domain confirmations are satisfied;
- every required exact Record is durably accepted by the Record journal; and
- the accepted Asset can be durably retrieved.

The Repository execution path is:

```text
STAGED -> DOMAIN_CONFIRMED -> COMMITTED
```

`COMMITTED` is the Repository product acceptance boundary.

Its chain status is separately `pending-chain` until accepted-chain evidence shows that the relevant Records are included in an independently validated Block, at which point it may be represented as `block-confirmed`. Merely producing or locally packing a candidate Block is not chain confirmation.

### Runtime state types remain distinct

Repository Runtime may persist several kinds of state with different roles:

```text
accepted Record journal
    -> durable exact accepted Records until safe chain handoff/inclusion
    -> not itself Block confirmation

Runtime Record database
    -> protocol-validated Record relationships, ordering/dependencies and pending packing state
    -> correctness input for Repository validation, tracing and later Block packing
    -> rebuildable/reconcilable from durable Records + exact Protocol semantics
    -> not itself canonical-chain or Block confirmation

staging
    -> in-flight processing/recovery before Repository commit

index/cache/projection
    -> derived query/display acceleration
    -> rebuildable from Runtime Record database and other durable sources
```

The Runtime Record database is not merely a query cache: Repository validation and packing may depend on its reconciled relationship state. Persistence alone still does not turn Runtime database, staging, index/cache/projection, or journal state into chain-confirmed facts.


Repo state evolution uses Record + Patch facts. Runtime Snapshot is a materialized cache/projection derived from those facts under exact Protocol semantics: it may accelerate recovery and reads, may be discarded and rebuilt, and must not be written back as a substitute for the Record + Patch history or treated as an independent chain fact.

### Recovery converges to durable Repository state

Runtime restart or crash must not expose pre-commit work as accepted or lose already Repository-committed work.

Recovery must reconcile exact Record-journal state, Asset durability and staging so repeated recovery does not create duplicate Record acceptance, singular confirmations or Asset finalization.

Block-confirmation status is reconciled separately from chain state when that capability is available.

### Product boundaries remain external

LabourFlow may provide a personal product experience over same-identity Member + Repo protocol composition. RawEntry recognition and Record drafting belong to LabourFlow or another upper-layer product. Project organization and LabourBoard planning, analysis and presentation remain outside Repository.

The personal product experience must not turn Repo association into an implicit private-property model.

## Cross-Spec relationships

The capability Specs depend on each other through contracts rather than ownership:

```text
bootstrap
  -> provides Cordis runtime

member
  -> uses Core EntityPublicKey
  -> identifies a human Member
  -> may compose Repo on the same identity/keypair

durable Record ingress / journal
  -> Runtime/composition dependency
  -> retains exact accepted Records across restart

Runtime Record database
  -> Runtime/composition dependency
  -> serializes validated Repository Record ingress in one node
  -> delegates exact Record durability to the journal
  -> does not define generic relationship state before the first concrete consumer

chain-state / Block-confirmation access
  -> Runtime/composition dependency
  -> tells whether RecordIds are included in accepted Blocks

repo
  -> uses Core EntityPublicKey + Member capability + establishment Record
  -> requires the Repo identity to sign its own establishment Record
  -> requires Record.data.owner to be a Member
  -> persists accepted establishment Record through durable ingress
  -> derives initial owner from the signed Record.data.owner

protocol-resolution
  -> resolves exact historical Protocol implementations

contribution
  -> uses protocol resolution + durable Record ingress
  -> reaches Repository COMMITTED before Block packing
  -> requires durable Asset retrieval

asset-storage
  -> preserves accepted Asset content

contribution-history
  -> projects Repository-committed contributions
  -> augments them with Block-confirmation status when available
```

A capability may be implemented by one or more Cordis plugins. These Spec files do not prescribe package boundaries unless an actual protocol/version/lifecycle boundary requires one.

## Shared implementation rules

Implementation must:

- reuse Core Protocol, Entity, Record, signature and Block semantics rather than duplicating them;
- treat Member and Repo as protocol-composed identities, not fixed provider-owned object schemas;
- persist exact accepted Records through an explicit Runtime/composition dependency rather than a Repository-domain `records[]` model;
- use the Repository Runtime database as the serialized ingress boundary; concrete Protocol-owned relationship / pending-packing state is added only when a real consumer such as #9 requires it, without turning that runtime state into a second blockchain or canonical-chain authority;
- treat Repository Runtime validation as the normal producer path rather than a chain trust root; peer validation of a future Block must recompute the Record-derived `vroot`, resolve exact ProtocolHashes from the actual Records, and independently validate their semantics and relations;
- keep Repo fact evolution in Record + Patch history while treating Snapshot only as rebuildable Runtime materialization;
- distinguish durable pending-chain acceptance from actual Block confirmation;
- fail closed when required durable ingress, Core primitive or exact ProtocolHash / verified implementation is unavailable;
- keep concrete database, filesystem and transport choices behind Runtime/plugin boundaries;
- avoid process-global mutable Repository state;
- acquire and dispose plugin-owned resources through Cordis lifecycle ownership;
- keep Repo ownership limited to Repo identity control/responsibility and avoid prematurely introducing Asset/property-right semantics, organization governance, complex ACL, search, synchronization, consensus, settlement or private-proof systems.

Exact TypeScript names, package names, metadata field names, database schemas, HTTP routes and UI are not fixed by the MVP Specs unless a later accepted Requirement or Architecture decision requires them.

## Integrated acceptance

In addition to the acceptance tests defined by each capability Spec, the MVP integration path must demonstrate that:

1. a Repository node can start with its configured Cordis plugins;
2. a Core Entity identity can satisfy the Member capability without receiving a second Member ID;
3. a valid Member can establish a Repo from an exact establishment Record and reload it after restart;
4. the same Entity identity may compose Member + Repo capability without creating a second keypair or implying Asset/labour property rights;
5. a labour / Asset contribution resolves and verifies the exact required ProtocolHash / implementation artifacts;
6. valid confirmations, durable Record ingress and durable Asset retrieval produce Repository `COMMITTED` / accepted state;
7. the accepted Asset remains retrievable after restart;
8. an interrupted contribution recovers without false acceptance or duplicate durable Record acceptance;
9. a Repository-committed contribution appears in contribution history as pending-chain before Block inclusion;
10. when chain-state access reports Block inclusion, the same history entry can be represented as block-confirmed without changing its Repository acceptance identity;
11. Project and Board concepts are not required for the Repository MVP flow;
12. plugin activation/disposal does not leak or duplicate owned resources.

An in-memory-only path may be used for isolated unit or contract tests but does not by itself satisfy the usable Repository MVP because restart and recovery behavior are part of the product requirements.

Block packing itself is outside this Repository MVP. Integration tests may use a narrow fake/fixture chain-state adapter to test status transitions without implementing a packer or consensus system.

## MVP exclusions

The Spec set does not require:

- a complete `member.profile` schema or profile product UX;
- a separate Personal Repo entity/keypair;
- Asset/labour private-property ownership semantics;
- Project or Board planning, analysis or presentation;
- public/common usage accounting or revenue distribution;
- general Private Repo permission systems or chain-level Repo membership/governance;
- zero-knowledge proofs;
- advanced ACL or role hierarchies;
- advanced search, full-text indexing or large-scale query infrastructure;
- block-packing internals;
- node synchronization or consensus;
- a Repository-domain canonical Record store or second blockchain;
- a specific database, filesystem, HTTP API or UI;
- a fixed monorepo package layout.

## Implementation completion

Repository MVP implementation is complete when the configured bootstrap and Cordis plugin set satisfy this umbrella Spec and each applicable capability Spec, Member/Repo identity composition is preserved, the durable Record ingress path demonstrates restart/recovery behavior, pending-chain and Block-confirmed status are not conflated, exact ProtocolHash / artifact resolution is verified, meaningful tests pass, and build/package checks succeed on supported Node versions.

## Spec evolution

A new Task does not require a new Spec.

Create or split a Spec when a capability has a stable independent contract, meaningful invariants and an evolution boundary worth maintaining separately. Stories and Tasks are delivery slices over these contracts.

If implementation exposes a missing product need, update Requirements first. If it exposes a structural issue without changing product behavior, update Architecture first. Then update the affected capability Spec before changing implementation behavior.
