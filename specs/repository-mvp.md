# Repository MVP Specification

- **Status:** Draft — architecture rebaseline in progress
- **Target:** first usable Repository node
- **Requirements:** [Repository requirements](../docs/requirements.md)
- **Architecture:** [Repository architecture](../docs/architecture.md)

This umbrella Spec tracks the revised MVP. A merged implementation and a green CI do not, by themselves, accept a product-domain contract.

## Capability status

| Capability | Current source state | Product/architecture status |
| --- | --- | --- |
| Cordis Bootstrap | Implemented | Retain |
| Member over Core Entity | Runtime implemented | Retain; publishable artifact separately deferred |
| Repo establishment/identity | Implemented | Retain |
| `labour.record@0.1.0` | Implemented | Retain its agreed minimal fields and references |
| Exact ProtocolHash / verified artifact resolution | Implemented | Retain |
| Signed Record ingress / Runtime DB | MongoDB provider and narrow interface in #31 | CI / independent review pending; explicit journal test adapter retained |
| `asset.content@0.1.0` and Asset identity | Historical implementation exists | **Deferred — rework required** |
| Asset storage | Historical filesystem implementation exists | **Deferred — rework required** |
| Repo-signed `repo.contribution@0.1.0` | Implemented | Retain confirmed fact fields; storage/Asset integration requires revalidation |
| Contribution orchestration | Implemented against legacy providers | **Refactor pending** against the new DB and revised Asset contract |
| Standalone contribution Recovery (#10 / #47) | Withdrawn; runtime code removed | No staging/recovery service |
| Contribution history (#11) | Unimplemented | Defer implementation until DB/Asset boundary is settled |
| Concrete executable composition (#39) | Unimplemented | Defer integration until revised providers are ready |

The #31 implementation provides a MongoDB-backed Runtime Record DB with a replaceable interface; its CI and independent review remain pending. The withdrawn standalone Recovery code was removed in #47.

## Confirmed domain facts

### Core and Protocol

Core provides EntityPublicKey, Record identity/signature, ProtocolHash/verified artifact, and Block primitives. Exact ProtocolHash is the machine authority for interpretation. Repository and Cordis do not invent a second identity or plugin lifecycle system.

Member and Repo are compatible capabilities composed over Core identities. Repo establishment records creation provenance; it does not establish property ownership of the Repo or its labour results.

### Labour fact

`labour.record@0.1.0` remains one Member-signed Core Record with a minimal `Record.data` containing:

- `content` and subjective `duration`;
- optional paired RFC 3339 UTC `startAt/endAt`;
- `references[]` as confirmed upstream Asset references;
- `assets[]` as directly associated result references.

No `previous`, `pid`, mandatory full reference graph, tag, Project or status schema enters the base labour fact.

### Repo deliberation and acceptance fact

A Member-signed L is a complete labour record even without an Asset and without a Repo decision. The node can persist and present it independently. An associated Asset A is optional, with its actual identity/storage contract still deferred to #8.

Repo acceptance is **a later, independent positive decision**, ordinarily following a collective daily/weekly review of one or more labour records. Saving L, importing a Session, or storing an Asset does not itself mean that the Repo accepted labour. Deferred/rejected deliberation results are not inferred from absence of D; application-side review annotations and any future signed governance evidence remain distinct.

**Existing v0.1.0 contract (unchanged for historical compatibility):**

```text
Repo-signed Record D
  protocol = repo.contribution@0.1.0
  createdBy = Repo EntityPublicKey
  data = { labourRecordId, assetId, operator }
```

This v0.1.0 fact selects an Asset reference from the linked L. Its `assetId` is **required**. Positive Repo recognition of labour without an Asset is an agreed target **not representable by v0.1.0**; it requires a separately reviewed, versioned Protocol contract (conceptually `assetId?`). Do not reinterpret signed historical data or reuse the same exact ProtocolHash.

D and its `operator` identify the Repo-signed decision and recorded operator; they do not establish voting rules, quorum or authorization. One meeting may review many labour records without requiring a new meeting Record or batch-signing protocol now.

**A valid durable D is the Repository-local acceptance marker for a concrete Repo decision**, not a prerequisite for storing L. No pre-D database content, local function phase or app staging establishes an accepted contribution.

### Chain confirmation

Repository-local durable acceptance remains `pending-chain` unless independently accepted Block/chain-state evidence establishes `block-confirmed`. Producing a candidate Block, writing a database row or replaying an operation is not proof of Block inclusion.

## Revised Runtime DB architecture

**Each Repo is maintained by exactly one Node.**

```text
Repository domain/Protocol services
    -> narrow persistent Record store abstraction
    -> MongoDB provider (default)
    -> durable stored Core Records + concrete indexes

Alternative DB implementations
    -> same interface and failure/atomicity invariants
```

The already agreed Core Record / Repo acceptance fields are preserved. Board's proven interface + Mongo provider separation is a useful implementation reference; its Board-specific `pid`, patch and SnapshotHead schemas are not imported.

MongoDB handles recovery of successfully persisted state. The Repository node, after restarting, reconnects to the provider and reads those records. It does **not** persist/replay a second copy of user requests and does **not** automatically complete operations that never reached the acceptance marker.

**One Repo is maintained by one Node.** The provider exposes exact RecordId lookup, idempotent insertion, conflicts on non-equivalent duplicates and necessary domain queries. The owning Node enforces its Repo-local acceptance decisions against persisted DB facts. Multi-Node Repo writers, shared distributed uniqueness, transaction coordination and extra database-durability policy are not requirements. Index/cache/projection remains derived state, not fact authority.

See [Runtime Record Database Specification](./runtime-record-database.md). Previous persistence components and withdrawn contribution staging/recovery are code cleanup/migration tasks, **not the target design**.

## Asset boundary is deferred

The legacy bytes-only `asset.content@0.1.0`, content-derived identity, 16 MiB limit, `preserve/get/has` and filesystem storage are not accepted as a general Repo Asset model. They remain in source temporarily while design reviews distinguish an actual labour result, its representation, and Repo storage/management. See the [deferred Asset Spec](./asset.md) and [deferred Asset Storage Spec](./asset-storage.md).

The signed labour `references[] / assets[]` and Repo `assetId` relation fields stay as confirmed. **No new contribution/history/integration acceptance may silently depend on the old Asset storage contract being valid**.

## Contribution persistence without Recovery

The revised node does not have a standalone Recovery capability, staging queue or `recoverPending()`.

- Validate the supplied signed facts and concrete relations.
- Use the configured Runtime DB provider to persist accepted facts under the provider's actual uniqueness/atomicity guarantees.
- A signed L may be persisted, read and reviewed by itself; no A or D is required for this operation.
- Following an independent Repo positive decision, a valid D is written last in that concrete acceptance operation. D absent means no positive Repo acceptance fact is available, not that L is invalid or that the Repo rejected it. Existing v0.1.0 D still requires an Asset reference; no-A acceptance awaits a versioned Protocol change. Concrete Asset completion is deferred.
- On startup, read persisted facts and rebuild only derived state. Do not replay pre-D commands.
- Explicit caller retry of the same signed request remains allowed under RecordId and contribution-key idempotency rules.
- A durable acceptance Record whose required dependencies are corrupt/unavailable must surface an integrity/storage failure; do not silently heal it from the original request.

Contribution's previously implemented dependency on a concrete filesystem Asset store and old in-process persistence wrapper **must be revisited** during subsequent work; it is not ratified by this document.

## MVP integration acceptance — revised

The MVP will require:

1. One concrete executable Cordis composition that loads Member, Repo, exact Protocol resolution and a configured MongoDB-backed (or explicitly equivalent) Runtime Record DB provider.
2. Durable exact Records that survive DB/node restart with unchanged Core identity/signature and without false Block confirmation.
3. Repo establishment and reload, Member labour validation, and Repo acceptance semantics operating over the confirmed signed Record fields.
4. Repo same-key conflict and idempotent exact replay are enforced within the Repo's single owning Node using persisted database facts.
5. Explicit fail-closed behavior for corrupted/unavailable DB data or unavailable exact Protocol implementation.
6. Contribution-history pending-chain vs block-confirmed projection based on durable Record and real accepted-chain evidence.
7. Cordis plugin readiness/disposal and test/build/package checks on supported Node runtimes.
8. **Asset identity, storage/management and full Asset contribution end-to-end acceptance are deferred to #8 rework** and are not criteria for accepting the DB/documentation correction.

Deleted acceptance requirement: restarting a node automatically resumes an interrupted, pre-acceptance contribution from a durable request staging area. Database durability and reading persisted facts are the required guarantees; auto-completion of interrupted commands is not.

## Exclusions

No generic transaction coordinator, saga, Recovery intent Protocol, ContributionId, Repo domain copy of the chain, second plugin manager, owner/property-right model, generic relation engine, fixed UI/HTTP product, Block packer, peer sync or consensus implementation is implied.

MongoDB is a chosen default **Runtime provider**; its BSON `_id`, collections and indexes are never protocol identity. DB interchangeability must satisfy real behavior, not produce a speculative generic persistence framework.

## Next implementation sequence

1. Replace previous Runtime Record persistence with the narrow MongoDB-default adapter and focused RecordId/one-Node Repo acceptance tests (#31).
2. Review and rework Asset/Asset Storage from product requirements before restoring them as accepted capabilities (#8).
3. Recheck contribution against the revised DB and Asset boundaries.
4. Complete #11 and #39 after those prerequisites are settled.

The old #10 merge remains visible in Git history, but it is **withdrawn**, not a completed current MVP requirement.
