# Protocol Resolution Specification

- **Status:** Draft
- **Scope:** exact LabourChain Protocol identity/version resolution in a Cordis runtime
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Historical LabourChain facts must be interpreted and validated by the exact Protocol identity and version they reference.

Protocol implementations are Cordis plugins. This Spec defines the additional version-resolution contract required by LabourChain and does not define a second plugin runtime.

## Protocol implementation contract

A Protocol plugin must expose enough stable metadata to identify:

- the LabourChain Protocol identity it implements;
- the Protocol version it implements.

Final metadata field names and package naming conventions are not fixed by this Spec.

A new Protocol version is represented by a corresponding executable implementation. Existing historical Protocol semantics must not be silently changed by routing old facts to a newer implementation.

## Resolution behavior

The runtime must support more than one version of the same Protocol at the same time when needed.

For a fact that references a Protocol identity and version, resolution must:

1. read the referenced Protocol identity and version from the applicable Core-defined fact or relation;
2. find the loaded implementation matching that exact identity and version;
3. execute that implementation;
4. fail explicitly if the required implementation is unavailable.

Resolution must not silently fall back to:

- `latest`;
- the newest installed version;
- another compatible-looking version;
- a default version selected without reference to the historical fact.

## Cordis integration

Protocol implementations are loaded, scoped and disposed through Cordis.

Repository must not create a separate Protocol Plugin Manager or lifecycle system. Any lookup/index used to resolve loaded Protocol implementations is runtime support for LabourChain semantics and must remain integrated with Cordis-loaded plugins.

## Core boundary

Repository must not copy or redefine Core schemas for Protocol identity/version references, Record, Asset, identity, signature, confirmation, commit or block semantics.

If Core cannot provide the required identity/version information or semantics, processing must fail closed rather than infer a substitute.

## Failure model

Consumers must be able to distinguish at least:

- required Protocol identity unavailable;
- required Protocol version unavailable;
- duplicate or ambiguous implementation for the same identity/version in one runtime context;
- invalid Protocol metadata;
- fact references a Protocol identity/version that cannot be interpreted according to Core semantics.

## Acceptance tests

Tests must demonstrate that:

- Protocol A v1 and Protocol A v2 can coexist in one Cordis runtime;
- a fact referencing A v1 is dispatched to the A v1 implementation;
- a fact referencing A v2 is dispatched to the A v2 implementation;
- removing A v1 causes an A v1 fact to fail explicitly;
- A v1 facts never fall back to A v2 or `latest`;
- duplicate ambiguous implementations for one identity/version fail rather than being selected nondeterministically;
- Protocol implementations use Cordis lifecycle rather than a parallel Repository plugin runtime.
