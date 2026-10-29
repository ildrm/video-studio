# Engineering standards and repository structure

**Status:** proposed; no application has been implemented. **Owner:** principal engineer. **Review:** security, media and frontend leads. **Scope:** all phases. **Dependencies:** architecture decisions and release gates.

## Repository and boundaries

Use a TypeScript monorepo with independently deployable `apps/web`, `apps/api`, `workers/media`, `workers/ai`, `packages/project-schema`, `packages/contracts`, `packages/design-system`, `infra`, and `tests/fixtures`; this is a proposed future layout, not the current repository. Keep shared packages pure and dependency-directed: schema has no UI or service dependencies; workers consume a versioned snapshot and do not depend on the web app. A monorepo favors coordinated schema migrations and atomic contract changes; revisit separate repositories when permissions or release cadence justify their operational cost.

Strict TypeScript, checked nulls and discriminated unions apply at boundaries; validate every untrusted payload at runtime, even when generated types compile. For media adapter scripts, use typed, linted Python only where justified, with pinned interpreter and dependencies; use argument arrays, never shell interpolation. Use structured errors with a stable machine code, safe message and correlation ID. Never log media, credentials or transcript text by default. Keep path/operation allowlists server-owned.

## Change discipline

Use short-lived branches and reviewed pull requests: include intent, linked acceptance IDs, migration and rollback plan, threat impact, test evidence, accessibility impact, and operational impact. Two reviewers for authorization, cryptography, media sandbox or billing changes, including the domain owner. CI checks formatting, type checking, unit/integration tests, dependency and secret scanning, and license inventory; a human reviews findings and policy exceptions. Sign and retain build provenance and pin dependency lockfiles and container digests. New dependencies require maintenance, security, license and size review.

API changes follow versioned compatibility policy: additive fields are tolerated, breaking behavior gets a new version and sunset period; deprecations are observable. Project schema carries an explicit version; migrations are deterministic, backed up, tested forward and rollback-safe, and must preserve every supported field and reject unknown versions/fields before writes; an older client must not strip or reinterpret unsupported data. Database deploys use expand/migrate/contract with reversible steps, production data backfill checkpoints and post-migration checks; do not destroy old data until rollback window closes. Feature flags have owner, default, exposure rules, expiry and removal issue. Tag releases and retain artifact digests, migration versions and deployment records.

**Acceptance:** A reviewer can trace a code change to a requirement, test and deployment; an incompatible schema cannot silently overwrite a newer project. **Risk:** repository and deployment choices need a Phase 0 spike. See [CI/CD](ci-cd-release-and-feature-flags.md) and [definition of done](../09-delivery/phase-gates-and-definition-of-done.md).
