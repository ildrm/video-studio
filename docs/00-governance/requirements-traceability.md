# Requirements traceability

Status: partial • Owner: product and QA leads. The [feature catalog](../01-product/feature-catalog.md) is the authoritative feature ID register. The [acceptance catalog](../09-delivery/acceptance-test-catalog.md) and [tasks](../09-delivery/epics-user-stories-and-tasks.md) connect major work streams to proposed tests; the [delivery matrix](../09-delivery/epics-user-stories-and-tasks.md#feature-family-traceability) maps all 33 families to tasks and acceptance scenarios. Offline checks verify those references and task dependencies; per-capability fields and executable tests remain required.

| Capability | Product and UX | Architecture | Verification |
|---|---|---|---|
| Project edits and modes | [Quick Edit](../02-ux-ui/quick-edit-experience.md), [Pro](../02-ux-ui/pro-editor-and-timeline-interactions.md) | [state](../03-frontend/canonical-editor-state-and-schema.md) | Save/conflict and mode round-trip in acceptance catalog |
| Upload and assets | [journeys](../01-product/user-journeys-and-workflows.md) | [ingestion](../04-backend/upload-ingestion-and-processing.md) | Resume, invalid file and isolation |
| Render | [catalog](../01-product/feature-catalog.md) | [jobs](../04-backend/job-queues-workers-and-render-orchestration.md), [compiler](../05-media-processing/render-compiler-and-execution-graph.md) | Snapshot, failure and QC |
| AI | [catalog](../01-product/feature-catalog.md) | [AI](../06-ai/ai-architecture-and-provider-abstraction.md) | Consent, human approval and rollback |
| Access | [roles](../01-product/user-roles-and-permissions.md) | [tenancy](../04-backend/authentication-authorization-and-tenancy.md) | Actor/scope/action negative matrix |

A family-level mapping is not proof of individual feature coverage. Complete feature IDs → workflow → component → task → acceptance case links and check for orphans before declaring this gate passed.
