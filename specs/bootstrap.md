# Bootstrap Specification

- **Status:** Draft
- **Scope:** executable Repository node bootstrap and Cordis runtime integration
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Bootstrap is the executable entry point for a Repository node. It starts a Cordis application and loads the configured LabourChain plugins through Cordis.

Bootstrap is special only because it is started directly by Node.js or the operating system. After Cordis starts, Repository capabilities follow the normal Cordis plugin model.

The stable bootstrap executable is also a LabourChain chain Plugin implementation. A running Repository node therefore retains the stable name/version of the Bootstrap Plugin implementation from which it was started.

## Core Plugin terminology and artifact boundary

Current `labourchain/core-plugins` uses **Plugin / PluginHash** for the immutable executable chain package. It does not expose the predecessor `Protocol` entity as a parallel runtime identity.

A complete Core `PluginManifest` is an artifact-level structure. Its identity commits to final runtime files, schema, dependencies, file sizes and file hashes; `PluginHash` is calculated from the canonical manifest.

Repository Bootstrap therefore must not copy `core.plugin` manifest canonicalization or hashing rules into this package merely to manufacture a PluginHash from source files.

Until reusable Core artifact tooling exists, Bootstrap source code may retain the stable Plugin `name` and `version` required to identify the implementation contract. Complete `PluginManifest` construction, artifact verification and `PluginHash` calculation belong to Core tooling and the release/build boundary.

## Contract

A Bootstrap implementation must:

- expose an executable entry point;
- create exactly the Cordis application used by that node instance;
- load configured plugins through Cordis rather than through a second Repository-specific plugin system;
- retain a stable Bootstrap Plugin name/version for the executable implementation;
- allow runtime providers and Repository-related chain Plugin implementations to be composed through Cordis;
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

The Bootstrap Plugin `name/version` identifies the source-level stable executable implementation contract. The final chain artifact identity is the Core PluginHash produced for the built artifact.

Changing bootstrap behavior in a way that changes the stable executable contract requires a new Bootstrap Plugin version rather than silently changing the meaning of an existing released version.

This Spec does not define Repository-specific replacements for Core Plugin metadata or artifact hashing.

## Provider composition

Bootstrap may load persistent storage, staging, projection, adapter or other Runtime provider plugins according to composition supplied by the caller or executable assembly.

Provider implementation choices must not alter LabourChain chain Plugin semantics. Missing providers required for the configured Repository capability must fail explicitly during startup or capability use.

Bootstrap does not need to invent a config-file loader. Programmatic composition through Cordis is sufficient until an accepted Requirement introduces a concrete configuration-file product behavior; Cordis loader plugins may be adopted later when needed.

## Failure model

Consumers or operators must be able to distinguish at least:

- bootstrap startup failure;
- required Cordis plugin unavailable;
- plugin dependency initialization failure;
- configured Runtime provider unavailable;
- incompatible or unavailable required chain Plugin implementation.

Bootstrap startup failure must dispose Cordis-owned plugins already loaded by that root Context before returning failure.

Normal Cordis disposer failures follow Cordis lifecycle semantics and are logged by Cordis during unload; Repository Bootstrap must not invent a second disposer-error model around them.

## Acceptance tests

Tests must demonstrate that:

- the bootstrap entry point creates a Cordis application and loads supplied plugins;
- package import alone performs no external work and does not keep the process alive;
- required plugin initialization failure is surfaced;
- startup failure disposes already-loaded Cordis plugin effects;
- activation and disposal do not leak or duplicate plugin-owned resources;
- no Repository-specific plugin lifecycle is required beside Cordis;
- the running instance exposes or otherwise retains its stable Bootstrap Plugin name/version.

Artifact-level acceptance for complete `PluginManifest` / `PluginHash` is deferred only until reusable `core.plugin` implementation/tooling exists; Repository must consume that tooling rather than duplicate it.

Tests should protect these contracts rather than coverage percentages.
