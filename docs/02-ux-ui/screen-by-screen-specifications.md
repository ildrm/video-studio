# Screen specifications

**Status:** Proposed. **Owner:** Product designer. **Dependencies:** [navigation](navigation-and-screen-inventory.md), [component states](component-library-and-states.md), [permissions](../01-product/user-roles-and-permissions.md). All controls have accessible names, visible focus, local errors and keyboard operation.

## Account and workspace (PLT-001/002)
Sign-in sends the user to the selected identity provider for email/password or supported authentication and reset; application screens do not collect provider credentials. Validate format on submit without revealing account existence; announce errors and retain non-secret values. Dashboard shows active workspace, searchable project list and create action. Empty state explains first project; loading uses a labeled status; denied access offers workspace switch. Create dialog requires name, aspect ratio and frame rate; user can cancel without creating. Ownership transfer names recipient, states consequences and requires their acceptance.

## Media and upload (MED-001/002)
Library shows type, duration/dimensions, processing state, selection and searchable metadata. File picker and drop target feed the same validation. Each file exposes progress, pause/resume, retry and cancel; show size/limits and quota before transfer. Server finalization verifies parts and checksum. Processing states distinguish uploaded, inspecting, proxy ready and failed. A missing asset shows impacted clips and validated relink, not a blank substitution. Do not show filesystem paths in messages.

## Editor (EDT-001/002)
Header contains project/workspace, revision save state, undo/redo, mode switch and Export. Monitor displays play/pause, current time and approximation indicator. Quick stage navigation and Pro timeline share the same data. Inspector changes selected object only; mixed selection shows mixed values. Show locked-track denial before drop. Crash/offline state reports unsaved edits and offers recovery, never asserts a successful save without server acknowledgment.

## Captions and thumbnail (CAP-001, THM-001)
Caption view lists cue text, start/end and seek action; inline validation identifies nonpositive interval and overlapping constraints. Provider disclosure precedes transcription submission. Thumbnail view offers aspect/dimensions, background, editable text and logo, layer list, safe-area toggle, reset and image export; accessible layer list duplicates canvas actions. Show missing fonts/assets and output size before export.

## Export and review (EXP-001, COL-001)
Render dialog names saved revision, preset, dimensions, frame rate, caption mode, estimate and submit action. Validate codec availability and quota. Job screen shows stage, estimated or indeterminate progress, cancel, safe error and retry; success offers an authorized expiring download only after verification. Review surface names immutable revision and timecode, lists comments, and respects share permissions. Expired/revoked links show a generic access-denied state. Acceptance: no operation is represented as successful solely because it was queued.
