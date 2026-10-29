# Documentation review findings and fixes

Status: reviewed with remaining scope gaps • Owner: documentation architect • Date: 2026-10-29. Scope: all 102 original documentation files, including full cross-document contract, UX, security, media, AI and delivery review. New machine-readable contracts and checks were reviewed as part of the fixes. Verdict: CONCERNS for full product implementation readiness; the defects below are corrected in the proposed specification, not in a running application.

| Finding | Severity before fix | Correction and evidence |
|---|---|---|
| Open project payloads allowed malformed nested clips/effects | Critical | Added [project schema](../03-frontend/schemas/project-v1.schema.json), representative [project](../03-frontend/examples/project-v1.json) and [snapshot](../03-frontend/examples/render-snapshot.json); OpenAPI references one model; invalid nested inputs tested. |
| One-second example was not frame-aligned at 30000/1001 | Warning | Example now 30 frames =240240 ticks; explicit source PTS/timebase and rational checks. |
| If-Match mismatch was specified as 409 | Warning | [API](../04-backend/api-design-and-contracts.md) now uses 412, 428 for missing precondition and 409 for state/idempotency conflict; client/testing docs aligned. |
| Generic API responses and missing upload/preset/event contracts | Critical | Typed resources/pages, project canvas input, uploaded-part listing, cancel, versioned presets, immutable revision read and separate SSE contract. Location/ETag/status definitions added. |
| Replay, timeout and explicit retry could duplicate work or repeat a failed job forever | Critical | Actor/scope/path/request/precondition-bound key; 24-hour proposed retention; auth recheck; explicit retry uses a new logical job/key; automatic attempts use lease fencing. |
| Retry and cancellation state rules conflicted | Critical | [Transition table](../04-backend/job-queues-workers-and-render-orchestration.md), terminal states, transient retry path, completion/cancel race and cleanup ledger specified. |
| Storage promotion assumed object-store atomicity | Critical | Immutable attempt objects, database manifest pointer promotion, stale-worker fencing and orphan collection replace assumed rename/transaction. |
| Multipart integrity and resume were underspecified | Critical | Part ETag/checksum distinction, authoritative part manifest, full-file hash, CORS and crash reconciliation specified. |
| Browser draft recovery implied encryption/privacy guarantees | Critical | Memory default, opt-in bounded IndexedDB cache, account separation, logout clearing and explicit script/shared-device threat limits. |
| Roles and project-grant inheritance were ambiguous | Critical | [Action matrix](../01-product/user-roles-and-permissions.md), project-reference asset scope, contributor restrictions, job ownership, org/support limits and grant combination rules. |
| Share expiry and artifact/revision binding conflicted | Critical | Mandatory expiry, immutable artifact/revision match, separate download permission, no source/JSON disclosure and URL revocation limits. |
| Speech safeguards started after phase-2 speech | Critical | Added T02-07 before transcription/TTS; phase-5 task now expands existing safeguards; feature and gate phases aligned. |
| Numeric queue, open-time, recovery and maintenance rules disagreed | Warning | [NFR register](../01-product/non-functional-requirements.md) is authoritative; metrics and alarm thresholds distinguished and all proposals remain unmeasured. |
| Upload/ingestion dependency required worker before its own prerequisite | Warning | Split storage transfer T01-02 from jobs-dependent ingestion T01-09; added schema/contract/role/cancel acceptance cases. |
| API deployment could emit task versions before workers support them | Critical | Additive schema → compatible workers → API/web → feature flag sequence. |
| QC implied manual approval for every render and a signed-report implementation | Warning | Mandatory technical QC versus content-sensitive human review distinguished; integrity-protected report required without claiming a signing system exists. |
| Preview 'exact' could imply pixel parity from lossy proxies | Warning | Timing-exact classification and approximation disclosure; effects remain gated by measured parity. |
| Toolkit phase/template count and provenance were overstated | Warning | Product phases aligned, alias list no longer counted as independent destinations, unpinned evidence confidence reduced and reproducibility gap preserved. |

## Verification and limits

Commands run from repository root (prefix with `rtk` as required locally):

```sh
rtk proxy python3 docs/10-audit/validate_documentation.py
rtk proxy node docs/10-audit/validate-contracts.cjs
rtk proxy redocly lint docs/04-backend/openapi.yaml --extends minimal
```

Node contract checks require Ajv 8 and ajv-formats 3 available in Node's module path. Redocly CLI 1.34.5 and cached Ajv 8.20.0 were used without adding application dependencies. The initial Python validator installation failed on package-host connectivity; cached tools enabled the checks. The offline checker covers local links/anchors, JSON references, tables/fences, policy headers, feature/task/test IDs, task dependency cycles and portal coverage. Contract checks validate examples, ten malformed project cases and rational timing. OpenAPI validation checks the structural contract, not implementation or all policy behavior.

Remaining work: detailed per-capability contracts and full nested advanced editing semantics, later membership/comment/billing/public-review APIs, reproducible toolkit capability evidence, legal/provider choices and runtime media/browser/accessibility/load/restore tests. Those require explicit design or execution work; they are not hidden as passed gates. See [risks](unresolved-risks-and-research-gaps.md). No production feature or runtime acceptance scenario was executed.
