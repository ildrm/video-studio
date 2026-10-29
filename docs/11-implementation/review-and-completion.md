# Multidisciplinary review and completion checkpoint

Status: **current implementation reviewed and corrected; full product incomplete, local development only** • Reviewed 2026-10-29. This records the scope of the current review and the fixes implemented, not completion of the full product or approval to deploy. See [coverage](feature-coverage-matrix.md), [verification](testing-and-verification.md), [known issues](known-issues.md) and [release readiness](release-readiness.md).

## Coverage and fixes

| Review area | Findings and implemented changes | Remaining work |
|---|---|---|
| Product, design and accessibility | Projects now have rename, copy, archive, restore and search, backed by migration 004. The editor offers rendered-revision playback and limited manual caption controls. | Exercise newer workflows interactively, including keyboard and assistive technology; folders, full preview and broader features remain. |
| Frontend and data safety | One-second autosave, safe stale-save/conflict handling and opt-in draft recovery address interrupted edits. Recovery is scoped to user/workspace/project, limited to 2 MiB and seven days. | Verify conflicts, expiry, account switching and recovery interactively; local browser storage is not a production backup. |
| Media, audio and captions | Bounded manual cues and styles use a trusted immutable DejaVu font asset with license route; real burn-in is exercised. Worker output capture is bounded and sample-aspect-ratio geometry is corrected. | Verify caption shaping and styles across languages, audio and playback in browsers; expand codec and fidelity testing. |
| Security and backend | Local authentication has bounded hashing admission and 429 responses. Migration checksums and serialized concurrent runners protect schema changes. Web framing headers reduce embedding exposure. | Production identity, authorization, distributed admission, secrets, object storage, isolated queue workers, security review and quotas remain. |
| QA, operations and release | CI includes documentation, contract, audio, caption, restricted packaged-worker and Compose HTTP checks alongside application tests, with disposable-volume cleanup. Current worker tests passed in restricted Debian; web tests and typecheck passed. | Obtain a hosted CI run, run browser/accessibility tests, restore and load drills, and resolve dependency-audit timeout. |

## Specific defects corrected

- **API and data consistency:** retries after a lost project-creation response preserve idempotency; stale or parallel saves no longer overwrite newer edits. Malformed JSON and manifests now produce client errors rather than server errors. Revision size is bounded and rational timebase comparisons use integer-safe arithmetic.
- **Media reliability:** null or malformed worker NDJSON and progress/cancel races are handled without unhandled-rejection crashes. Worker stdout and stderr are bounded to avoid output-flood disk exhaustion; source sample-aspect ratio is respected to avoid stretched geometry.
- **Dashboard accessibility and concurrency:** search/open races and newest-first pagination were corrected. Focus has a fallback when a card disappears, outlines no longer clip, dialogs scroll in short viewports, long names wrap, and grouped actions have descriptive labels.
- **Licensing and unsupported capabilities:** the trusted font's license notice is exposed and caption glyphs are bounded. This is not a legal clearance; full language shaping and font coverage remain open. AI providers, production identity and collaborative workflows remain pending.

Implementations and tests are in `apps/web/components/editor.tsx`, `apps/web/components/studio.tsx`, `apps/web/lib/recovery.ts`, `apps/api/src/auth-limits.ts`, `apps/api/src/migrate.ts`, `apps/api/src/project-lifecycle.ts`, `apps/api/src/media.ts`, `apps/api/migrations/004_project_archive.sql`, `workers/media/media_worker.py`, `workers/media/tests/`, and `.github/workflows/ci.yml`. References are evidence of implemented subsets, not proof of full family acceptance.

## Evidence and limitations

- Web unit tests passed 25/25 and typecheck passed. Restricted Debian worker tests passed 35/35; on the host with a test-only FFmpeg shim, 29 passed and six caption tests skipped because drawtext was unavailable.
- The latest API regression passed 7/7 with no skips, including real caption pixels, audio and three aspect formats, lifecycle and pagination, OpenAPI validation, malformed inputs, admission and worker recovery. Two concurrent migration runners succeeded and recorded four ledger rows. A fresh Compose stack HTTP smoke passed through the web rewrite: registration, workspace/project, upload, probe/thumbnail, font/license, caption persistence and render, download checksum and range, lifecycle actions and revoked-session access. This was not an interactive browser test. Independent FFprobe checked the downloaded caption render as H.264 1080×1080, 30 frames and one second, with 48 kHz stereo AAC for one second. The latest build and typecheck passed; the fresh standalone worker image passed all 35 bundled tests without a bind mount, with network disabled, a read-only root, noexec/nosuid 256 MiB `/tmp`, 2 CPUs and 2 GiB memory.
- Interactive automation was unavailable due to a computer-use startup error. The new browser workflows have not been verified interactively. npm audit timed out, so there is no clean advisory verdict.
- Earlier browser and container startup observations are described in [verification](testing-and-verification.md); they do not establish current production readiness or complete end-to-end coverage.

## Resume

1. Run hosted CI and npm audit with a reachable registry; preserve image digests, fixture hashes and logs.
2. Restore interactive browser access and verify upload, lifecycle actions, autosave/conflict/recovery, caption/audio editing, rendered playback and accessibility.
3. Replace local identity, filesystem and embedded supervisor with production-ready identity, private object storage and isolated durable workers. Test tenant isolation, abuse limits and restore procedures.
4. Expand and validate feature families against their acceptance criteria; AI, collaboration, professional editing and other documented capabilities remain unimplemented or partial.
