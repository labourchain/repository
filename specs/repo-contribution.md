# Repo Contribution Protocol Specification

- **Status:** Draft
- **Protocol:** `repo.contribution@0.1.0`
- **Scope:** positive Repo acceptance of one Member-produced labour Record / result Asset pair
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)
- **Contribution orchestration:** [`contribution.md`](./contribution.md)
- **Labour dependency:** [`labour-record.md`](./labour-record.md)
- **Repo dependency:** [`repo.md`](./repo.md)

## Purpose

`repo.contribution@0.1.0` defines the minimum signed Repo-side fact required
by the current Repository MVP contribution path.

It records one positive assertion:

> Repo R accepted Asset A as a contribution associated with Member-produced
> labour Record L, and operator O performed that Repo action.

The Protocol does not create a separate Contribution entity, generic decision
framework, generic relation Protocol, rejection state, membership state,
ownership relation or Patch model.

The logical contribution is identified by the signed facts that already exist:

```text
Member-signed labour Record L
    -> labour references[] / assets[]

Repo-signed repo.contribution Record D
    -> selects one L
    -> selects one Asset A from L.assets[]
    -> records operator O
```

No standalone `ContributionId` is required. The acceptance RecordId is the
durable final marker for one accepted Repo/labour/Asset relation.

## Existing Member confirmation

The current MVP does not require a second Member-confirmation fact.

A valid `labour.record@0.1.0` already proves the Member-side assertion needed
for this contribution path because:

- the labour Record is authored and signed by its `Record.createdBy` identity;
- `labour.record@0.1.0` requires that author to satisfy the Member capability;
- the signed `references[]` and `assets[]` fields are the Member-confirmed
  Asset relationships for that labour fact.

Repository therefore must not synthesize or require a generic
Member-confirmation Record in this vertical slice.

## Existing Asset relations

The contribution Protocol reuses the production relations already carried by
the labour Record:

```text
labour.references[]
    -> confirmed input/upstream AssetIds

labour.assets[]
    -> directly associated result AssetIds
```

Those fields are sufficient for the current production lineage:

```text
input Asset(s)
    -> labour Record
    -> result Asset(s)
```

One input Asset may be referenced by multiple later labour Records. One labour
Record may declare multiple result Assets. No `previous`, `pid`, reverse edge
or generic graph relation is required.

The Repo acceptance fact carries one `assetId` because Repo acceptance is an
independent assertion about which result Asset it accepted. This is not a copy
of lineage: when one labour Record contains multiple result Assets, a Repo may
accept one result without asserting that it accepted every other result.

## Protocol identity

The stable human-readable Protocol reference is:

```text
repo.contribution@0.1.0
```

The exact verified `ProtocolHash` remains the machine authority. The Host
supplies that exact hash when mounting the verified implementation. Historical
facts must resolve the exact referenced hash and must not fall back to another
artifact or version.

## Record contract

A positive Repo acceptance is one Core Record with exactly this Protocol data:

```ts
interface RepoContributionData {
  readonly labourRecordId: string
  readonly assetId: string
  readonly operator: string
}
```

The semantic types are:

```text
labourRecordId
    = RecordId of the Member-produced labour.record fact

assetId
    = AssetId of the specific result Asset accepted by the Repo

operator
    = Core EntityPublicKey of the human/entity actor who performed
      this concrete Repo action
```

The enclosing Record is:

```text
Record.protocol
= repo.contribution@0.1.0

Record.protocolHash
= exact verified repo.contribution ProtocolHash

Record.createdBy
= Repo EntityPublicKey

Record.signature
= signature by that Repo identity

Record.data
= {
    labourRecordId,
    assetId,
    operator
  }
```

`Record.data` contains exactly those three fields. Unknown or redundant fields
are invalid for v0.1.0.

In particular it does not contain:

- `repo` / `repoId`, because the Repo identity is already
  `Record.createdBy`;
- contributor/Member identity, because it is already the validated labour
  Record author;
- input Asset lists, because they are already `labour.references[]`;
- all result Asset lists, because they are already `labour.assets[]`;
- status/decision enum, because this Protocol records only positive acceptance;
- ownership, proprietor, membership, role or ACL fields;
- `previous`, `pid`, Patch or generic relation fields.

## Author and signature semantics

A valid acceptance Record must satisfy all of the following:

1. it is a valid Core Record;
2. its human-readable Protocol reference and exact `ProtocolHash` match the
   mounted `repo.contribution@0.1.0` implementation;
3. `Record.createdBy` is a valid Core EntityPublicKey for an established Repo;
4. its Core Record signature verifies against `Record.createdBy`;
5. `Record.data` satisfies the exact v0.1.0 shape.

The Repo identity is therefore not duplicated inside `Record.data`.

Repo secret-key custody, interactive signing and authorization policy remain
Runtime/signer concerns. The Protocol validates a supplied signed fact; it does
not own a Repo private key or invent a signing subsystem.

## Operator semantics

`operator` is required and must be a valid Core `EntityPublicKey`.

It means only:

> this Entity performed the concrete Repo action represented by this signed
> acceptance Record.

For v0.1.0:

- `operator` may equal the Repo Entity identity;
- `operator` is not required to satisfy the Member capability merely to make
  the Record structurally valid;
- `operator` does not prove organization membership, delegation, role,
  authorization or governance authority;
- authorization of who may cause a Repo key to sign is outside this Protocol;
- the value survives restart because it is part of the signed Record data.

The Repo signature proves that the Repo identity signed this fact. The
`operator` field preserves action attribution that cannot be reconstructed
from the Repo public key alone.

## Labour / Asset relation validation

The acceptance Record is valid for a concrete contribution only when it is
validated together with the referenced labour Record.

The exact relation is:

```text
D.data.labourRecordId == L.id

D.data.assetId ∈ L.data.assets
```

where:

- `D` is the `repo.contribution@0.1.0` Record;
- `L` is a valid `labour.record@0.1.0` Record under its exact
  `ProtocolHash`.

The labour Record's own validation supplies the Member-side confirmation. No
second Member-confirmation fact is required.

A labour Record with no `assets[]`, or one whose `assets[]` does not contain
the selected `assetId`, cannot be the basis of this Repo acceptance fact.

The Protocol does not require Asset bytes or durable storage during pure
Record/relation validation. Durable Asset availability is a Repository
orchestration precondition described in `contribution.md`.

## Input Asset policy

For the current #9 vertical slice, every AssetId in
`labour.references[]` is a required input dependency of the accepted
contribution and must already be durably retrievable by the Repository before
the acceptance Record may become the durable commit marker.

The selected `data.assetId` must be durably retrievable and must match the
exact submitted/preserved Asset.

Other result AssetIds in `labour.assets[]` are not implicitly accepted by this
Record and therefore are not required to be durable for this specific
contribution. They may be accepted separately by their own Repo acceptance
Records.

If the same AssetId appears in both `references[]` and `assets[]`, as in an
unchanged maintenance result, one durable Asset satisfies both roles.

Missing local Asset availability does not retroactively invalidate the
`labour.record@0.1.0` fact. It prevents this Repository contribution from
reaching its acceptance boundary.

## Positive-fact semantics

`repo.contribution@0.1.0` persists only positive acceptance.

The absence of a valid acceptance Record means only that no durable positive
Repo acceptance fact is available. It must not be interpreted as a durable
rejection.

The MVP does not define reject/revoke/reopen decision variants. A future
Protocol may add such facts if a real requirement needs them.

## Singularity and duplicate semantics

One logical acceptance key is:

```text
(
  Repo = Record.createdBy,
  labourRecordId = Record.data.labourRecordId,
  assetId = Record.data.assetId
)
```

For v0.1.0 there may be at most one accepted
`repo.contribution@0.1.0` Record for one such key in the normal Repository
accepted state.

- replay of the exact same RecordId is idempotent;
- a distinct acceptance RecordId for an already accepted logical key is a
  conflict and must not silently replace the existing acceptance fact;
- exact duplicate Asset preservation continues to use AssetId idempotency;
- exact duplicate labour Record acceptance continues to use existing RecordId
  idempotency.

This singularity keeps the positive acceptance action and its operator trace
unambiguous without inventing a ContributionId.

A Runtime implementation may use a rebuildable key-to-RecordId index for
efficiency, but the exact durable Records remain the source from which that
index is reconstructed.

## Patch boundary

No current `labour.record@0.1.0` + `asset.content@0.1.0` contribution in
#9 requires a Patch fact.

Patch remains a future extension hook for a Protocol that actually defines
mutable domain-state evolution. #9 must not invent or wait for a generic Patch
schema.

## Cordis service contract

The concrete Protocol service name is:

```text
protocol:repo.contribution@0.1.0
```

The implementation should expose behavior equivalent to:

```ts
interface RepoContributionProtocolService {
  readonly protocolHash: string

  validateAcceptance(
    value: unknown,
  ): Promise<ValidatedRepoContributionRecord>

  validateRelation(
    acceptance: unknown,
    labourRecord: unknown,
  ): Promise<RepoContributionView>
}
```

A returned view is behaviorally equivalent to:

```ts
interface RepoContributionView {
  readonly recordId: string
  readonly repoIdentity: string
  readonly labourRecordId: string
  readonly assetId: string
  readonly operator: string
  readonly contributor: string
}
```

The specialized service validates Protocol semantics only:

- Core Record shape/signature;
- exact Protocol reference/hash;
- established Repo author;
- exact data shape;
- operator EntityPublicKey;
- referenced labour Record identity and exact labour semantics;
- selected Asset membership in `labour.assets[]`.

It does not:

- preserve or read Asset bytes;
- persist Records;
- own Runtime staging;
- maintain contribution history;
- pack Blocks;
- determine chain confirmation;
- sign with the Repo private key.

Repository orchestration resolves this concrete service through the existing
exact `ProtocolResolutionService` and owns durable ordering around it.

No generic `validateContribution` interface is introduced across unrelated
Protocols.

## Failure semantics

Protocol validation must distinguish the concrete semantic causes needed by a
caller, including:

- invalid Core Record or signature;
- wrong human-readable Protocol reference;
- wrong exact ProtocolHash;
- Repo author not established / unavailable;
- malformed data or unknown fields;
- invalid operator EntityPublicKey;
- referenced labour Record invalid;
- `labourRecordId` mismatch;
- selected `assetId` absent from `labour.assets[]`;
- conflicting already accepted logical key when checking Repository relation
  state.

Asset not-found/corruption/persistence errors remain Asset-storage /
Contribution-orchestration failures rather than labour Record validity errors.

## Future implementation tests

The Protocol implementation must cover at least:

- valid acceptance Record and relation;
- exact Protocol reference/hash mismatch;
- invalid Repo author or Repo signature;
- missing/wrong/invalid operator;
- unknown/redundant data fields;
- wrong `labourRecordId`;
- invalid referenced labour Record;
- selected `assetId` not present in `labour.assets[]`;
- one input Asset referenced by multiple later labour Records;
- one labour Record containing multiple result Assets with separate Repo
  acceptance facts for selected results;
- exact acceptance replay idempotency;
- distinct acceptance Record conflict for one logical key;
- no `previous`, `pid`, generic relation, generic confirmation or
  ContributionId requirement.

Storage ordering, restart and Repository `COMMITTED` tests belong to
`contribution.md` and the future #9 orchestration implementation.
