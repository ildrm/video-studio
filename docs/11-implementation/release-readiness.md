# Release readiness

Status: **NOT READY** • Owner: release manager • Reviewed: 2026-10-29. No deployment or approval is implied by the existence of code, containers or a passing subset of tests.

| Gate | Outcome | Evidence / action |
|---|---|---|
| Core user workflow | PARTIAL | Development browser exercised an API-seeded video path; verify a fresh browser file-picker upload, cancellation/resume, session recovery and each advertised export with real media. |
| Identity and authorization | BLOCKED | Development-only passwords; OIDC, real verification/recovery, complete RBAC and independent tenant/security review remain. |
| Storage and media execution | BLOCKED | Local filesystem and embedded unsandboxed supervisor; isolate workers, enforce quotas, use authorized object storage, test cleanup and failure recovery. |
| Fidelity and compatibility | PARTIAL | Worker executes a narrow SDR/cut/dissolve subset; full composition preview, provider/build/codec matrix, accessibility and edge-case tests remain. |
| Data durability and operations | BLOCKED | Production backup/restore, metrics, alerting, incident response, regional and disaster-recovery objectives are not verified. |
| Quality and release pipeline | PARTIAL | The current worker suite passed 35/35 in restricted Debian; host passed 29 with six caption skips using a test-only shim. The latest Compose HTTP smoke passed upload, caption render and download through the web rewrite; the fresh packaged worker passed 35/35 tests without a bind mount under network, filesystem and resource restrictions. The latest build and typecheck passed. Browser automation and the npm advisory audit remain unavailable. Validate interactive browser behavior and hosted CI, rerun after subsequent changes, and resolve blockers. |
| Privacy, legal and costs | BLOCKED | Provider terms, codec/font licenses, retention, residency, metering and pricing need decisions and review. |
| Scope coverage | PARTIAL | Many feature families remain partial or not started; see [coverage](feature-coverage-matrix.md) and [phase progress](phase-progress.md). |

Before any release decision, capture reproducible build/image digests, fixture hashes, test reports, migration/rollback and restore drills, role/tenant penetration results, measured load/cost budgets, supported browser/accessibility evidence, legal/privacy review and named approvals. The existing API intentionally rejects production mode until production identity is implemented.
