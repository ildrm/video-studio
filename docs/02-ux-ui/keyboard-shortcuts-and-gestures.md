# Keyboard shortcuts and gestures

**Status:** Proposed defaults, subject to browser conflict and usability testing. **Owner:** Interaction designer. **Related:** EDT-001/002, AUD-001, CAP-001. **Dependencies:** [Pro interactions](pro-editor-and-timeline-interactions.md), [accessibility](accessibility.md).

| Intent | Proposed default | Alternative |
|---|---|---|
| Play/pause | Space when editor has focus and no text field is active | Labeled button |
| Step frame | Left/right arrow when monitor/timeline owns focus | Previous/next frame buttons or time entry |
| Split | Configurable command in editor focus | Clip menu and accessible command palette |
| Undo/redo | Platform conventions | Labeled toolbar buttons |
| Select | Tab to track/clip and activate | Accessible track/clip list |
| Nudge and trim | Configurable shortcuts with focus context | Numeric time/frame fields |
| Move and zoom | Keyboard commands and numeric position | Drag, scroll and zoom controls |
| Cancel transient gesture | Escape | Cancel button |

Shortcuts are discoverable in a help dialog, configurable where possible, and never trap focus or override text entry or assistive technology. Gesture interactions (drag, pinch, two-finger pan) have a single-pointer and keyboard alternative. All gestures show preview and commit as one transaction; escape or pointer cancellation rolls back the transient gesture. Test browser reserved shortcuts before shipping; this document does not promise a key mapping. Direction of timeline controls remains consistent when UI is RTL and is clearly described.
