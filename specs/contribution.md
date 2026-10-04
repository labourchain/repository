# Contribution Specification

- **Status:** Draft
- **Scope:** Repository orchestration for one concrete labour / Asset contribution
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)
- **Repo acceptance Protocol:** [`repo-contribution.md`](./repo-contribution.md)

## Purpose

A Repository contribution is the process by which a Member submits one Asset
associated with a Member-produced `labour.record@0.1.0` Record and a
Repo-signed `repo.contribution@0.1.0` acceptance Record.

The current #9 vertical slice is deliberately concrete. It does not require a
generic relation Protocol, generic confirmation Protocol or generic Patch
framework.

The minimum signed facts are:

```text
Member-signed labour Record L
    -> proves the Member-side labour assertion
    -> references[] identifies confirmed input Assets
    -> assets[] identifies result Assets

Repo-signed acceptance Record D
    -> protocol = repo.contribution@0.1.0
    -> selects L by labourRecordId
    -> selects one result Asset A by assetId
    -> records actual operator
```

The accepted Asset itself is the exact immutable Asset defined by
[`asset.md`](./asset.md) and durably handled by
[`asset-storage.md`](./asset-storage.md).

Repository does not produce the Member's labour Record, rewrite its relations,
or own Repo private-key signing.

## Contribution input

The minimum #9 submission shape is behaviorally equivalent to:

```ts
interface ContributionRequest {
  readonly asset: Asset
  readonly labourRecord: CoreRecord
  readonly acceptanceRecord: CoreRecord
}
```

No separate contributor, Repo, relation object, confirmation object,
ContributionId or Patch object is required.

Those values are derived from the signed facts:

```text
contributor
    = labourRecord.createdBy

Repo
    = acceptanceRecord.createdBy

accepted AssetId
    = acceptanceRecord.data.assetId

labour relation
    = acceptanceRecord.data.labourRecordId
      + labourRecord.references[]
      + labourRecord.assets[]

operator
    = acceptanceRecord.data.operator
```

The supplied `asset.id` must equal
`acceptanceRecord.data.assetId`.

## Member-side confirmation

The valid Member-signed `labour.record@0.1.0` is the Member-side confirmation
for this MVP contribution.

Its existing validation already requires:

- a valid Core Record;
- a valid author signature;
- an author satisfying the Member capability;
- exact `labour.record@0.1.0` Protocol semantics.

The signed `references[]` and `assets[]` are therefore the concrete
Member-confirmed Asset relations. #9 must not introduce a second
Member-confirmation Record.

## Repo-side confirmation

Repo-side acceptance is the concrete
`repo.contribution@0.1.0` fact defined in
[`repo-contribution.md`](./repo-contribution.md).

Its enclosing Core Record supplies the Repo identity and Repo signature.
Its data supplies:

```text
labourRecordId
assetId
operator
```

The Record is a positive acceptance fact only. Absence of such a fact is not a
durable rejection.

## Asset relation policy

For one concrete contribution:

```text
labour.references[]
    -> confirmed upstream production/citation references

acceptanceRecord.data.assetId
    -> selected result Asset accepted by this Repo

labour.assets[]
    -> all result Assets declared by the Member
```

The selected accepted Asset must occur in `labour.assets[]`.

The current labour Record schema does not distinguish mandatory execution
inputs from contextual/citation references. Therefore current
`repo.contribution@0.1.0` does not infer a local-durability prerequisite for
every AssetId in `labour.references[]`.

The selected result Asset must be durably retrievable before Repository commit.
It may already exist in Asset storage or may be supplied by the current request
and preserved idempotently.

Other AssetIds in `labour.assets[]` are not automatically accepted and are
not required to be locally durable for this specific contribution. A Repo may
accept them separately.

If one AssetId appears in both `references[]` and `assets[]`, and the
Repository initially lacks it, preserving/getting that submitted selected
result Asset is sufficient for current #9 Asset availability. Its
`references[]` occurrence does not require pre-existing local durability.

Missing local availability of an Asset mentioned only in `references[]` does
not make the labour Record invalid and does not by itself block current
Repository `COMMITTED`. A stronger referenced-Asset availability requirement
belongs to a concrete Protocol that explicitly defines it.

## Patch boundary

No current #9 contribution based on
`labour.record@0.1.0` + `asset.content@0.1.0` requires a Patch fact.

Patch remains a future extension for a Protocol that actually defines mutable
state evolution. The current vertical slice neither defines a generic Patch
schema nor waits for one.

## Execution and chain status

Repository execution and chain confirmation remain separate dimensions.

Repository execution is:

```text
STAGED
    -> request is being processed; no acceptance fact is durable

DOMAIN_CONFIRMED
    -> labour Record is valid under exact semantics
    -> Repo acceptance Record is valid under exact semantics
    -> their labour/Asset relation agrees
    -> selected result Asset is canonical-valid and durably retrievable
    -> Repository orchestration finds no conflicting accepted Repo/labour/Asset key

COMMITTED
    -> all prerequisite durable state exists
    -> valid Repo acceptance Record is durably accepted last
```

`DOMAIN_CONFIRMED` is not chain confirmation and is not itself Repository
acceptance.

Chain status is separate:

```text
pending-chain
    -> block-confirmed
```

A Repository-committed contribution remains pending-chain until future accepted
Block / chain-state evidence proves inclusion. Local persistence, Runtime
relationship state or candidate Block construction cannot upgrade it.

## Required durable fact set

For one accepted key:

```text
Repo R
labour Record L
selected Asset A
acceptance Record D
```

Repository `COMMITTED` requires:

1. exact labour Record `L` is durably accepted;
2. exact selected Asset `A` is durably retrievable;
3. `D` is a valid `repo.contribution@0.1.0` Record where:
   - `D.createdBy = R`;
   - `D.data.labourRecordId = L.id`;
   - `D.data.assetId = A.id`;
   - `A.id` occurs in `L.data.assets[]`;
4. Repository orchestration finds no distinct already accepted `D2` for the
   same `(R, L.id, A.id)` logical key;
5. `D` is durably accepted after the above prerequisites.

The Repo establishment fact and Member declaration facts remain their existing
independent durable facts. They are dependencies used to validate `R` and the
labour author; they are not duplicated inside the contribution.

No third canonical Contribution store is required.

## Deterministic COMMITTED predicate

For an exact durable acceptance Record `D`:

```text
RepositoryContributionState(D) == COMMITTED
iff

  D is durably present
  AND D validates as repo.contribution@0.1.0
  AND Repo D.createdBy is established

  AND durable Record L = get(D.data.labourRecordId) exists
  AND L validates as labour.record@0.1.0
  AND D.data.assetId is in L.data.assets

  AND Asset D.data.assetId is durably retrievable

  AND no distinct accepted repo.contribution Record
      exists for the same
      (D.createdBy, D.data.labourRecordId, D.data.assetId)
```

This predicate depends only on exact durable facts and deterministic Protocol
validation. It does not depend on process-local state, UI/session state,
candidate Block state or chain confirmation.

If an acceptance marker exists but required durable storage is unreadable or
corrupt, the implementation must fail closed with the underlying integrity /
storage error. It must not silently report either a healthy `COMMITTED` state
or pretend that no acceptance fact ever existed.

## Commit marker and write ordering

The Repo acceptance Record `D` is the final durable marker for Repository
commit.

Normal #9 ordering is:

```text
1. resolve/validate exact Protocols
2. validate labour Record L
3. validate Repo acceptance Record D and relation D -> L -> selected Asset A
4. durably preserve/get selected Asset A
5. durably accept labour Record L, idempotently
6. under the serialized Runtime Record database boundary:
     - re-check singular acceptance key
     - durably accept Repo acceptance Record D last
7. return COMMITTED
```

The request may contain a labour Record or selected Asset that is already
durable. Existing exact RecordId / AssetId duplicate semantics make those steps
idempotent.

The acceptance Record may be constructed and signed before this flow, but it
must not be durably accepted by Repository before the prerequisite Record and
Asset durability conditions are satisfied.

Repository does not construct or sign `D` unless a future explicit signer
capability is defined. For #9, the orchestration consumes a supplied Repo-signed
Record and validates it.

## Duplicate and conflict behavior

Existing identity semantics are reused:

- exact Asset replay is idempotent by AssetId;
- exact labour Record replay is idempotent by RecordId;
- exact Repo acceptance Record replay is idempotent by RecordId.

The logical acceptance key is:

```text
(
  Repo = acceptanceRecord.createdBy,
  labourRecordId,
  assetId
)
```

A distinct Repo acceptance Record for an already accepted logical key is a
conflict in v0.1.0 and must not replace the earlier acceptance fact.

No ContributionId is introduced merely for deduplication.

## Runtime Record database relation boundary

The durable signed facts already contain the concrete relationship:

```text
Repo acceptance Record
    -> labourRecordId
    -> labour.assets[] selected asset
    -> labour.references[] confirmed upstream references
```

#9 therefore does not require a generic relation database or graph structure.

The existing Runtime Record database serialized ingress boundary is sufficient
for the normal commit path. A future implementation may maintain a narrow,
rebuildable index equivalent to:

```text
(Repo, labourRecordId, assetId) -> acceptance RecordId
```

for conflict checking/query efficiency, but that index is not acceptance truth
and is not required to define `COMMITTED`. It must be rebuildable from durable
Records under exact Protocol semantics.

Dependency/order information needed by later Block work is already explicit:
the Repo acceptance fact depends on the labour Record it references. This does
not create a global DAG, `previous` chain or generic relation framework.

## Exact Protocol service boundary

Repository orchestration uses existing exact
`ProtocolResolutionService` to resolve the acceptance Record's exact
`repo.contribution@0.1.0` implementation.

The specialized service contract is defined in
[`repo-contribution.md`](./repo-contribution.md).

There is no cross-Protocol generic `validateContribution` API.

The Protocol service owns semantic validation. Repository orchestration owns:

- Asset availability and durable preservation;
- Record durable ingress ordering;
- same-key accepted-fact conflict checks;
- staging/correlation when #10 implements recovery;
- Repository result reporting.

The Protocol service never calls Repository Asset/Record persistence in order
to commit a contribution.

## Restart derivation

A fresh node can derive a committed contribution without process-local memory:

```text
durable acceptance Record D
    -> exact repo.contribution Protocol validation
    -> D.data.labourRecordId
    -> durable labour Record L
    -> exact labour Protocol validation
    -> D.data.assetId
    -> durable selected Asset retrieval
    -> L.references[] remains signed lineage; local absence alone is not a #9 blocker
    -> COMMITTED
```

The operator survives because it is part of `D.data`.

A replaceable index may accelerate lookup from
`(Repo, labourRecordId, assetId)` to `D.id`, but the index is not required
to recover the acceptance truth.

## Staging and recovery boundary

#9 defines the normal durable commit boundary. #10 owns recovery of interrupted
pre-commit flows.

A future staging provider may persist correlation needed by #10, but staging is
not part of the `COMMITTED` predicate and cannot create acceptance.

#9 does not define a staging schema, retry state machine, rollback protocol,
transaction coordinator or saga framework.

Partial durable state is allowed before the final acceptance marker:

- selected Asset may be durable while the labour Record is not;
- selected Asset and labour Record may be durable while the acceptance Record
  is not.

Those states are not `COMMITTED`. #10 may later reconcile them.

If the acceptance Record is already durable, the normal ordering says the
Repository commit marker has been reached even if the original caller did not
receive the response. Recovery/response reconciliation remains #10.

## Chain boundary

Repository `COMMITTED` means local durable domain acceptance.

It does not mean:

- Block packed;
- candidate Block produced;
- peer validated;
- chain accepted;
- canonical/block-confirmed.

Only future accepted-Block/chain-state evidence can support
`block-confirmed`.

#9 does not implement #11 contribution history merely to expose this
distinction.

## Failure model

The #9 implementation must expose failures at the layer that owns them,
including:

- exact ProtocolHash / verified implementation unavailable;
- invalid Member-signed labour Record;
- Repo unavailable/not established;
- invalid Repo acceptance Record or operator;
- acceptance/labour relation mismatch;
- selected Asset absent from `labour.assets[]`;
- selected Asset invalid, conflicting, missing, corrupt or not durably
  retrievable;
- durable Record ingress failure;
- distinct already accepted Repo/labour/Asset key conflict;
- commit result cannot be determined safely because durable state cannot be
  verified.

Missing local Asset availability must not be surfaced as
`labour.record@0.1.0` semantic invalidity.

## Future #9 implementation mapping

A nonbinding mapping onto the current Runtime is:

```text
Contribution orchestration
  -> validate labour Record through exact labour.record service
  -> derive contributor from labourRecord.createdBy
  -> resolve exact repo.contribution service
  -> validate acceptance Record + relation, including established Repo author
  -> derive Repo from acceptanceRecord.createdBy
  -> preserve/get submitted selected Asset
  -> accept labour Record through Runtime Record database
  -> under the same serialized ingress boundary:
       check singular acceptance key
       accept Repo acceptance Record last
  -> return COMMITTED
```

Repo signing is outside this service: the request supplies the signed acceptance
Record.

No #10 recovery loop, #11 projection, Block packer or chain adapter is needed
for this normal path.

## Future implementation tests

The future implementation must cover:

### Canonical fixture

One fixture should contain:

- one Member EntityPublicKey;
- one established Repo EntityPublicKey;
- one operator EntityPublicKey;
- one upstream referenced Asset `A0` (it may be absent from this Repo);
- one Member-signed labour Record `L` with:
  - `references = [A0.id]`;
  - `assets = [A1.id]`;
- one submitted result Asset `A1`;
- one Repo-signed `repo.contribution@0.1.0` Record `D` with:
  - `labourRecordId = L.id`;
  - `assetId = A1.id`;
  - `operator`.

The final commit marker is `D.id`.

`A0`, `A1`, `L` and `D` above are role names, not fake literal hashes.
This design-only PR does not build the new `repo.contribution@0.1.0` artifact,
so it must not invent a ProtocolHash or acceptance RecordId that would appear
authoritative. The future implementation fixture must use the real verified
artifact ProtocolHash and Core-derived literal RecordIds / AssetIds produced
from the frozen fixture inputs. Those derived values then become regression
vectors.

### Relation tests

- valid `D -> L -> A1`;
- wrong labour RecordId;
- selected Asset not in `L.assets[]`;
- one input Asset referenced by multiple accepted labour Records;
- one labour Record with multiple outputs where separate acceptance facts select
  separate Assets;
- unchanged maintenance where the same Asset is in references and assets;
- no `previous`, `pid` or reverse edge.

### COMMITTED table

At minimum:

| Labour durable | Selected Asset durable | Valid acceptance durable | Result |
| --- | --- | --- | --- |
| yes | no | no | not committed |
| yes | yes | no | not committed |
| no | yes | no | not committed |
| yes | yes | invalid | not committed / explicit error |
| yes | yes | yes | COMMITTED |

In addition:

- a valid unrelated `L.references[]` Asset missing locally may still commit;
- invalid `D -> L -> selected Asset` relation is a semantic failure;
- exact `D` replay is committed/idempotent;
- a distinct `D2` with the same logical key is an orchestration conflict.

A storage corruption/unavailability error after an acceptance marker exists is
an explicit integrity/storage failure, not a healthy alternative state.

### Failure seams

Expected normal-path result after:

- failure before selected Asset durability: not committed;
- failure after selected Asset durability but before labour Record durability:
  not committed;
- failure after labour Record durability but before acceptance Record:
  not committed;
- failure while persisting acceptance Record: never report committed unless
  the durable acceptance Record can be verified;
- failure after acceptance Record durability but before response: durable facts
  satisfy the commit predicate; response/recovery reconciliation belongs to
  #10.

No rollback is required by #9.

### Restart

A fresh Runtime over the same durable Record journal and Asset provider must be
able to re-derive `COMMITTED`, including the Repo identity, contributor,
accepted Asset, labour relation and operator, without an in-memory Contribution
registry.

### Chain separation

A Repository-committed contribution remains pending-chain in #9. No synthetic
Block evidence or #11 history implementation is required.
