# Changelog

All notable user-visible changes to this project will be documented here.

## Unreleased

### Added

- Initial spec-driven Repository scaffold.
- Requirements -> Spec -> Implementation development model.
- Repository product requirements under `docs/requirements.md`.
- Long-lived concepts documentation under `docs/concepts/`, with a terminology index and topic-focused documents for labour, Repository, Project, access, authorization and use.
- Draft `specs/repository-mvp.md` defining the Repository MVP contract and boundaries.
- Chinese authoritative README and separate English translation.
- Package-content verification that keeps project docs/specs, tests, sources and other non-runtime artifacts out of the npm package.

### Changed

- Aligned Repository requirements and the MVP Spec with the current concept model: Repo stores Assets, contribution carries the related worker-produced Record, and Repo-side Record history is a derived projection rather than canonical Repository storage.
- Added Repository establishment, operator-managed membership and Personal Repo requirements while keeping public/common usage accounting and private-proof mechanisms outside the current MVP.
