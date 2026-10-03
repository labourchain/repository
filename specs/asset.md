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
created. `labour.record@0.1.0` records a confirmed reference string; it does
not require local Asset resolution. Whether a later contribution requires a
referenced Asset to be locally available is a Contribution/applicable-Protocol
decision, not an Asset identity rule.

## Immutability and conflict

An accepted Asset value is immutable.

When an Asset with a claimed `id` is checked:

1. recompute `contentHash` from the exact bytes;
2. recompute `AssetId` from `protocol`, `protocolHash` and the recomputed
   `contentHash`;
3. require both supplied derived values to match.

An exact duplicate is the same logical Asset and may be handled idempotently.

If an existing AssetId is associated with a different descriptor or different
bytes, the implementation must fail closed. It must never replace the existing
Asset under that identity.

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
- invalid supplied `contentHash` or `id` fails closed;
- exact duplicate validation is idempotent;
- an AssetId conflict cannot silently replace accepted bytes;
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
