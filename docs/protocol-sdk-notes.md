# Protocol SDK notes from `member.identity`

This note records only requirements exposed by implementing the first non-Core Protocol. It is input to `labourchain/core-protocols` #23 and #31, not a second SDK design owned by Repository.

## Construction flow exercised by Member

A useful Protocol build path needs to support:

```text
explicit TS/JS entry
-> bundle one Node 22 ESM artifact
-> preserve Cordis namespace-plugin exports when present
-> enforce the ABI decompressed-size limit
-> deterministic gzip
-> ArtifactHash
-> Protocol descriptor
-> ProtocolHash
-> optional embedded Base64 artifact
-> verify through core.protocol
-> smoke-import executable namespace
```

## Requirements exposed by real implementation work

### 1. Exact Protocol dependencies are build inputs

`member.identity` reuses Core behavior instead of copying it. Its executable semantics require the exact `core.entity` and `core.record` Protocol identities. The SDK therefore needs dependency inputs as full chain identities:

```text
name + version + protocolHash
```

A package name or semver range is insufficient for chain-stable dependency identity.

### 2. ProtocolHash cannot be self-embedded in its own artifact

A Protocol implementation often validates Records that reference that ProtocolHash. The artifact cannot hard-code its own ProtocolHash because the hash commits to the artifact bytes.

The runtime/host therefore needs a standard mount input carrying the already verified resolved Protocol identity, at minimum the exact ProtocolHash. `member.identity` currently accepts `{ protocolHash }` as the narrow local projection of this requirement while Core #31 determines the generic ABI contract.

### 3. Cordis runtime dependencies and chain Protocol dependencies are different

For Member:

```text
chain dependencies
  core.entity@exact ProtocolHash
  core.record@exact ProtocolHash

Cordis runtime dependencies
  core.entity service
  core.record service
  recordJournal service
```

The first set is chain-stable identity and must be resolved/verified by the Protocol host. The second set is lifecycle/service readiness and is handled by Cordis `inject`.

They can correspond, but neither is a substitute for the other. Runtime-only services such as `recordJournal` must not be forced into `Protocol.dependencies[]` merely because the implementation injects them.

### 4. A mountable Protocol artifact should remain an ordinary Cordis namespace plugin

Cordis already supports module-style named exports such as `name`, `inject`, and `apply`. A LabourChain host should not wrap these in a second plugin framework.

The SDK should preserve/export-test this shape when a Protocol is intended to be Cordis-mounted. Pure helper exports may coexist in the same ESM artifact.

### 5. Build verification needs two different smoke checks

Generic SDK verification can check:

- one output artifact;
- deterministic gzip/profile;
- descriptor/hash verification;
- bounded gunzip/import.

A Cordis-mountable Protocol additionally benefits from a smoke check that the imported namespace has the required Cordis plugin surface and can be mounted by the supported Cordis runtime. Protocol-specific service methods remain Protocol tests, not SDK responsibilities.

## Deliberately not concluded here

This implementation does not decide:

- whether every `js-esm` Protocol must be Cordis-mountable or only higher-layer Protocols;
- the final generic runtime mount-config type;
- whether Core Protocol services use Protocol names as Cordis service names;
- release/registry/discovery behavior;
- automatic source discovery, templates, or a bundler abstraction.

Those decisions belong to Core #31 / #23 after comparing the Member use case with the four Core Protocols.
