# Protocol Resolution Specification

- **Status:** Draft
- **Scope:** exact LabourChain ProtocolHash / executable-artifact resolution in a Cordis runtime
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Historical LabourChain facts must be interpreted and validated by the exact Protocol semantics they commit to.

A fact exposes two related identities:

```text
protocol
    -> human-readable Protocol reference, for example name@version

protocolHash
    -> exact machine authority for the Protocol descriptor / executable artifact
```

The human-readable reference explains what Protocol is being invoked. It is not sufficient to select historical executable semantics when several versions or artifacts exist. Repository resolution therefore keys exact interpretation by `ProtocolHash` and verifies that the resolved descriptor still declares the expected human-readable reference.

Protocol implementations remain Cordis plugins. This Spec defines the LabourChain resolution and verification bridge; it does not define a second plugin runtime.

## Core boundary

Core v0.1.0 owns deterministic ProtocolHash / ArtifactHash validity and exact artifact verification. Repository must consume that boundary rather than reproduce canonicalization, hashing or artifact-integrity rules.

Repository Host/runtime owns the operational work needed to:

```text
Protocol reference + ProtocolHash
    -> resolve exact descriptor / artifact
    -> apply Core verification
    -> obtain the verified executable implementation
    -> mount / expose it through Cordis
```

If Core verification cannot establish that the resolved descriptor/artifact corresponds to the requested `ProtocolHash`, resolution fails.

## Resolution behavior

For a fact that requires Protocol semantics, resolution must:

1. obtain the fact's human-readable Protocol reference and exact `ProtocolHash` through the applicable Core-defined Record / relation shape;
2. resolve the descriptor / executable artifact for that exact hash;
3. verify the descriptor and artifact through Core's Protocol verification boundary;
4. require the verified descriptor's human-readable Protocol reference to match the fact's reference;
5. make the verified implementation available through Cordis;
6. execute only that exact semantics;
7. fail explicitly when the exact hash cannot be resolved or verified.

Resolution must not silently fall back to:

- `latest`;
- the newest installed version;
- another artifact carrying the same version string;
- a nearest or semver-compatible version;
- another loaded implementation that appears behaviorally compatible.

Two implementations with the same human-readable `name@version` but different hashes are not interchangeable for historical validation.

## Coexistence

A runtime may need several historical ProtocolHash values at the same time.

Coexistence is a resolution requirement, not permission to create a second plugin manager. The Host/runtime may maintain the minimum lookup needed to associate an exact verified ProtocolHash with the Cordis-loaded implementation that provides those semantics.

A collision or ambiguous runtime mapping in which one exact ProtocolHash could resolve to more than one non-equivalent implementation must fail closed.

## Block composition relationship

Future Block validation will use the same exact-resolution primitive at a larger scope.

A Block Header is expected to commit the Repo Protocol composition used for that Block together with exact hashes that bind those implementations / artifacts. A peer validator can then resolve and verify that exact composition before replaying the Protocol-defined validation of the Block's Records and relationships.

This Spec supplies the exact Protocol resolution boundary required by that design. It does **not** define the Block Header manifest encoding, Block packer, peer validator, chain synchronization or consensus.

## Cordis integration

Verified Protocol implementations are mounted, scoped and disposed through Cordis.

Repository must not create a separate Protocol implementation lifecycle, dependency system, HMR layer or plugin manager. Resolution may discover and verify an implementation before Cordis mounts it, but lifecycle ownership after mounting remains Cordis-native.

## Failure model

Consumers must be able to distinguish at least:

- required exact ProtocolHash unavailable;
- resolved descriptor / artifact fails Core verification;
- resolved descriptor's Protocol reference does not match the fact's reference;
- required executable artifact unavailable;
- exact hash maps ambiguously to non-equivalent runtime implementations;
- verified implementation cannot be mounted or becomes unavailable through Cordis.

## Acceptance tests

Tests must demonstrate that:

- a fact is dispatched by its exact `ProtocolHash`, not merely by `name@version`;
- two historical hashes can coexist when the runtime needs both;
- a fact never falls back to `latest`, a nearest version or a same-version different artifact;
- an unavailable exact hash fails explicitly;
- a descriptor/artifact that does not verify against the requested hash fails explicitly;
- a human-readable Protocol-reference mismatch fails explicitly;
- adding a newer Protocol implementation does not change the semantics selected for an existing historical fact;
- verified implementations use Cordis lifecycle rather than a parallel Repository plugin runtime.
