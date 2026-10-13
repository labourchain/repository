# Asset Specification

- **Status:** **Deferred — rework required (延后实现／待返工)**
- **Implementation:** Existing `asset.content@0.1.0` code was merged, but its model **has not been accepted as the Repository product Asset contract**.
- **Scope:** Design review pending, not an implementation prerequisite.

## Decision

The previous Asset Spec prematurely identified an Asset with a content-addressed immutable byte value, chose a specific identity formula and a 16 MiB resource limit, and then treated that implementation as an accepted general Repository Asset model. Those conclusions require a separate product/design review because Repository must manage actual labour results, not only opaque file bytes.

The existing Asset code is deliberately **unchanged in this documentation-only correction**. Do not extend, depend on, or mark it as an accepted MVP deliverable until Requirements → Architecture → this Spec have been reviewed again.

## Design questions to resolve

- What is the distinction between an Asset (labour result), its digital content/representation and Repo's management of the result?
- Which Asset identities are stable for different result types, including results with equal byte representations?
- Which facts describe production/reference, and which ordinary Repo-local DB fields describe storage, retrieval and management?
- Does `asset.content@0.1.0` remain one concrete content Protocol rather than the generic Asset definition?
- Which storage resource limits, metadata, retrieval and lifecycle requirements actually belong in a concrete Protocol versus its provider?

## Unchanged boundaries pending review

- `labour.record@0.1.0` uses `references[]` and `assets[]` to express labour/Asset relationships; do not introduce `previous`, `pid`, or speculative generic relations.
- Core identity/signature/ProtocolHash rules remain independent of Repository DB choices.
- Repo acceptance facts remain signed; a DB's storage identity is not an Asset, Record or Protocol identity.

All prior detailed identity, byte-limit, content hashing and storage-policy rules in this file are **withdrawn as design requirements**. They are visible in repository history if needed for audit, not in the current accepted baseline.
