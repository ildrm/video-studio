# Release scopes and roadmap

**Status:** Proposed sequence, no committed dates. **Owner:** Program manager. **Dependencies:** [catalog](feature-catalog.md); security, legal, performance and accessibility gates apply to every release.

| Phase | Scope and deliverable | Exit evidence |
|---|---|---|
| 0 | Discovery, licensing, compatibility, architecture, threat model, schema and benchmarks | Decisions approved, unknowns assigned; no launch claim |
| 1 | Identity, workspace, project, upload, proxy, basic editor, queue, isolated render and download | Independent user completes end-to-end verified export; tenant-negative tests pass |
| 2 | Guided seven-stage editing, audio, narration, transcription, captions, overlays, branding, thumbnail and portrait exports | Guided acceptance journeys and accessible recovery pass |
| 3 | Multitrack creator tools, transcript edits, color, effects, templates, batch and QC | Compatibility, parity and cost test evidence |
| 4 | Keyframes, masking, advanced audio/color, multicam, HDR, interchange | Tested media/build matrix and professional review |
| 5 | Advanced AI, collaboration, approvals and publishing integrations | Human-review, privacy, security and concurrency gates |
| 6 | Scale, incident recovery, accessibility, security, privacy, operations and general availability | Restore drill, load evidence, legal and launch sign-offs |

Basic security, monitoring, accessibility and data recovery are prerequisites from phase 1, not postponed to phase 6. Phase 2 may use an external speech provider as a bounded integration; broader AI is phase 5. Advanced capabilities remain disabled until dependencies and runtime support are verified. Cross-phase tasks can overlap after their contract dependencies; final phase gates are objective checks rather than dates.
