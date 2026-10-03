# labour.record Specification

- **Status:** Accepted
- **Protocol:** `labour.record@0.1.0`
- **Scope:** minimum human labour fact
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

`labour.record` is the minimum independently composable Protocol for recording one
piece of labour performed by a Member.

Core Record remains the signed fact envelope. `labour.record` defines only the
flat domain payload carried in `Record.data`.

## Record shape

A valid labour Record uses:

```text
Record.protocol
= labour.record@0.1.0

Record.createdBy
= Member EntityPublicKey

Record.data
= {
    content,
    duration,
    startAt?,
    endAt?,
    references?,
    assets?
  }
```

Core owns RecordId, protocol reference/hash, author identity, creation timestamp
and signature. They are not duplicated in `Record.data`.

The payload is deliberately flat:

```ts
interface LabourRecordData {
  content: string
  duration: number
  startAt?: string
  endAt?: string
  references?: string[]
  assets?: string[]
}
```

## Fields

### content

`content` is the Member's direct description of the labour that occurred. It must
be a non-empty string. The Protocol does not split it into title, summary,
category, result or analysis fields.

### duration

`duration` is a subjective labour-effort annotation in hours.

- it must be finite and non-negative;
- `0` is valid for incidental work that did not consume material attention or
  effort;
- the v0.1.0 recording granularity is 0.5 hour.

The value may be entered manually or derived from contextual time events such as
Git activity, chat context or a timer. It is not required to equal
`endAt - startAt`.

### startAt / endAt

`startAt` and `endAt` are optional observational time-log fields.

They are either both absent or both present. When present they must use the
RFC 3339 UTC form ending in `Z` (for example `2026-09-29T13:30:00Z` or
`2026-09-29T13:30:00.123456Z`). Fractional seconds may use any positive number of digits. Local-time strings and numeric UTC offsets are not
accepted. The timestamps must be valid calendar times and `startAt <= endAt`.

These fields do not claim perfect measurement and do not define `duration`.

### references

`references` is an optional list of confirmed upstream Asset references: existing
labour results that this labour explicitly builds on or cites.

The Protocol treats each reference as an opaque non-empty string. The current
`asset.content@0.1.0` Asset Protocol uses its deterministic AssetId as that
reference value, but `labour.record@0.1.0` deliberately does not validate the
AssetId shape, existence or content integrity itself. Missing references never
prevent a labour Record from being created.

LLM/context inferred references remain Runtime suggestions until a human or
authorized product flow confirms them into the signed Record or a later Patch.

### assets

`assets` is an optional list of Asset references directly declared with this
labour as its results.

The Protocol deliberately does not introduce `outcome`, `producedAssets`,
`modifiedAssets` or a generic relation vocabulary. A reference may appear in
both `references` and `assets` when a labour act works on an existing Asset.

As with `references`, this Protocol validates only the reference representation.
For the current MVP the value supplied by `asset.content@0.1.0` is AssetId;
Asset existence and integrity remain outside labour Record validation.

## Member and signature boundary

The labour Record author must already satisfy `member.identity`.

The Record must pass Core Record validation and signature verification, reference
the mounted exact `labour.record@0.1.0` ProtocolHash, and then pass the
labour-data validation above.

## Runtime contract

The minimum runtime capability is equivalent to:

```text
validateLabourRecord(record)
acceptLabourRecord(record)
loadLabourRecord(recordId)
```

`acceptLabourRecord` enters the existing Runtime Record database serialized ingress
boundary. That Runtime boundary delegates exact durability to the Record journal.
This is pending-chain Runtime acceptance, not Block confirmation.

`loadLabourRecord` reads the exact durable Record through the Runtime Record
database boundary and validates it again. No secondary labour index, relationship
state or projection is required for v0.1.0.

## Analysis boundary

The following are intentionally not labour Record fields:

- tags / categories;
- Project identity;
- pid;
- assignee;
- status / priority;
- daily or weekly summary;
- project-progress counts;
- LLM analysis;
- generic relations.

These are analysis, organization or later-domain concerns. They may be derived
from labour facts, Assets, context and future Protocol facts without rewriting
the base labour Record.

## Boundaries

This Protocol does not define:

- Asset schema, storage or canonical Asset identity rules beyond carrying opaque references;
- contribution acceptance;
- Project or Board;
- generic relation Protocols;
- Patch shape;
- tags or LLM inference persistence;
- labour valuation, settlement or ownership;
- Block packing, synchronization or consensus.

## Acceptance tests

Tests must demonstrate that:

- a valid Member-signed `labour.record@0.1.0` Record is accepted durably;
- the same exact Record is reloadable after restart;
- non-Member authors fail;
- wrong protocol reference/hash or invalid signature fails;
- extra payload fields fail;
- `content` must be non-empty;
- `duration` accepts 0 and 0.5-hour multiples, but rejects negative,
  non-finite and finer-grained values;
- `startAt/endAt` are optional as a pair, use RFC 3339 UTC `Z` timestamps, and do not constrain duration;
- timezone-less, non-UTC-offset, invalid-calendar, or reversed time ranges fail; arbitrary RFC 3339 fractional-second precision remains valid and is ordered without millisecond truncation;
- `references/assets` are optional lists of unique non-empty opaque strings;
- the same Asset reference may occur once in each list;
- missing Asset references do not require Asset resolution during labour Record
  validation.
