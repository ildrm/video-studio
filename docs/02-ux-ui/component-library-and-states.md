# Component library and states

**Status:** Proposed. **Owner:** Design systems architect. **Dependencies:** [tokens](design-system-and-tokens.md), [accessibility](accessibility.md). **Related:** PLT-001, MED-001, EDT-002, EXP-001.

| Component | Contract | States and recovery |
|---|---|---|
| Button / menu | Named action, predictable keyboard activation | enabled, disabled with reason, pending; no duplicate submission |
| Field / select | Label, hint, value, validation linked programmatically | empty, invalid with specific error, disabled, valid; preserve input |
| Dialog | Focus moves inside, remains contained, returns to trigger | confirm/cancel; destructive consequence and recovery named |
| Upload row | File label, byte progress, pause/resume/retry/cancel | waiting, uploading, paused, validating, processing, complete, failed |
| Timeline clip/track | Text name, timing, selection and track controls | focused, selected, locked, dragging preview, unavailable asset |
| Preview monitor | Play, pause, seek and current time; caption/approximation status | loading, playing, paused, buffering, error, server-preview available |
| Inspector | Structured properties of selected object | no selection, mixed values, validation errors, locked |
| Job progress | Named stage and progress or indeterminate status, cancel/retry | queued, running, verifying, completed, failed, cancel requested/cancelled |
| Toast and inline status | Short nonblocking confirmation; durable errors inline | polite announcements except urgent failures; no focus theft |

Components do not derive authorization from disabled UI; server enforces it. Async controls retain focus or explain replacement. Virtualized lists maintain accessible row semantics and selection when scrolling. Acceptance: test keyboard, screen reader, touch, high contrast, slow network and failure behavior for each component; no content or secrets appear in error telemetry.
