# Phase progress

Status: **IN_PROGRESS** • Owner: delivery lead • Last reviewed: 2026-10-29. Phase numbers and gates come from the [delivery plan](../09-delivery/phased-implementation-plan.md). Partial activities in a phase do not mean its gate passed.

| Phase | State | Current evidence | Exit work still required |
|---|---|---|---|
| 0 Discovery | IN_PROGRESS | Shared schema/timebase, API contract, documentation checks, FFmpeg and browser spikes. | Legal and codec review, approved production identity/storage/sandbox design, supported-device matrix and reproducible benchmarks. |
| 1 Foundation | IN_PROGRESS | Local accounts, owner workspace, project revisions, chunked upload API, ingest and local worker/render/download; current worker tests passed 35/35 in a restricted Debian container; the host passed 29 with six caption skips and a test-only shim. | Browser upload/recovery evidence, real production identity/storage/queue, proxy/waveform, tenant role model, quotas, reliable isolation, operations and complete acceptance gates. |
| 2 Guided creator | IN_PROGRESS | Basic clips, trim/split/reorder, source audio, one dissolve and bounded manual captions; portrait/landscape/square H.264/AAC presets. | Complete seven stages; transcription, broader captions, narration, overlays, branding, thumbnail design, live composition preview, accessibility and end-to-end tests. |
| 3 Advanced creator | IN_PROGRESS | An API integration test exercised audio ingestion and a real audio mix; limited background-audio controls exist but the browser workflow is unverified. | Multitrack editor, effects, transcript/silence workflows, color, batch, templates, fidelity and quality-control evidence. |
| 4 Professional | NOT_STARTED | No full professional workflow. | Advanced composition, audio, color, HDR, multicam, interchange, codecs and specialist validation. |
| 5 AI/collaboration | NOT_STARTED | No AI provider or collaborative editing integration. | Policy/consent, provider interfaces, evaluations, secure review, sharing, approvals and publishing. |
| 6 General availability | NOT_STARTED | Basic development health and CI configuration exist. | Security/accessibility review, load/capacity and cost evidence, tested restore, legal/privacy sign-off, observability and deployment/rollback validation. |

Security, privacy, accessibility and backups are not deferred until phase 6; each implemented slice needs them. No phase or release gate is marked complete.
