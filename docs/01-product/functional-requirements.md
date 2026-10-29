# Functional requirements

**Status:** Proposed. **Owner:** Product lead. **Related:** [feature catalog](feature-catalog.md), [journeys](user-journeys-and-workflows.md). Feature IDs are the canonical requirement IDs here; each row in the catalog defines a testable capability and phase.

## Core behavior

- PLT-001: Identity and workspace access require authenticated, scoped sessions; sign-out invalidates the server session.
- PRJ-001: Create, rename, archive, restore, duplicate and open owned projects; inaccessible projects must not be enumerated.
- PRJ-002: Save a versioned project with optimistic revision checking, undo/redo, checkpoints and conflict recovery; never silently overwrite concurrent changes.
- MED-001: Create an upload session with declared size/type/checksum; transfer bounded chunks, retry idempotently, resume missing parts, cancel and finalize only after server verification. Show progress and safe failures. Limits are configurable by plan and deployment. Reject or quarantine unsupported or malformed media.
- MED-002: Inspect media asynchronously, preserve original, create compatible proxies/thumbnails/waveforms, and show metadata and processing states. Missing media shows affected edits and a relink flow.
- EDT-001: Quick creates, trims, splits, reorders and removes clips; source remains unmodified. EDT-002: Pro uses tracks, snapping and frame-accurate trim commands with atomic undo.
- EXP-001: Render a saved immutable revision after authorization, quota reservation and validation; return progress, cancellation, safe failure/retry and a time-limited authorized download. Successful output passes technical verification.
- CAP-001: Transcription is asynchronous; the user reviews editable word/cue timings. SRT/VTT import/export validates timestamps; burned captions and selectable tracks are explicit choices.
- AUD-001/GFX-001/THM-001: Users independently control audio, timed layers, branding and thumbnail composition. User input is stored as structured data, never executable commands.
- COL-001: Explicit shares are scoped, expiring and revocable. Comments attach to a specific revision and time; presence does not imply simultaneous-edit support.
- AIF-001: AI actions return proposals and confidence or uncertainty, allow review, and require approval before atomic edits. Provider input and cost must be disclosed and governed.

Intervals are half-open; time values use integer ticks at 240,000 ticks/second, with rational project frame rate. Source, project, clip-local and audio clocks are distinct. See [Pro interaction](../02-ux-ui/pro-editor-and-timeline-interactions.md) and canonical engineering documents. Related operational and security tests are release gates, not implied by the presence of a UI control.
