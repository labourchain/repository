# Asset Specification

- **Status:** Accepted
- **Protocol:** `asset.content@0.1.0`
- **Scope:** minimum immutable Asset identity, integrity and labour-reference semantics
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Asset is LabourChain's objectified labour-result domain object. The minimum MVP
Asset must be identifiable and integrity-checkable independently of any one
Repository storage provider, while remaining small enough to support code,
documents, data, models, build outputs and digital representations of physical
results as exact bytes.

Asset is not a Core Record and does not duplicate Record authorship, time,
signature or relationship fields. Labour provenance is expressed by signed
labour Records that reference Assets.

The minimum Protocol is `asset.content@0.1.0`. It establishes exact
content identity/integrity only. Persisting arbitrary bytes does not by itself
make them an accepted Repo Asset; that product meaning comes from applicable
labour/contribution facts and Repository acceptance.

## Minimum Asset shape

The canonical Runtime view is equivalent to:

```ts
type AssetId = string
type ContentHash = string

interface Asset {
  id: AssetId
  protocol: string
  protocolHash: string
  contentHash: ContentHash
  content: Uint8Array
}
```

For the MVP:

```text
protocol = asset.content@0.1.0
```

`protocolHash` is the exact LabourChain ProtocolHash for that Protocol build.
Repository must resolve and verify that exact Protocol before accepting semantic
validation; no `latest`, compatible-version or same-version-different-artifact
fallback is allowed.

`content` is the exact byte sequence that the Asset represents. The Protocol
does not add filename, MIME type, title, owner, Repo, author, timestamps,
version, `previous`, `pid` or generic relation fields.

If such information later becomes semantically required, it belongs to a later
Asset Protocol or another signed fact rather than storage-provider metadata
silently entering the Asset identity.

## Resource boundary

`asset.content@0.1.0` accepts at most **16 MiB** (`16 * 1024 * 1024` bytes)
of raw `content` bytes. The limit applies to the exact unencoded byte sequence
before hashing or durable persistence; it does not measure JSON/base64,
filesystem, database-row or provider-specific representation size.

Content larger than this limit is outside this Protocol version and must fail
deterministically as an Asset-content resource-limit error before hashing,
durable lookup or persistence. A provider used for `asset.content@0.1.0` must
support every valid Asset up to this limit; it must not impose a smaller hidden
Asset-size policy. Ordinary I/O/capacity failures remain persistence failures.

The MVP may therefore use a complete `Uint8Array` as its canonical Runtime
representation without promising arbitrary-size in-memory processing. Future
larger or streamed Asset support may evolve the Protocol/provider boundary;
it does not change the identity formula defined below and is not part of #8.

## Identity

Asset identity is derived, never provider-assigned.

```text
contentHash
= DoubleSHA256(content)

AssetIdentity
= {
    protocol,
    protocolHash,
    contentHash
  }

AssetId
= DoubleSHA256(
    RFC8785-JCS(AssetIdentity)
  )
```

Both hashes are lowercase 64-character hexadecimal strings.

This deliberately follows the deterministic JCS + DoubleSHA256 convention
already used by Core Record identity while keeping the identity spaces
separate:

```text
RecordId != AssetId
EntityPublicKey != AssetId
ProtocolHash != AssetId
```

Core `ProtocolHash` and exact Protocol verification are reused directly.
Asset identity does not require a new Core entity type or a change to
`core.record`.

The `contentHash` field exists because the bytes are not JSON data and should
not be base64-expanded merely to participate in JCS. `AssetId` then binds
those exact bytes to their exact Protocol semantics.

### Identity consequences

- same exact `protocol + protocolHash + content` -> same AssetId;
- different content -> different AssetId;
- different exact ProtocolHash -> different AssetId;
- changing any identity-bearing field produces a new Asset, never an in-place
  mutation;
- identical bytes may intentionally be the same Asset even when multiple
  labour Records independently produce or reference them;
- if a domain needs two physically distinct objects with otherwise identical
  bytes, the applicable future Asset Protocol must encode the distinguishing
  fact in the content it defines.

An AssetId is also the minimum Asset reference carried by the current
`labour.record@0.1.0` `references[]` and `assets[]` fields. No additional
URI prefix, registry key or provider identifier is required for the MVP.

## Record relationship

The accepted lineage model is formed from real labour usage:

```text
labour Record R1
  assets = [A]
        ↓
      Asset A
        ↓
labour Record R2
  references = [A]
  assets = [B]
        ↓
      Asset B
```

Branching requires no extra graph metadata:

```text
A <- R2 -> B
A <- R3 -> C
```

A maintenance act that leaves the exact content unchanged may reference and
declare the same Asset:

```text
R4.references = [A]
R4.assets = [A]
```

The labour fact still records the work even though no artificial Asset version
is created.

Therefore the Asset itself does not carry reverse Record links,
`previous`, `pid`, parent pointers or generic relation arrays. The
Record/Asset production graph is reconstructed from signed
`labour.record.references[]` and `labour.record.assets[]` facts.

Missing Asset references continue to be legal while a labour Record is being
created. `labour.record@0.1.0` records a confirmed upstream production/citation
reference; it does not require local Asset resolution. The current #9
contribution contract requires the selected accepted result Asset to be durably
retrievable before the Repo acceptance Record becomes the commit marker. Local
absence of another Asset mentioned only in `labour.references[]` does not by
itself block current `repo.contribution@0.1.0` acceptance. A future concrete
Protocol may define a stronger referenced-Asset availability rule explicitly;
that rule is not inferred from Asset identity or from `references[]` alone.

## Validation, immutability and conflict

An accepted Asset value is immutable. Incoming validation has one deterministic
order before durable state is consulted:

1. reject raw `content.byteLength > 16 MiB` as an Asset-content resource-limit
   error;
2. recompute `contentHash` from the exact bytes and reject a mismatching claimed
   `contentHash` as `InvalidAsset`;
3. recompute `AssetId` from the supplied `protocol`, `protocolHash` and the
   recomputed `contentHash`, and reject a mismatching claimed `id` as
   `InvalidAsset`;
4. resolve the exact `protocolHash` and require the human-readable `protocol`
   reference to match that descriptor; a mismatch is a
   `ProtocolReferenceMismatchError`.

Only an incoming Asset that passes all four steps is canonical-valid and may be
compared with durable state by AssetId. If no durable value exists, it may be
preserved. If the durable descriptor and bytes are exact-equal, preservation is
idempotent success. Only if a canonical-valid incoming Asset resolves to an
already-present AssetId whose durable descriptor or bytes differ is the result
`AssetIdentityConflict`; the existing value must never be overwritten.

A caller therefore cannot manufacture an identity conflict merely by pairing a
valid AssetId with unrelated bytes: that incoming object is `InvalidAsset`
before durable lookup. Under normal cryptographic operation a canonical-valid
identity conflict should be unreachable except for a hash collision, durable
provider corruption/state anomaly, or implementation/storage defect, but the
boundary remains deterministic and fails closed.

## Protocol boundary

`asset.content@0.1.0` owns:

- Asset reference format;
- content-hash derivation;
- AssetId derivation;
- validation of the minimum Asset shape and identity/integrity consistency.

Repository Runtime owns:

- resolving the exact ProtocolHash implementation;
- orchestrating validation in the normal producer path;
- durable byte preservation and retrieval;
- surfacing explicit storage/retrieval failures.

Core continues to own its existing Protocol, Entity, Record and Block
primitives. Asset storage policy does not move into Core.

A future Block/peer validator may independently validate Asset references under
the exact Protocol semantics available to that future chain contract. This
Spec does not define Asset packing into Block, peer synchronization or
consensus.

## Boundaries

This Protocol does not define:

- Asset ownership, access or property rights;
- Repo acceptance or Contribution state;
- Project/Board organization;
- mutable Asset versions;
- Patch;
- filename/MIME/title/tag metadata;
- search/index behavior;
- distributed storage or replication;
- IPFS or content-addressed storage infrastructure;
- Block packing, peer validation, synchronization or consensus.

Content-derived identity does not require a content-addressed storage provider.
A provider remains free to use filesystem paths, rows or object keys internally
as long as those identifiers never replace AssetId.

## Future acceptance tests

Implementation must demonstrate:

- deterministic `contentHash` and AssetId test vectors;
- same exact input yields the same AssetId;
- content or exact ProtocolHash changes yield a different AssetId;
- size exactly 16 MiB is accepted, while size above 16 MiB fails with the
  resource-limit result before hashing, durable lookup or visibility;
- invalid supplied `contentHash` or `id` is `InvalidAsset`;
- a human-readable `protocol` / exact descriptor mismatch is
  `ProtocolReferenceMismatchError` before durable lookup;
- exact duplicate validation is idempotent;
- arbitrary same-id/different-bytes input is `InvalidAsset`, not an identity
  conflict;
- a canonical-valid durable identity conflict/state anomaly fails closed and
  cannot silently replace accepted bytes;
- AssetId remains unchanged across serialization/restart;
- `labour.record` may use AssetId directly in `references[]` and
  `assets[]`;
- one Asset may be referenced by multiple later labour Records;
- lineage is reconstructable without `pid`, `previous` or a generic relation
  registry;
- missing local Asset resolution does not retroactively invalidate an otherwise
  valid `labour.record@0.1.0`.

Likely implementation tests: `test/asset-content.test.ts` for Protocol
identity/integrity and the existing labour-record tests for reference
compatibility.
