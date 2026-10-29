# Phased implementation plan

**Status:** proposed; no dates or delivery promises. **Owner:** technical program manager; product, engineering, design, security and QA approve each gate. **Dependencies:** critical path and acceptance catalog.

| Phase | Outcome and scope | Entry / gate and principal owners |
|---|---|---|
| 0 Discovery | License and source audit; threat model; browser/media spikes; architecture, schema, design tokens, benchmark plan and prioritized backlog | Product, legal, architecture, design and security approve decisions and test plan |
| 1 Foundation | Authentication, tenant/workspace, projects and durable revisions; resumable upload, object storage, inspect, proxy, basic editor, queue, isolated FFmpeg worker, verified sequence render/download and monitoring | Phase 0 decisions; QA demonstrates AT-01–AT-07, AT-12, core contract/round-trip tests and security isolation |
| 2 Guided creator | Seven-stage Quick Edit; clip management, audio mix/ducking/narration, transitions, provider consent/quota/privacy safeguards before speech integration, editable captions, timed layers/branding, cover, preview and portrait export | 1 durable render; editor and media leads verify mode preservation, audio/captions and export |
| 3 Advanced creator | Pro multitrack, silence/transcript edits, animated captions, beat snapping, audio/color, LUT, stabilization, speed ramps, B-roll, chroma key, motion graphics, templates, batch outputs and QC | 2 model/preview parity; validate interactions, measured effects and reliability |
| 4 Professional | Keyframes, masks/compositions, mixing and scopes, multicam/sync, HDR, advanced codecs, high resolution, interchange | 3 editing and worker capability matrix; media specialists approve conformance fixtures |
| 5 AI and collaboration | Semantic analysis, highlights, reframing/tracking, translation/dubbing, natural language plans with approval, review/comments, shared assets and publishing integrations | security, privacy and provider contracts; evaluate models and authorization, independent of subscription |
| 6 General availability | Capacity, security, recovery, cost, accessibility, supported browsers, legal/privacy, operational handover and staged launch | all release gates pass with measured evidence and accepted residual risks |

Security, accessibility, data protection and operations start in Phase 0 and are continuous; Phase 6 validates, not first introduces them. Collaboration primitives needed for project ownership and invitations start in Phase 1; advanced co-edit and review wait for Phase 5. Dependencies and tasks: [critical path](dependencies-critical-path-and-estimates.md), [backlog](epics-user-stories-and-tasks.md), [gates](phase-gates-and-definition-of-done.md).
