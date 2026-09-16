# Bootstrap Specification

- **Status:** Draft
- **Scope:** executable Repository node bootstrap and Cordis runtime integration
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Bootstrap is the executable entry point for a Repository node. It starts one Cordis application and mounts the Repository node composition through Cordis.

Bootstrap is special only because it is started directly by Node.js or the operating system. After Cordis starts, Repository capabilities follow the normal Cordis plugin model.

The executable implementation keeps a stable Bootstrap Plugin name/version. The eventual Core integration may derive the full chain Plugin artifact identity from the built release, but that artifact/release mechanism is not implemented in this Repository Story while Core remains under development.

## Contract

A Bootstrap implementation must:

- expose an executable entry point;
- create exactly one root Cordis application for the node instance;
- mount the complete supplied plugin composition through Cordis rather than through a second Repository-specific plugin system;
- pass each plugin's configuration through to Cordis;
- wait for the initial composition to settle before reporting startup success;
- fail startup when a required supplied plugin remains pending, fails activation, or otherwise does not become active;
- retain a stable Bootstrap Plugin name/version for the executable implementation;
- surface startup failure after disposing Cordis-owned plugins already mounted by that root Context.

Bootstrap must not introduce a Repository-specific Runner, Hoster, Plugin Manager, Service Container, dependency graph or lifecycle system parallel to Cordis.

## Cordis runtime ownership

A Bootstrap version fixes the Cordis runtime used by that executable implementation.

The current build therefore uses the exact selected Cordis version and includes its executable runtime in the built Bootstrap output rather than allowing process startup to select an arbitrary compatible Cordis version.

This is a Bootstrap runtime decision, not a replacement for Core Plugin identity. When Core's release/artifact integration is introduced later, the built Bootstrap and its fixed Cordis runtime can be incorporated into that chain-facing artifact boundary.

## Composition and readiness

Bootstrap receives a programmatic composition of Cordis plugins and their optional configuration.

All supplied entries are mounted before readiness is audited because one plugin may depend on a service provided by an entry later in the composition. Bootstrap must then allow Cordis lifecycle work to settle and reject startup if any required supplied entry remains inactive.

Bootstrap does not need to invent a config-file loader. Programmatic composition is sufficient until an accepted Requirement introduces concrete configuration-file product behavior; a Cordis loader plugin may be adopted later when needed.

## Cordis lifecycle

Plugin-owned resources are acquired and disposed through Cordis lifecycle ownership.

Bootstrap and loaded plugins must avoid process-global mutable Repository state. Repeated or concurrent disposal requests must converge on the same root cleanup operation and must not duplicate plugin-owned listeners, timers, connections or other external resources.

Package import alone must not:

- start listeners;
- open persistent storage;
- start background work;
- mutate process-global Repository state.

Normal Cordis disposer failures follow Cordis lifecycle semantics. Repository Bootstrap does not invent a second disposer-error model around them.

## Version behavior

The Bootstrap Plugin `name/version` identifies the stable executable implementation contract during the current Repository development phase.

Changing bootstrap behavior in a way that changes that stable executable contract requires a new Bootstrap Plugin version rather than silently changing the meaning of an existing released version.

Full Core Plugin artifact construction, validation and PluginHash derivation are intentionally deferred from this Story. Repository assumes the completed Core exposes that boundary and will integrate with it rather than copy Core canonicalization or hashing logic.

## Failure model

Consumers or operators must be able to distinguish at least:

- bootstrap startup failure;
- plugin activation failure;
- required plugin dependency remaining unavailable;
- configured Runtime provider remaining unavailable through its Cordis dependency contract.

Bootstrap startup failure must dispose Cordis-owned plugins already mounted by that root Context before returning failure.

## Acceptance tests

Tests must demonstrate that:

- the bootstrap entry point creates a Cordis application and mounts supplied plugins;
- plugin configuration reaches the corresponding Cordis plugin;
- a plugin may depend on a service supplied by a later composition entry;
- a required plugin that remains pending causes startup failure;
- package import alone performs no external work and does not keep the process alive;
- plugin initialization failure is surfaced and already-mounted plugin effects are disposed;
- repeated and concurrent disposal requests do not duplicate cleanup;
- the built executable starts and exits cleanly on normal termination signals;
- the packaged `bin` target points to an actual built runtime file;
- no Repository-specific plugin lifecycle is required beside Cordis;
- the running instance retains its stable Bootstrap Plugin name/version.

Core chain-artifact verification is not part of the current Bootstrap CI acceptance while Core is still being developed in its own repository.

Tests should protect these contracts rather than coverage percentages.
