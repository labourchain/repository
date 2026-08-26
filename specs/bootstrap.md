# Bootstrap Specification

- **Status:** Draft
- **Scope:** executable Repository node bootstrap and Cordis runtime integration
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Bootstrap is the executable entry point for a Repository node. It starts a Cordis application and loads the configured LabourChain plugins through Cordis.

Bootstrap is special only because it is started directly by Node.js or the operating system. After Cordis starts, Repository capabilities follow the normal Cordis plugin model.

The stable bootstrap implementation version is declared using the LabourChain Protocol format. A running Repository node is therefore an instance of a specific Bootstrap Protocol version.

## Contract

A Bootstrap implementation must:

- expose an executable entry point;
- create exactly the Cordis application used by that node instance;
- load configured plugins through Cordis rather than through a second Repository-specific plugin system;
- keep its stable implementation version aligned with its declared Bootstrap Protocol version;
- allow runtime providers and Repository-related Protocol plugins to be composed through Cordis;
- surface startup failure when required plugins or runtime dependencies cannot be initialized.

Bootstrap must not introduce a Repository-specific Runner, Hoster, Plugin Manager, Service Container, dependency graph or lifecycle system parallel to Cordis.

## Cordis lifecycle

Plugin-owned resources are acquired and disposed through Cordis lifecycle ownership.

Bootstrap and loaded plugins must avoid process-global mutable Repository state. Repeated activation and disposal must not duplicate plugin-owned listeners, timers, connections or other external resources.

Package import alone must not:

- start listeners;
- open persistent storage;
- start background work;
- mutate process-global Repository state.

## Version behavior

The Bootstrap Protocol version identifies the stable executable runtime implementation used for the node instance.

Changing bootstrap behavior in a way that changes the declared stable runtime contract requires a new Bootstrap Protocol version rather than silently changing the meaning of an existing version.

This Spec does not define final metadata field names or package names.

## Provider composition

Bootstrap may load persistent storage, staging, projection, adapter or other Runtime provider plugins according to configuration.

Provider implementation choices must not alter LabourChain Protocol semantics. Missing providers required for the configured Repository capability must fail explicitly during startup or capability use.

## Failure model

Consumers or operators must be able to distinguish at least:

- bootstrap startup failure;
- required Cordis plugin unavailable;
- plugin dependency initialization failure;
- configured Runtime provider unavailable;
- incompatible or unavailable required Protocol implementation.

## Acceptance tests

Tests must demonstrate that:

- the bootstrap entry point creates a Cordis application and loads configured plugins;
- package import alone performs no external work;
- required plugin initialization failure is surfaced;
- activation and disposal do not leak or duplicate plugin-owned resources;
- no Repository-specific plugin lifecycle is required beside Cordis;
- the running instance exposes or otherwise retains its declared Bootstrap Protocol identity and version.

Tests should protect these contracts rather than coverage percentages.
