# Protocol SDK notes from `member.identity`

This note records only requirements exposed by implementing the first non-Core Protocol. Core runtime ABI #31 is complete in v0.1.0; the remaining SDK observations are input to deferred `labourchain/core-protocols` #23, not a second SDK design owned by Repository.

## Construction flow exercised by Member

With the runtime contract accepted in Core #31, the useful build path is:

```text
explicit TS/JS Protocol entry
-> bundle one Node 22 ESM artifact
-> final ESM namespace exports exactly `plugin`
-> validate Cordis object Plugin shape
-> validate Protocol.dependencies[] -> plugin.inject projection
-> enforce ABI decompressed-size limit
-> deterministic gzip
-> ArtifactHash
-> Protocol descriptor (`cordis-js-esm`, ABI 1)
-> ProtocolHash
-> optional embedded canonical Base64 artifact
-> verify through core.protocol
-> bounded gunzip + import
-> Cordis mount smoke
```

The final artifact is ready to mount. A node must not rebuild source, npm-install the Protocol, or wrap the imported implementation in a second plugin framework.

## Requirements exposed by real implementation work

### 1. Exact Protocol dependencies are build inputs

`member.identity` reuses Core behavior instead of copying it. Its executable semantics require the exact `core.entity` and `core.record` Protocol identities. The SDK therefore needs dependency inputs as full chain identities:

```text
name + version + protocolHash
```

A package name or semver range is insufficient for chain-stable dependency identity.

For Member, those dependencies project to the Core #31 service keys:

```text
protocol:core.entity@0.1.0
protocol:core.record@0.1.0
```

The SDK can deterministically derive those keys from dependency name/version and verify that each is present in `plugin.inject`.

### 2. ProtocolHash cannot be self-embedded in its own artifact

A Protocol implementation often validates Records that reference that same ProtocolHash. `member.identity` is the first concrete example: it must reject a Record that says `member.identity@0.1.0` but carries a different ProtocolHash.

The artifact cannot hard-code its own ProtocolHash because ProtocolHash commits to the artifact bytes. The Host therefore needs a standard mount context/config carrying the identity of the already verified Protocol being mounted, at minimum its exact ProtocolHash.

Repository currently uses the narrow shape:

```ts
{ protocolHash }
```

Core v0.1.0 deliberately leaves Host mount configuration outside Core Protocol validity. Repository therefore treats this as its current minimal Host-to-Protocol mount convention and will only widen it when a concrete loader/runtime requirement appears.

### 3. Chain semantic dependencies and Cordis runtime dependencies remain distinct

For Member:

```text
Protocol.dependencies[]
  core.entity + exact version + exact ProtocolHash
  core.record + exact version + exact ProtocolHash

plugin.inject
  protocol:core.entity@0.1.0
  protocol:core.record@0.1.0
  recordJournal
```

The first set is chain-stable semantic identity and must be resolved/verified by the Host. The projected Core service keys express runtime readiness through Cordis.

`recordJournal` is a runtime-only service. It belongs in `plugin.inject` but not `Protocol.dependencies[]` or ProtocolHash.

Thus the Core #31 invariant is exercised directly:

```text
project(Protocol.dependencies[]) ⊆ plugin.inject
```

### 4. The artifact entry should be deliberately thin

Repository keeps ordinary implementation code in `src/member.ts` and gives the Protocol build one explicit entry:

```ts
// src/protocols/member.identity.ts
export const plugin = createMemberProtocolPlugin()
```

The SDK bundles that entry and verifies the **built** module namespace contains exactly the named runtime entry `plugin`. Package/source modules may expose helpers and types separately; those exports do not become arbitrary Protocol runtime exports.

The SDK does not need to synthesize another wrapper or introduce a `defineProtocol()` abstraction in v1. The explicit entry is already the thin Cordis wrapper; the SDK bundles and validates it.

This separation keeps package developer APIs and Protocol runtime ABI independent without creating a second runtime abstraction.

### 5. SDK verification has both identity and Cordis-runtime checks

A minimal `buildProtocol(...)` path for `cordis-js-esm` should verify:

1. explicit entry produces exactly one ESM bundle;
2. imported namespace exposes exactly `plugin`;
3. `plugin.name === name@version`;
4. `plugin` satisfies the Cordis object Plugin shape required by ABI v1;
5. every chain dependency's projected service key appears in `plugin.inject`;
6. additional runtime-only inject keys are allowed;
7. the artifact does not bundle a private Cordis runtime;
8. decompressed runtime is within the ABI hard limit;
9. deterministic gzip profile is applied;
10. ArtifactHash / Protocol descriptor / ProtocolHash are constructed;
11. output verifies through `core.protocol`;
12. exact gzip bytes bounded-gunzip and import successfully;
13. the imported `plugin` can be mounted by the supported Cordis runtime;
14. size diagnostics are returned.

Protocol-specific behavior such as `declareMember()` / `requireMember()` remains the Protocol's own test responsibility, not generic SDK behavior.

## Current development boundary

Core v0.1.0 is released and the `core.entity@0.1.0` / `core.record@0.1.0` `cordis-js-esm` identities are frozen. Repository runtime integration may therefore consume those exact released Protocols now.

Protocol Dev SDK #23 remains deferred, so Repository does not yet claim a publishable/frozen `member.identity` or `repo.establishment` artifact. Source/runtime semantics and Host integration can continue independently of SDK implementation.

## Deliberately not concluded here

This implementation does not decide:

- the final generic Host mount-config/context type carrying the Protocol's own verified identity;
- release/registry/discovery behavior;
- automatic source discovery, templates, minification, or a bundler abstraction;
- richer Protocol metadata not required by the Member use case.

Those remain future Host/runtime or Protocol Dev SDK #23 decisions; Core #31 is already complete.
