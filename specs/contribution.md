# Contribution Specification

- **Status:** Under revision — signed fact semantics retained; DB/Asset integration pending rework
- **Scope:** Repo acceptance of a Member labour contribution; no standalone Recovery service
- **Requirements:** [Repository requirements](../docs/requirements.md)
- **Architecture:** [Repository architecture](../docs/architecture.md)
- **Repo acceptance Protocol:** [repo-contribution.md](./repo-contribution.md)
- **Runtime DB:** [runtime-record-database.md](./runtime-record-database.md)

## Confirmed signed facts

Member confirms their labour by signing a `labour.record@0.1.0` Core Record `L`. Repo makes a distinct positive acceptance decision by signing a `repo.contribution@0.1.0` Record `D`:

```text
L.createdBy = Member EntityPublicKey
L.data.references[] = confirmed upstream references
L.data.assets[] = declared results

D.createdBy = Repo EntityPublicKey
D.data = {
  labourRecordId: L.id,
  assetId,
  operator
}
```

The Repo selects one result from `L.data.assets[]`; it does not automatically accept all results of that labour. `operator` records who acted for the Repo without defining ACL, ownership, membership or delegation. No additional Member confirmation Record, ContributionId, generic relation Protocol or Patch is required.

Repository consumes **already signed** L and D, not Member/Repo private keys. Historical interpretation is determined by exact ProtocolHash and verified artifacts.

## Accepted Repository decision

Repository `COMMITTED` means a valid Repo acceptance fact `D` has been reliably persisted and the required signed relations/prerequisites can be verified. It is not the same as Block confirmation.

```text
D absent from durable DB
  -> contribution not accepted by this Repository

valid durable D + verified required facts
  -> Repository COMMITTED

D durable but required facts corrupt/unavailable
  -> explicit integrity/storage error, not false acceptance/absence
```

The current signed relation and same-key decision are:

```text
(Repo = D.createdBy, L.id, D.data.assetId)
    -> one accepted D.id
```

Exact same D replay is idempotent. A different D under the same logical key conflicts. In the redesigned DB, the required conditional write/uniqueness must be enforced by **the DB provider** across concurrent processes; the old journal-scoped in-process exclusive section is not sufficient as the final product boundary.

D is the last durable Repository acceptance fact. L and other independently accepted facts may already persist when D is absent; their presence cannot be promoted to a Repo acceptance by heuristics.

## Database integration (pending implementation)

```text
exact Protocol/Record validation
  -> Repository domain acceptance decision
  -> narrow durable Record DB interface
  -> MongoDB implementation by default (replaceable)
  -> durable acceptance D and the signed prerequisites
```

The Node trusts the configured DB to recover its **persisted** state. Restart reconnects, reads D/L from DB, verifies exact Protocol semantics when needed and rebuilds optional indexes/views. It does **not** attempt to reconstruct an interrupted request or automatically run commit again.

Storage provider identities, collections and transactions are local implementation details, not signed Protocol data. MongoDB operations must use real unique/conditional persistence guarantees. If a cross-document invariant requires a transaction, provide it with a deployment supporting transactions; do not describe an ordinary single-process mutex or a weak standalone fallback as equivalent.

Existing contribution code uses `RecordJournalService`, `RuntimeRecordDatabaseService` and filesystem `AssetStorageService`. Those provider integrations remain **legacy code requiring refactor** and do not define the new DB contract.

## Withdrawn Recovery behavior

The separate #10 Recovery functionality has been **withdrawn**. Remove from the implementation in a later bounded code PR:

- `ContributionStagingService` and its filesystem persisted copy of the complete request;
- `RepositoryContributionRecoveryService.submit()` / `recoverPending()`;
- recovery-only `validateForStaging()`, plugins/exports and tests tied exclusively to auto-resume;
- the pre-D `STAGED / DOMAIN_CONFIRMED` durable processing-phase model and S0/S1/S2/S3 automatic re-execution matrix.

If the caller receives no response after D was persisted, the caller may read D or **explicitly retry** the exact signed operation. DB durability and idempotent acceptance handle this case. Do not introduce a new transaction/saga, restore the request from staging or fabricate D from durable-looking L/Asset remnants.

Ordinary DB read failure or storage corruption is a provider/integrity error. No application-level staging is required to recover the database.

## Asset integration is deferred

The labour `references[] / assets[]` and Repo `assetId` fields are retained. However, the previous `asset.content@0.1.0` content-bytes identity, 16 MiB limit, `preserve/get/has` filesystem provider and selected-result byte-durability workflow were not agreed as the universal Repository Asset model.

Those rules are **deferred and await Asset domain/management rework**. They may be examined as historical code but are not accepted as present MVP requirements. Revalidate the contribution's selected-Asset availability and management behavior after [Asset Spec](./asset.md) and [Asset Storage Spec](./asset-storage.md) are re-accepted. No old Asset assumptions may be silently promoted via these Contribution tests.

## Chain boundary

Repository COMMITTED is a local acceptance fact. It remains `pending-chain` until an independent accepted Block/chain-state provider supports `block-confirmed`. Candidate Block packing, broadcasting, Runtime DB persistence or any local projection alone cannot create that evidence.

## Revised acceptance checks

Required when the DB adapter is implemented:

- Signed L and D retain exact RecordId, signature, Protocol reference/hash and the accepted field shapes.
- Exact replay is idempotent; a distinct same-key D fails under actual concurrent DB writes.
- Node restart and DB reconnect read previously persisted D/L without a replay/staging coordinator.
- D absent is never reported as accepted, regardless of independently persisted earlier facts.
- Durable D plus corrupted/missing required facts fails explicitly without silent historical healing.
- No standalone contribution Recovery API/plugin/queue or synthetic ContributionId remains.
- Provider unavailability is an error, not an implicit fallback to ephemeral in-memory storage.
- Chain-state status is kept distinct from Repository acceptance.
- Approved Asset identity/storage acceptance is added **only after** its separate design review.

This is a correction of Requirements → Architecture → Spec. Implementation/test cleanup and MongoDB migration are subsequent bounded tasks.
