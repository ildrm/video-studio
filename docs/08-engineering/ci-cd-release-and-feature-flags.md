# CI/CD, release and feature flags

**Status:** proposed. **Owner:** platform lead; security and subsystem owners approve deployment. **Dependencies:** tests, migration policy, operational monitoring.

On each change: dependency/secret/license scan, format and static checks, unit and contract tests, migration tests, browser/component tests and bounded media smoke tests. Nightly or dedicated pipelines run the larger cross-browser, golden-media, fuzz, performance and restore suites. Build once with pinned base images and dependency locks; produce SBOM, signed immutable digest and provenance. Promote the same digest through isolated environments. Failed mandatory checks block release; an exception has owner, expiration and recorded risk acceptance.

Use expand/contract migrations, backwards-compatible API/schema deployments and deploy workers before sending them new task versions. Staging uses representative traffic and synthetic media. Canary by tenant cohort, inspect error rate, queue age, failed QC, authorization denials and cost; then widen gradually. A named release owner can disable flags, stop new jobs, roll back compatible app/worker image and retain old snapshot readers. Do not undo destructive data migrations automatically; follow a tested recovery plan. Define rollback triggers and cohort sizes before each release.

Flags are server-authoritative for entitlement and security; UI-only flags cannot grant access. Require owner, purpose, default-off for risky capabilities, scope, audit and expiry. Test both paths and fail closed for authorization, AI data transfer and publishing. Remove stale flags. **Acceptance:** an intentional failed canary stops expansion and returns to a known healthy release; artifact and migration versions remain traceable.
