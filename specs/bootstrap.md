# Bootstrap Specification

- **Status:** Draft
- **Scope:** executable Repository node bootstrap and Cordis runtime integration
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Bootstrap is the executable entry point for a Repository node. It starts one Cordis application and mounts the Repository node composition through Cordis.

Bootstrap is special only because it is started directly by Node.js or the operating system. After Cordis starts, Repository capabilities follow the normal Cordis plugin model.

Bootstrap source carries a stable LabourChain Protocol **reference** (`repository.bootstrap@0.1.0`) for the executable contract. Under Core v0.1.0, `name@version` is not by itself an exact Protocol identity: exact identity additionally requires the built artifact/descriptor and ProtocolHash.

## Contract

A Bootstrap implementation must:

- expose an executable entry point;
- create exactly one root Cordis application for the node instance;
- mount the complete supplied plugin composition through Cordis rather than through a second Repository-specific plugin system;
- pass each plugin's configuration through to Cordis;
- wait for the initial composition to settle before reporting startup success;
- fail startup when a required supplied plugin remains pending, fails activation, or otherwise does not become active;
- keep its stable source reference aligned with the executable contract;
- surface startup failure after disposing Cordis-owned plugins already mounted by that root Context.

Bootstrap must not introduce a Repository-specific Runner, Hoster, Plugin Manager, Service Container, dependency graph or lifecycle system parallel to Cordis.

## Cordis runtime compatibility

Bootstrap depends on a compatible Cordis 4.x runtime rather than embedding a private Cordis copy into the executable.

The executable and all loaded plugins must share the host's resolved Cordis module instance. The current package range starts at the latest stable release available when this Story is implemented (`^4.0.2`). A later compatible 4.x release may be selected by normal package resolution without changing Bootstrap Protocol semantics by itself.

If a future Cordis change is incompatible with the accepted Bootstrap contract, compatibility must be narrowed or the Bootstrap Protocol must be revised explicitly rather than hidden behind a second bundled runtime.

## Composition and readiness

Bootstrap receives a programmatic composition of Cordis plugins and their optional configuration.

All supplied entries are mounted before readiness is audited because one plugin may depend on a service provided by an entry later in the composition. Bootstrap waits for Cordis lifecycle work to settle and rejects startup if any required supplied entry remains inactive.

This Story defines the executable bootstrap shell and the programmatic composition boundary. The executable does not choose a concrete Repository product composition yet; that composition belongs to the capability integration that follows. Bootstrap does not need to invent a config-file loader for it.

## Cordis lifecycle

Plugin-owned resources are acquired and disposed through Cordis lifecycle ownership.

Bootstrap and loaded plugins must avoid process-global mutable Repository state. Repeated or concurrent disposal requests must converge on the same root cleanup operation and must not duplicate plugin-owned listeners, timers, connections or other external resources.

Package import alone must not:

- start listeners;
- open persistent storage;
- start background work;
- mutate process-global Repository state.

Normal Cordis disposer failures follow Cordis lifecycle semantics. Repository Bootstrap does not invent a second disposer-error model around them.

The executable must catch normal termination signals before node startup completes. A first termination request is handled as graceful shutdown; a later signal may fall back to normal operating-system termination rather than requiring a second shutdown framework.

## Version and identity behavior

The current source reference `repository.bootstrap@0.1.0` identifies the intended bootstrap contract for development and composition.

Under Core v0.1.0:

```text
name@version
= human-readable Protocol reference

ProtocolHash
= exact machine authority over descriptor + executable identity
```

Changing bootstrap behavior in a way that changes the stable Protocol semantics requires a new version rather than silently changing an existing reference. A future publishable Bootstrap Protocol artifact must use Core v0.1.0 Protocol/ArtifactHash rules; Bootstrap does not reproduce those algorithms locally.

The exact resolved Cordis release remains deployment/runtime metadata, not a second Protocol identity.

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
- the running instance retains its declared Bootstrap Protocol identity and version.

Core v0.1.0 artifact loading/verification belongs to the Repository Host/runtime composition boundary, not to the Bootstrap Story itself. Bootstrap acceptance therefore remains focused on process entry, Cordis composition, readiness and lifecycle.

Tests should protect these contracts rather than coverage percentages.
