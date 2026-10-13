# Asset Storage Specification

- **Status:** **Deferred — rework required (延后实现／待返工)**
- **Implementation:** Legacy filesystem `AssetStorageService` exists on `main`, but is **not an accepted storage architecture** for the redesigned Repository.
- **Depends on:** [Asset Spec — deferred](./asset.md), [Runtime Database Spec — draft](./runtime-record-database.md)

## Decision

Storage and management requirements must follow the reviewed Asset domain contract. The previous file fixed `preserve/get/has`, full-content byte storage, atomic filesystem publication and a 16 MiB limit **before** Repo Asset management was agreed. Those assumptions are no longer normative.

Do not expand or migrate the existing Asset storage implementation in the current documentation-only work. Its files and tests remain present for an explicit later replacement/removal decision.

## Future review boundary

Separate the following before implementing:

1. Asset domain identity and represented labour result.
2. Content/representation storage, where relevant.
3. Repo-local management records, queries and materialized views.
4. Durable DB-provider behavior and failure handling.
5. Signed labour/Repo contribution facts versus storage-only metadata.

MongoDB is the Repository's default Runtime database, exposed through narrow replaceable interfaces. This does **not** pre-approve a MongoDB document/blob layout for Assets or require all content bytes to live inside MongoDB. Those decisions await Asset design.

Historical detailed API, hashing/resource-limit and filesystem-durability requirements from this Spec are **withdrawn pending rework**, not considered accepted merely because code previously passed tests.
