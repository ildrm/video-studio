# Testing and verification

Status: **partial evidence** • Owner: QA lead • Recorded: 2026-10-29. Counts below are reports from the implementation agents for the specific runs; code is uncommitted and was still changing, so repeat them before treating this checkpoint as current release evidence.

| Check | Recorded result | Scope and caveat |
|---|---|---|
| Browser flow | Passed subset | Account/workspace/project creation; API-seeded video added; trim/split, save, render, download availability and crossfade exercised. Actual browser file-picker upload not yet verified. |
| Session recovery | Passed subset | Same-user reauthentication in place retained unsaved edits. More network failure, keyboard and cross-account cases remain. |
| API integration | 7/7 passed, no skips | Latest build and test compilation against disposable PostgreSQL; real caption pixels, audible audio mix and three aspect formats, lifecycle and newest-page pagination, OpenAPI, malformed inputs, rate limiting and worker protocol/cancellation/crash recovery. Concurrent migration runners both succeeded with four ledger rows. |
| Media worker | 35/35 passed in restricted Debian | Host FFmpeg 8 with a test-only shim passed 29 tests; six caption tests skipped because drawtext was unavailable. Restricted-container tests do not verify production scheduling or the embedded supervisor's isolation. |
| Web unit tests | 25/25 passed | Current reported unit run and typecheck passed; new interactive workflows remain unverified. |
| Build and typecheck | Passed | Latest API and web build and typecheck passed after dashboard accessibility changes. |
| Docker | PARTIAL | Latest `npm run test:stack` passed through Compose web port 3001: synthetic registration, workspace/project, upload/probe/thumbnail, font/license installation, caption persistence/render, checksum and range download, rename/copy/archive/restore/search, and revoked-session 401. Independent FFprobe checked the downloaded 9,750-byte caption render as H.264 1080×1080, 30 frames and one second, with 48 kHz stereo AAC for one second. This is an HTTP test, not interactive browser verification. The fresh standalone worker image with DejaVu fonts passed all 35 bundled tests without a bind mount, with network disabled, a read-only root, noexec/nosuid 256 MiB `/tmp`, 2 CPUs and 2 GiB memory. |
| CI | NOT VERIFIED | Workflow includes restricted packaged-worker and Compose HTTP tests with disposable-volume cleanup; no GitHub-hosted run is claimed. |

## Reproduction commands

Use an isolated database and licensed synthetic fixtures; never point integration tests at customer data. Configure Node/npm, Python and working FFmpeg/FFprobe, `DATABASE_URL`, `TEST_DATABASE_URL`, and any fixture/worker paths as described by the root setup (`README.md`), API (`apps/api/README.md`), and worker (`workers/media/README.md`). Then run:

```sh
npm ci
npm run typecheck
npm run build
npm run test --workspace @studio/web
npm run test:compile --workspace @studio/api
npm run migrate --workspace @studio/api
npm run test --workspace @studio/api
python3 -m unittest discover -s workers/media/tests -v
```

Set `TEST_DATABASE_URL` for API tests and `TEST_MEDIA_FIXTURE` for the real-video case; set `TEST_AUDIO_FIXTURE` for the optional audio ingestion subcase. A skipped test is not a pass. FFmpeg-dependent worker tests explicitly skip when tools cannot start; check test counts and skip output. The test-only shim is not a deployment fix. Interactive browser automation is currently unavailable due to a computer-use startup error; newer workflows have not been interactively verified. npm audit timed out and provides no clean advisory verdict. The browser, provider, security, accessibility, load, long-duration/VFR parity, CI and disaster-recovery plans have not been comprehensively run. Record fixture hashes, versions, environment, failures and logs when rerunning.
