# Bootstrap Specification

- **Status:** Draft
- **Scope:** executable Repository node bootstrap and Cordis runtime integration
- **Requirements:** [`../docs/requirements.md`](../docs/requirements.md)
- **Architecture:** [`../docs/architecture.md`](../docs/architecture.md)
- **Umbrella:** [`repository-mvp.md`](./repository-mvp.md)

## Purpose

Bootstrap is the executable entry point for a Repository node. It starts one Cordis application and mounts the Repository node composition through Cordis.

Bootstrap is special only because it is started directly by Node.js or the operating system. After Cordis starts, Repository capabilities follow the normal Cordis plugin model.

The stable bootstrap implementation version is declared using the LabourChain Protocol format. A running Repository node is therefore an instance of a specific Bootstrap Protocol version.

## Contract

A Bootstrap implementation must:

- expose an executable entry point;
- create exactly one root Cordis application for the node instance;
- mount the complete supplied plugin composition through Cordis rather than through a second Repository-specific plugin system;
- pass each plugin's configuration through to Cordis;
- wait for the initial composition to settle before reporting startup success;
- fail startup when a required supplied plugin remains pending, fails activation, or otherwise does not become active;
- keep its stable implementation version aligned with its declared Bootstrap Protocol version;
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

## Version behavior

The Bootstrap Protocol version identifies the stable executable runtime contract used for the node instance.

Changing bootstrap behavior in a way that changes that declared stable runtime contract requires a new Bootstrap Protocol version rather than silently changing the meaning of an existing version.

The exact resolved Cordis release is deployment/runtime metadata, not a second Bootstrap identity.

This Story does not implement Core's final Protocol/Plugin artifact packaging while Core remains under development. Repository assumes the completed Core will expose the required release boundary and will integrate with it rather than duplicate Core canonicalization or hashing logic locally.

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

Core artifact verification is not part of the current Bootstrap acceptance while Core is still being developed in its own repository.

Tests should protect these contracts rather than coverage percentages.
