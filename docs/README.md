# Cloud video studio documentation

This documentation defines a browser-based studio, including guided and professional editing, a shared project model, and phased cloud delivery. The design documents describe the intended product; the [implementation checkpoint](11-implementation/README.md) records what has actually been built and verified.

Start with [product vision](01-product/product-vision-and-prd.md), [feature catalog](01-product/feature-catalog.md), [system context](07-architecture/system-context-and-c4-diagrams.md), [project model](03-frontend/canonical-editor-state-and-schema.md), [API](04-backend/api-design-and-contracts.md), and [phased plan](09-delivery/phased-implementation-plan.md). Review [audit and gaps](10-audit/documentation-quality-audit.md) before using this as a build contract.

Phases 0–6 progress from discovery and validation through platform foundation, guided editing, advanced creator tools, professional tools, AI/collaboration, and launch hardening. Dates and targets are proposals.

The [review report](10-audit/review-findings-and-fixes.md) records the cross-document defects corrected and the validation evidence. Machine-readable v1 schemas cover a bounded core; advanced features require explicit contract extensions.


## 00-governance

- [Assumptions and open decisions](00-governance/assumptions-and-open-decisions.md)
- [Capability classification](00-governance/baseline-vs-proposed-capabilities.md)
- [Documentation standards](00-governance/documentation-standards.md)
- [Glossary](00-governance/glossary.md)
- [Licensing and dependencies](00-governance/licensing-and-dependencies.md)
- [Ownership and RACI](00-governance/ownership-and-raci.md)
- [Requirements traceability](00-governance/requirements-traceability.md)
- [Source audit and provenance](00-governance/source-audit-and-provenance.md)

## 01-product

- [Business model and quotas](01-product/business-model-and-quotas.md)
- [Canonical feature catalog](01-product/feature-catalog.md)
- [Functional requirements](01-product/functional-requirements.md)
- [Non-functional requirements](01-product/non-functional-requirements.md)
- [Personas and jobs to be done](01-product/personas-and-jobs-to-be-done.md)
- [Product vision and requirements](01-product/product-vision-and-prd.md)
- [Release scopes and roadmap](01-product/release-scopes-and-roadmap.md)
- [Success metrics and analytics](01-product/success-metrics-and-analytics.md)
- [User journeys and workflows](01-product/user-journeys-and-workflows.md)
- [User roles and permissions](01-product/user-roles-and-permissions.md)

## 02-ux-ui

- [Accessibility](02-ux-ui/accessibility.md)
- [Captions, graphics and thumbnail experience](02-ux-ui/captions-graphics-and-thumbnail-experience.md)
- [Component library and states](02-ux-ui/component-library-and-states.md)
- [Design system and tokens](02-ux-ui/design-system-and-tokens.md)
- [Keyboard shortcuts and gestures](02-ux-ui/keyboard-shortcuts-and-gestures.md)
- [Localization and RTL](02-ux-ui/localization-and-rtl.md)
- [Navigation and screen inventory](02-ux-ui/navigation-and-screen-inventory.md)
- [Pro editor and timeline interactions](02-ux-ui/pro-editor-and-timeline-interactions.md)
- [Quick Edit experience](02-ux-ui/quick-edit-experience.md)
- [Responsive and mobile experience](02-ux-ui/responsive-and-mobile-experience.md)
- [Screen specifications](02-ux-ui/screen-by-screen-specifications.md)
- [UX strategy and information architecture](02-ux-ui/ux-strategy-and-information-architecture.md)

## 03-frontend

- [Browser preview engine](03-frontend/browser-preview-engine.md)
- [Canonical editor state and schema](03-frontend/canonical-editor-state-and-schema.md)
- [Editor canvas and interactions](03-frontend/editor-canvas-and-interactions.md)
- [examples/project-v1.json](03-frontend/examples/project-v1.json)
- [examples/render-snapshot.json](03-frontend/examples/render-snapshot.json)
- [Frontend architecture](03-frontend/frontend-architecture.md)
- [Frontend performance and testing](03-frontend/frontend-performance-and-testing.md)
- [Media upload and asset client](03-frontend/media-upload-and-asset-client.md)
- [Routing and application shell](03-frontend/routing-and-application-shell.md)
- [schemas/project-v1.schema.json](03-frontend/schemas/project-v1.schema.json)
- [schemas/render-snapshot.schema.json](03-frontend/schemas/render-snapshot.schema.json)
- [State, autosave and undo](03-frontend/state-management-autosave-and-undo.md)
- [Timeline model and editing commands](03-frontend/timeline-model-and-editing-commands.md)

## 04-backend

- [API design and contracts](04-backend/api-design-and-contracts.md)
- [Authentication, authorization and tenancy](04-backend/authentication-authorization-and-tenancy.md)
- [Backend architecture](04-backend/backend-architecture.md)
- [Billing, quotas and usage metering](04-backend/billing-quotas-and-usage-metering.md)
- [Collaboration and sharing](04-backend/collaboration-and-sharing.md)
- [Database design](04-backend/database-design.md)
- [Domain model and relationships](04-backend/domain-model-and-erd.md)
- [Job queues, workers and render orchestration](04-backend/job-queues-workers-and-render-orchestration.md)
- [Media storage and lifecycle](04-backend/media-storage-and-lifecycle.md)
- [openapi.yaml](04-backend/openapi.yaml)
- [Realtime events, notifications and webhooks](04-backend/realtime-events-notifications-and-webhooks.md)
- [Upload, ingestion and processing](04-backend/upload-ingestion-and-processing.md)

## 05-media-processing

- [Audio processing and mastering](05-media-processing/audio-processing-and-mastering.md)
- [Captions, graphics and compositing](05-media-processing/captions-graphics-and-compositing.md)
- [Color, HDR and reframing](05-media-processing/color-hdr-and-reframing.md)
- [Encoding, export and delivery presets](05-media-processing/encoding-export-and-delivery-presets.md)
- [42-tool toolkit audit](05-media-processing/ffmpeg-skill-42-tool-audit.md)
- [Filtergraphs and composition semantics](05-media-processing/filtergraphs-and-composition-semantics.md)
- [Ingestion and compatibility](05-media-processing/media-ingestion-and-compatibility.md)
- [Media verification and quality control](05-media-processing/media-verification-and-quality-control.md)
- [Multicam sync and specialized media](05-media-processing/multicam-sync-and-specialized-media.md)
- [Proxies, previews and caching](05-media-processing/proxies-previews-and-caching.md)
- [Render compiler and execution graph](05-media-processing/render-compiler-and-execution-graph.md)
- [Tool-to-feature mapping](05-media-processing/tool-to-product-feature-matrix.md)
- [Trimming, transitions, speed and effects](05-media-processing/trimming-transitions-speed-and-effects.md)

## 06-ai

- [AI architecture and provider abstraction](06-ai/ai-architecture-and-provider-abstraction.md)
- [AI evaluation, privacy and costs](06-ai/ai-evaluation-privacy-and-costs.md)
- [Highlights, reframing and computer vision](06-ai/highlights-reframing-and-computer-vision.md)
- [Natural-language editing assistant](06-ai/natural-language-editing-assistant.md)
- [Transcription, diarization and transcript editing](06-ai/transcription-diarization-and-transcript-editing.md)
- [TTS, translation and dubbing](06-ai/tts-translation-and-dubbing.md)

## 07-architecture

- [ADR-001: Cloud rendering](07-architecture/decisions/ADR-001-rendering-strategy.md)
- [ADR-002: Project model and timebase](07-architecture/decisions/ADR-002-project-schema-and-timebase.md)
- [ADR-003: Preview fidelity](07-architecture/decisions/ADR-003-preview-render-parity.md)
- [ADR-004: Tenant isolation](07-architecture/decisions/ADR-004-multi-tenant-isolation.md)
- [ADR-005: Durable jobs and storage](07-architecture/decisions/ADR-005-jobs-and-object-storage.md)
- [ADR-006: AI provider abstraction](07-architecture/decisions/ADR-006-ai-provider-abstraction.md)
- [Deployment architecture](07-architecture/deployment-architecture.md)
- [Privacy, retention and data governance](07-architecture/privacy-retention-and-data-governance.md)
- [Scalability, reliability and performance](07-architecture/scalability-reliability-and-performance.md)
- [Threat model and sandboxing](07-architecture/security-threat-model-and-sandboxing.md)
- [Service boundaries and data flows](07-architecture/service-boundaries-and-data-flows.md)
- [System context and containers](07-architecture/system-context-and-c4-diagrams.md)

## 08-engineering

- [API contract and integration testing](08-engineering/api-contract-and-integration-testing.md)
- [Backups, disaster recovery and restoration](08-engineering/backups-disaster-recovery-and-restoration.md)
- [Capacity, cost and performance budgets](08-engineering/capacity-cost-and-performance-budgets.md)
- [CI/CD, release and feature flags](08-engineering/ci-cd-release-and-feature-flags.md)
- [Engineering standards and repository structure](08-engineering/engineering-standards-and-repository-structure.md)
- [Environments, configuration and secrets](08-engineering/environments-configuration-and-secrets.md)
- [Observability, SLOs and alerting](08-engineering/observability-slos-and-alerting.md)
- [Operations runbooks and incidents](08-engineering/operations-runbooks-and-incidents.md)
- [Testing strategy and fixtures](08-engineering/testing-strategy-and-fixtures.md)

## 09-delivery

- [Acceptance test catalog](09-delivery/acceptance-test-catalog.md)
- [Dependencies, critical path and estimates](09-delivery/dependencies-critical-path-and-estimates.md)
- [Epics, user stories and implementation tasks](09-delivery/epics-user-stories-and-tasks.md)
- [Launch checklist and rollout](09-delivery/launch-checklist-and-rollout.md)
- [Maintenance and evolution](09-delivery/maintenance-and-evolution.md)
- [Phase gates and definition of done](09-delivery/phase-gates-and-definition-of-done.md)
- [Phased implementation plan](09-delivery/phased-implementation-plan.md)

## 10-audit

- [Documentation quality and completeness audit](10-audit/documentation-quality-audit.md)
- [Requirements coverage report](10-audit/requirements-coverage-report.md)
- [Documentation review findings and fixes](10-audit/review-findings-and-fixes.md)
- [Unresolved risks and research gaps](10-audit/unresolved-risks-and-research-gaps.md)
- [validate-contracts.cjs](10-audit/validate-contracts.cjs)
- [validate_documentation.py](10-audit/validate_documentation.py)

## 11-implementation

- [Implementation checkpoint](11-implementation/README.md)
- [Architecture deviations](11-implementation/architecture-deviations.md)
- [Feature coverage matrix](11-implementation/feature-coverage-matrix.md)
- [Implementation status](11-implementation/implementation-status.md)
- [Integration status](11-implementation/integration-status.md)
- [Known issues](11-implementation/known-issues.md)
- [Phase progress](11-implementation/phase-progress.md)
- [Release readiness](11-implementation/release-readiness.md)
- [Testing and verification](11-implementation/testing-and-verification.md)
- [Project review and feature completion](11-implementation/review-and-completion.md)
