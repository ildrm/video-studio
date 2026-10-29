# Product vision and requirements

**Status:** Proposed; not implemented. **Owner:** Product lead. **Scope:** Browser-based creation through verified cloud export. **Dependencies:** [feature catalog](feature-catalog.md), [permissions](user-roles-and-permissions.md), [roadmap](release-scopes-and-roadmap.md).

The studio lets a creator assemble source media, review and refine a non-destructive composition, and export a verified artifact without installing local processing software. Quick Edit guides beginners through Clips, Audio, Captions, Overlays, Branding, Thumbnail and Export; Pro exposes tracks and detailed controls. Both operate on one canonical project. Mode switching is a view change, never a destructive conversion: inaccessible Pro content remains in the model and Quick displays a clear advanced-content notice. It must never silently simplify that content.

## Outcomes and boundaries

Phase 1 proves upload, persistence, edit, cloud render and download. Phase 2 adds the complete guided workflow. Later phases add advanced creator tools, professional media capabilities, collaboration and AI. These phases are proposals, not delivery commitments. Exports are immutable snapshots of a saved revision; edits during rendering apply to a later revision. A missing asset blocks dependent operations, identifies the affected clips, and supports relinking with validation. Final exports use isolated cloud FFmpeg workers. Browser preview is a convenience and may be approximate; disclose effects requiring a server preview.

## Product requirements

1. A user can create a workspace and project, upload authorized media, edit, save, render and download (PLT-001, PRJ-001, MED-001, EDT-001, EXP-001).
2. Each edit is non-destructive and remains after mode changes and reload (PRJ-002, EDT-002).
3. The user sees progress and actionable errors, can recover an interrupted upload or render, and never receives another tenant's data (MED-001, EXP-001, SEC-001).
4. Generated transcripts and edits are drafts; the user reviews and approves them. Provider failure must not mutate the project (CAP-001, AIF-001).
5. Every applicable action has keyboard access, text labels, focus feedback, announced asynchronous status and an accessible error path.

## Acceptance and risks

A fresh account can complete the phase-1 flow, reopen its exact saved revision and download a verified render. Changes made while a job runs do not change its output. A user denied access cannot read assets, jobs, or signed URLs. Codec support, budgets and measured performance remain open until the compatibility and benchmark gates. All referenced targets are proposals, not measured results. [Journeys](user-journeys-and-workflows.md) and [success metrics](success-metrics-and-analytics.md) define evidence.
