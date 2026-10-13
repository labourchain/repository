# Repo Contribution Protocol Specification

- **Status:** Accepted
- **Protocol:** `repo.contribution@0.1.0`
- **Scope:** positive Repo acceptance of one Member-produced labour Record / result Asset pair
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)
- **Contribution orchestration:** [`contribution.md`](./contribution.md)
- **Labour dependency:** [`labour-record.md`](./labour-record.md)
- **Repo dependency:** [`repo.md`](./repo.md)

> **Architecture correction (2026-10):** Signed Protocol fields remain as defined here. The previous persistence implementation and unreviewed Asset-byte provider is legacy; MongoDB-default Runtime DB migration is pending, and Asset identity/storage is **deferred — rework required**. No independent contribution Recovery/staging feature remains in scope.

## Scope of the published v0.1.0 contract

This **Accepted** specification preserves the existing signed `repo.contribution@0.1.0` shape, including **required `assetId`**. It describes the narrower historical positive decision to accept a *selected Asset A linked to labour Record L*. It does **not** mean every valid L must declare an A, nor that merely persisting L is a Repo decision.

The agreed product flow also needs **positive Repo acceptance of labour L without A**, ordinarily after a later daily/weekly collective meeting. A prospective Protocol version may represent this with optional `assetId`, but that is a **future versioned design requirement**, not the validation or ProtocolHash contract of v0.1.0. Its precise version, possible change to same-key uniqueness and historical compatibility must be separately reviewed before implementation. Previously signed v0.1.0 D remains valid under v0.1.0 only.

Repo signature and the `operator` field identify a positive decision and its reported operator; they do not prove meeting attendance, voting, quorum or organizational authorization. A meeting may consider several labour records; absence of D is neither a negative vote nor proof of rejection.

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

## Protocol dependencies

`repo.contribution@0.1.0` has these semantic Protocol dependencies:

```text
core.entity@0.1.0
core.record@0.1.0
repo.establishment@0.1.0
labour.record@0.1.0
```

The built Protocol descriptor binds the exact `ProtocolHash` of each dependency
according to the existing Core/Repository exact-resolution contract. The
implementation must not substitute another artifact merely because the
human-readable reference/version looks compatible.

The deferred legacy `asset.content@0.1.0` is not a Protocol dependency of the pure
Repo acceptance validator. The acceptance fact carries an `assetId` selected from the validated labour Record's `assets[]`. The generic Asset identity/availability and management contract is **deferred for rework**; the old filesystem Asset provider is not an accepted new-architecture prerequisite.

The concrete Protocol service does not inject `assetStorage`,
the concrete Runtime DB provider, history or chain-state services. Those are
Repository runtime concerns rather than acceptance-fact semantics.

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
    = opaque reference of the selected result (concrete AssetId design deferred)

operator
    = Core EntityPublicKey of the human/entity actor who performed
      this concrete Repo action
```

At the standalone data-shape boundary, `labourRecordId` and `assetId` must be
non-empty strings. Their actual identity semantics are not reimplemented here:
`labourRecordId` is confirmed by exact equality with the supplied validated
labour Record's `id`, while `assetId` is confirmed by equality with the selected opaque result reference and by membership in `labour.assets[]`. Concrete Asset identity is deferred. This avoids duplicating Core RecordId or future Asset identity algorithms in the Repo acceptance Protocol.

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

The Protocol validates only the signed reference relationship. Any future concrete Asset availability condition belongs to the separately reviewed Asset management design, not this protocol.

## Upstream reference and selected Asset policy

The signed labour `references[]` / `assets[]` fields preserve the Member's declared relationships. The Repo acceptance Record's `assetId` selects exactly one reference from `labour.assets[]`; no other result is automatically accepted.

**Asset implementation is deferred / rework required.** This Protocol section does not require a byte-content provider, specific AssetId derivation, preservation/readback, an input Asset to be locally available, or a selected Asset to be stored under the old filesystem contract. Those concrete product/storage conditions must be decided in the independent Asset design.

The presence of the same opaque reference in both lists is not a reason to introduce `previous`, `pid` or generic relations.

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
- any Asset-specific idempotency/identity guarantee is deferred until the Asset contract is re-accepted;
- exact duplicate labour Record acceptance continues to use existing RecordId
  idempotency.

This singularity keeps the positive acceptance action and its operator trace
unambiguous without inventing a ContributionId. It is enforced by the owning **single Repository Node** through its serialized domain acceptance path and persisted DB facts;
the stateless Protocol service does not perform that lookup.

A Runtime implementation may use a rebuildable key-to-RecordId index for
efficiency, but the exact durable Records remain the source from which that
index is reconstructed.

## Patch boundary

The current signed labour/Repo-acceptance fact model does **not** require a Patch fact. The legacy `asset.content@0.1.0` integration is separately deferred for rework.

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
- define or own an application-level Recovery/staging state machine;
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
- selected `assetId` absent from `labour.assets[]`.

Any Asset-related not-found, integrity or provider error (after the Asset design is reviewed) remains a Repository/Asset-provider concern, not labour Record semantic invalidity.

## Implementation acceptance tests

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
- no `previous`, `pid`, generic relation, generic confirmation or
  ContributionId requirement.

The Protocol service tests must not require Runtime Record database state,
existing logical-key lookup or an acceptance index. Exact acceptance replay
idempotency, distinct same-key conflict, one-Node same-key conflict checking and
restart loading from persisted Records are Repository orchestration tests owned by
`contribution.md` and the current #9 implementation.

Storage ordering and Repository `COMMITTED` tests likewise belong to
`contribution.md`.
