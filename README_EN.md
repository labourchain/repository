# @labourchain/repository

[中文](./README.md)

LabourChain Repository composes signed labour and Repo acceptance facts through Cordis plugins. Core owns Entity/Record/Protocol identity and signature primitives. `labour.record@0.1.0` expresses a Member's labour and `repo.contribution@0.1.0` expresses a Repo's positive acceptance of a selected result.

> **October 2026 design correction (documentation first):** The standalone #10 Contribution Recovery feature is **withdrawn, code removal pending**. The target Runtime Record DB uses **MongoDB by default behind a narrow, replaceable interface**. #8 Asset and Asset Storage are **deferred / rework required**. Existing code is not proof that its product contract was accepted. #11 History and #39 MVP integration await the revised boundaries. This branch changes documentation only.

## Source-of-truth hierarchy

```text
docs/concepts/ → docs/requirements.md
             → docs/architecture.md
             → specs/ → Issues/Stories → implementation
```

- [Requirements](./docs/requirements.md) and [Architecture](./docs/architecture.md).
- [MVP Spec](./specs/repository-mvp.md), the capability/dependency status.
- [Runtime Record Database Spec](./specs/runtime-record-database.md), MongoDB-default and adapter-based (Draft).
- [Asset Spec](./specs/asset.md) / [Asset Storage Spec](./specs/asset-storage.md), **deferred / rework required**.
- [Contribution Spec](./specs/contribution.md), retaining signed fact fields, removing Recovery as a required feature.
- [Contribution History Spec](./specs/contribution-history.md), Draft.

## Confirmed facts

Member and Repo reuse Core Entity identity. Repo establishment records provenance, not property ownership.

`labour.record@0.1.0` retains minimal `content`, subjective `duration`, optional UTC time logs and confirmed `references[] / assets[]` relations; no `pid`, `previous` or generic relationship engine.

A Repo-signed acceptance Record has:

```text
protocol: repo.contribution@0.1.0
createdBy: Repo EntityPublicKey
data: { labourRecordId, assetId, operator }
```

A valid durable acceptance D is a Repository-local acceptance marker; independent accepted-Block evidence is necessary for `block-confirmed`. Durable DB data does not imply chain consensus.

## Target persistence

```text
Cordis + exact verified Protocol implementations
  -> domain services
  -> narrow persistent Record DB interface
  -> MongoDB default implementation (other DB adapters possible)
  -> durable signed Records and concrete DB-side uniqueness
```

**Exactly one Node maintains each Repo.** This follows [Board's](https://github.com/Ri0n72Y/board) practical repository-interface/MongoDB-provider split without copying Board-specific `pid`, patch, tag or snapshot schema.

The **current merged code still contains old persistence components**, deferred Asset storage, and withdrawn contribution staging/recovery. The DB migration (#31), code deletion (#47) and Asset redesign (#8) are future implementation work, **not complete**.

MongoDB handles persistence. On restart, the owning Node reconnects and reads stored facts and rebuildable projections; there is no cross-Node Repo write coordination, separate application DB recovery, or automatic replay of unfinished user contribution requests.

## Status

| Area | Status |
| --- | --- |
| Cordis Bootstrap, Member Runtime, Repo, labour.record, exact Protocol resolution | Implemented; retain |
| Runtime Record persistence | Legacy code present; MongoDB-default adapter migration pending |
| Asset / Asset Storage (#8) | **Deferred — rework required** |
| Repo Contribution (#9) | Signed fact relation retained; DB/Asset orchestration review pending |
| Standalone Recovery (#10) | **Withdrawn — remove dead code** |
| History (#11) | Deferred |
| Concrete MVP composition (#39) | Deferred |

See [MVP Issue #3](https://github.com/labourchain/repository/issues/3).

## Development

This is still a private development package (`private: true`) targeting Node `^22.20.0 || >=24.0.0`, pnpm `11.7.0`:

```bash
pnpm install
pnpm run check
pnpm run test:core-release
```

CI currently validates the **existing implementation**, not the revised MongoDB/Asset product architecture. Follow Requirements → Architecture → Specs and separate review/CI before changing runtime behavior.
