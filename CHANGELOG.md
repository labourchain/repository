# Changelog

All notable user-visible changes to this project will be documented here.

## Unreleased

### Added

- Independent `labour.record@0.1.0` Cordis Protocol capability with flat Member-signed labour facts, subjective 0.5-hour duration, optional observed time logs, and optional upstream/result Asset references.
- Initial spec-driven Repository scaffold.
- Requirements -> Spec -> Implementation development model.
- Repository product requirements under `docs/requirements.md`.
- Long-lived concepts documentation under `docs/concepts/`, with a terminology index and topic-focused documents for labour, Repository, Project, access, authorization and use.
- Draft `specs/repository-mvp.md` defining the Repository MVP contract and boundaries.
- Chinese authoritative README and separate English translation.
- Package-content verification that keeps project docs/specs, tests, sources and other non-runtime artifacts out of the npm package.

### Changed

- Aligned Repository requirements and the MVP Spec with the current concept model: Repo stores Assets, contribution carries the related worker-produced Record, and Repo-side Record history is a derived projection rather than canonical Repository storage.
- Added Repository establishment and personal Repo composition requirements; later design review removed chain-level Repo membership, kept establishment as creator-signed identity provenance rather than ownership, separated later Repo decision operator trace, and kept organization governance outside the current MVP.
