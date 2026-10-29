# Epics, user stories and implementation tasks

**Status:** proposed backlog, no implementation claimed. **Owner:** technical program manager. **Inputs:** product requirements, architecture decisions and [phase plan](phased-implementation-plan.md). Task IDs are stable within this document. Phase numbers and effort bands are planning labels, not dates. Acceptance test IDs resolve to [catalog](acceptance-test-catalog.md); add feature-specific assertions as designs mature. All tasks inherit the universal [definition of done](phase-gates-and-definition-of-done.md), including review, security, accessibility, monitoring, documentation and evidence.

## Epic stories

- E0: As a delivery team, we need verified legal, media, browser and threat evidence so architecture can be chosen safely.
- E1: As a creator, I can securely upload media, save a project, render a snapshot and download it online.
- E2: As a beginner, I can use seven guided stages to make a short without losing advanced project data.
- E3: As an experienced creator, I can edit multiple tracks and finish advanced video/audio with verifiable output.
- E4: As a professional, I can use advanced composition, sync, color and delivery with clear capability limits.
- E5: As a team, we can review projects and use consented AI suggestions while retaining control of edits and costs.
- E6: As an operator and customer, I can rely on measurable service quality, recovery and an accessible supported experience.

## Task contract

Each row defines task, phase, owner, relative priority, dependencies, required input, implementation steps/deliverable, verification and risk. `P0` blocks its phase gate, `P1` is important within the phase; `S/M/L/XL` are relative effort bands. The acceptance test defines completion in addition to the common DoD; research tasks require recorded evidence and a decision, not a claim of tested production behavior. Product/design, infrastructure, security, QA and documentation responsibilities are listed as tasks rather than implied handoffs.

| ID / title | Phase; owner; priority; effort | Dependencies and required inputs | Steps and technical deliverable | Verification / acceptance | Risk |
|---|---|---|---|---|---|
| T00-01 Legal and dependency review | 0; legal lead; P0; M | source inventory and licenses | assess build/linking, fonts and providers; publish obligations and unresolved sign-offs | legal review documented; no unauthorized reuse | terms and patent uncertainty |
| T00-02 Product research and scope | 0; product manager; P0; M | personas and proposed catalog | interview representative users; prioritize jobs, workflows, launch scope and metrics | design and product sign off evidence-backed scope | unvalidated assumptions |
| T00-03 Schema and time spike | 0; architect; P0; L | timeline requirements, mixed-fps fixtures | define versioned shared schema, 240000 ticks/sec, rational fps and half-open spans; prototype round-trip | AT-04, AT-08, AT-21 and migration tests; decision recorded | fractional fps rounding and VFR mapping |
| T00-04 Media/browser feasibility | 0; media lead; P0; L | licensed codec fixtures and candidate worker images | probe decode, encoding, preview parity and hardware support on intended platforms; record capabilities | repeatable matrix and proposed thresholds, not guessed support | build-dependent codec coverage |
| T00-05 Threat model and design system | 0; security lead and designer; P0; M | data flows and personas | review tenant, media and AI threats; define tokens, navigation and accessibility test plan | cross-functional signoff and tracked mitigation owners | security or UX gaps deferred |
| T01-01 Identity and workspace | 1; backend lead; P0; L | T00-05; permission model | implement authentication, sessions, memberships and policy checks; audit changes | AT-01, AT-25 plus expiry, revocation and role denial tests | tenant escape |
| T01-02 Storage and multipart transfer | 1; platform engineer; P0; L | T00-04, T01-08; storage lifecycle | build multipart sessions, scoped staging storage, checksum/part reconciliation and completion handoff | AT-02 transfer/resume and checksum limits | storage abuse or malformed input |
| T01-03 Persistence and revisions | 1; backend lead; P0; L | T00-03; database and migration contracts | create project, immutable revisions, optimistic save, autosave recovery and tenant indices | AT-03, AT-23 plus restoration of acknowledged revisions | lost updates |
| T01-04 Basic editor shell | 1; frontend lead; P0; L | T00-03, T01-09, T01-03 | build accessible shell, media picker, simple sequence controls and upload progress | AT-04 and AT-12 with end-to-end journey | browser preview limitations |
| T01-05 Queue and isolated worker | 1; platform lead; P0; XL | T01-02, T01-03; job state contract | implement leases, retries, fairness, sandbox, heartbeat and cancellation; publish durable transitions | AT-06, AT-07, AT-24 including crash injection | duplicate execution and resource exhaustion |
| T01-06 Render and download | 1; media lead; P0; XL | T00-04, T01-05, T01-09; compiler specification | compile typed snapshot to allowlisted plan, encode, verify, publish and issue scoped download | AT-05, AT-18, AT-22 with golden fixtures | injection and corrupt output |
| T01-07 Infrastructure observability | 1; SRE; P0; M | T01-05; operational SLOs | deploy isolated environments, dashboards, logging, alerts and runbooks | simulate worker failure, verify alert and recovery | unknown scale and alert noise |
| T01-08 Quotas and admin controls | 1; backend lead; P0; L | T01-01, quota policy | Implement atomic scoped admission, metering, billing-role separation and administrative audit. | AT-17 and AT-19. | Metering races and cost leakage. |
| T01-09 Ingestion and derivatives | 1; media lead; P0; L | T01-02, T01-05; compatibility policy | Validate uploaded bytes in sandbox, register immutable version and generate proxy, thumbnail and waveform through durable jobs. | AT-02, AT-09, AT-24; malformed inputs fail within limits. | Decoder attack or derivative mismatch. |
| T02-01 Guided UX | 2; product designer; P0; L | T01-04 and seven-stage workflows | design clips, audio, captions, overlays, branding, cover and export with recoverable errors | usability sessions and AT-08/AT-12 | hidden advanced edits |
| T02-02 Clip and transition edits | 2; frontend/media leads; P0; L | T01-06; timing model | implement trim/split/reorder and transition bounds through shared commands and compiler | AT-04, AT-08 and transition golden comparisons | timing boundary mismatch |
| T02-03 Audio and narration | 2; audio lead; P0; L | T01-06, T02-07; gain and provider contracts | add source, narration and music gain, fades, looping, ducking and pluggable speech generation | AT-10 and provider failure/consent tests | drift, clipped audio or costs |
| T02-04 Captions and layers | 2; frontend/media leads; P0; L | T02-02, T02-07; text shaping requirements | edit imported/generated cues and timed text/image overlays, watermark and styles; render from canonical model | AT-11, timing and safe-area visual checks | font and bidirectional shaping |
| T02-05 Cover and export | 2; designer/media lead; P0; M | T01-06 and T02-04 | serialize thumbnail composition, render PNG and versioned portrait presets | compare cover/output and reject unsupported settings | preview parity |
| T02-06 Project packages and notifications | 2; backend/frontend leads; P1; L | T01-03 and job events | Implement template creation, validated versioned package import/export, relink and deduplicated notifications. | AT-03, AT-20 and notification delivery tests. | Missing assets or schema migration. |
| T02-07 Speech provider safeguards | 2; AI/security leads; P0; L | T01-01, T01-05, T01-08; consent and region policy | Implement provider abstraction, model/voice capabilities, data transfer consent, quota/cost, idempotency and sanitized failure before speech dispatch. | AT-13, AT-22, AT-26; provider errors never mutate project. | Unauthorized transfer or duplicate charges. |
| T03-01 Pro timeline | 3; frontend lead; P0; XL | T02-02; editing commands | implement tracks, snapping, trims, grouping, inspector; keyframe schema preservation with advanced keyframe UI in phase 4; preserve unsupported Quick data | AT-04, AT-08, keyboard and undo property tests | large project performance |
| T03-02 Creator media effects | 3; media lead; P0; XL | T03-01; capability matrix | implement audio enhancement, color/LUT, stabilization, speed, chroma and compositing in bounded typed operations | golden media, AT-09/10/18 and declared preview differences | resource and fidelity variance |
| T03-03 Batch, templates and QC | 3; backend/media lead; P1; L | T01-05, T01-06 | add versioned templates, batch jobs, delivery presets and QC reports with quotas | failure isolation and each artifact independently verified | batch resource exhaustion |
| T03-04 Transcript and silence editing | 3; AI/media lead; P1; L | T02-04 and provider controls | generate reviewable timed transcript/silence suggestions, translate selection to reversible edits | timing tests, explicit review and rollback | inaccurate recognition |
| T03-05 Caption styles and languages | 3; accessibility/media leads; P1; L | T02-04 and font policy | Add animation, karaoke, safe-area styles and language tracks with editable timing and declared preview fidelity. | AT-11 plus visual and cue-timing fixtures. | Unsupported shaping or font rights. |
| T04-01 Professional composition | 4; media lead; P0; XL | T03-01, T03-02 | build keyframes, masks, nested composition and professional audio controls using typed plan operations | render golden and frame boundary tests plus manual visual review | complex graph blowup |
| T04-02 Sync and multicam | 4; media engineer; P1; L | T03-02; licensed sync fixtures | design align/drift correction and angle switching with manual override | compare synchronization offsets across fixture durations | false alignment |
| T04-03 HDR and codec formats | 4; color specialist; P0; L | T00-04, T03-02; legal approval | detect source color metadata, implement explicit SDR/HDR transforms and capability-gated codecs | AT-09 plus metadata and visual color checks | hardware and license variability |
| T05-01 Collaboration and sharing | 5; backend lead; P0; XL | T01-01, T01-03; authorization contract | implement share expiry, reviewer comments, approval and conflict behavior; audit role changes | AT-01, AT-03 and AT-14 across role combinations | leaked sharing links and edit conflicts |
| T05-02 Advanced AI evaluation and governance | 5; AI lead; P0; L | T02-07; semantic AI privacy review | extend existing provider interface with model evaluation, semantic capability registry, confidence and rollback policy | provider failures, AT-13 and evaluation slices | provider privacy or cost change |
| T05-03 AI editing assistant | 5; AI lead; P1; XL | T05-02; typed editing command schema | produce costed inspectable plan, validate permissions and operations, approve, apply to revision, enable undo | AT-13 including prompt injection and unauthorized assets | untrusted input and incorrect output |
| T05-04 Publishing integrations | 5; integration lead; P1; L | T05-01 and credential policy | implement individually authorized integration adapters, expiry, retry and revocation | mock provider failures, credential isolation and user-confirmed publish | third-party policy changes |
| T06-01 Performance and capacity | 6; SRE; P0; L | T03-03; benchmark fixtures | exercise concurrency, queue fairness, cost and failure injection; set real capacity thresholds | AT-17 and measured reports against approved SLOs | unrepresentative load |
| T06-02 Security and accessibility audit | 6; security and accessibility leads; P0; L | all in-scope features | independently assess tenant isolation, sandbox, permissions, keyboard, assistive technology and RTL; resolve blockers | AT-01, AT-12, AT-13 and AT-14 and review signoff | unknown severe findings |
| T06-03 Disaster recovery exercise | 6; SRE; P0; M | backup plan and T01-07 | restore metadata and originals to isolated environment, reconcile jobs and measure actual RPO/RTO | AT-15 with recorded evidence | unrestorable assets or keys |
| T06-04 Release readiness | 6; release manager; P0; M | T06-01, T06-02, T06-03; legal and support signoff | execute staging, canary, rollback, documentation and support handover | AT-16 and launch gate record | incomplete rollback or staffing |


## Execution and traceability

The table below maps each current feature-family ID to delivery tasks and acceptance cases. Before implementation, each task owner must link exact subfeature requirements, design/API contracts, issue, evidence and dependency status; family-level mapping is not complete subfeature traceability. Where an acceptance ID covers a broader area, the task's implementation ticket must specify measurable fixture expectations and pass/fail tolerance. The architecture dependencies are the shared [system architecture](../07-architecture/system-context-and-c4-diagrams.md), [schema and timebase decision](../07-architecture/decisions/ADR-002-project-schema-and-timebase.md), [security architecture](../07-architecture/security-threat-model-and-sandboxing.md), [job orchestration](../04-backend/job-queues-workers-and-render-orchestration.md) and [render compiler](../05-media-processing/render-compiler-and-execution-graph.md). The test lead expands each mapping into executable, feature-specific tests before phase approval; broad scenario references alone do not establish complete subfeature traceability.

## Feature-family traceability

| Catalog ID | Tasks | Acceptance cases |
|---|---|---|
| PLT-001 | T01-01 | AT-01, AT-14 |
| PLT-002 | T01-01 | AT-01, AT-14 |
| PLT-003 | T02-06 | AT-20 |
| PRJ-001 | T01-03 | AT-01, AT-03 |
| PRJ-002 | T01-03 | AT-03, AT-15 |
| PRJ-003 | T02-06 | AT-20 |
| MED-001 | T01-02 | AT-02 |
| MED-002 | T01-09 | AT-02, AT-09 |
| MED-003 | T03-02 | AT-09 |
| EDT-001 | T01-04, T02-02 | AT-04, AT-08 |
| EDT-002 | T03-01 | AT-04, AT-08 |
| EDT-003 | T03-02 | AT-04, AT-09 |
| EDT-004 | T02-02, T03-02 | AT-04, AT-18 |
| EDT-005 | T04-01 | AT-04, AT-08 |
| EDT-006 | T04-02 | AT-09 |
| AUD-001 | T02-03 | AT-10 |
| AUD-002 | T03-02, T03-04 | AT-10 |
| AUD-003 | T02-03, T02-07 | AT-10, AT-13 |
| CAP-001 | T02-04, T02-07 | AT-11 |
| CAP-002 | T02-04, T03-05 | AT-11 |
| GFX-001 | T02-04, T03-02 | AT-04, AT-18 |
| GFX-002 | T02-04 | AT-01, AT-18 |
| THM-001 | T02-05 | AT-18, AT-20 |
| CLR-001 | T03-02, T04-03 | AT-09, AT-18 |
| AIF-001 | T05-03 | AT-13 |
| AIF-002 | T02-07, T05-02 | AT-13 |
| EXP-001 | T01-06 | AT-05, AT-07, AT-18 |
| EXP-002 | T03-03, T04-03 | AT-09, AT-18 |
| COL-001 | T05-01 | AT-01, AT-14 |
| COL-002 | T05-01, T05-04 | AT-14 |
| ADM-001 | T01-08 | AT-17, AT-19 |
| SEC-001 | T01-01, T01-05 | AT-01, AT-06 |
| OPS-001 | T01-07, T06-03 | AT-06, AT-15 |
