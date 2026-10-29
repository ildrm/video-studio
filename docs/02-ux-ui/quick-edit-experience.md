# Quick Edit experience

**Status:** Proposed. **Owner:** Product designer. **Related:** EDT-001/004, AUD-001/003, CAP-001, GFX-001/002, THM-001, EXP-001. **Dependencies:** [shared project state](../03-frontend/canonical-editor-state-and-schema.md).

Seven stages remain directly accessible and do not enforce a linear wizard. A persistent preview, playhead, save state, undo/redo and Export action span all stages. Stage completion is informational, never a prerequisite for navigation.

| Stage | Controls and behavior | Invalid/edge state |
|---|---|---|
| Clips | Add, reorder, trim in/out, split at playhead, duplicate/delete; choose cut or transition and duration | Reject zero-length clips and transition exceeding available source; retain selection after undo |
| Audio | Source gain per clip, music, imported narration, generated narration, fades, loop and ducking | Provider or upload failure leaves previous mix unchanged; mute is explicit |
| Captions | Generate/import, correct cue text/time, select style, burn/sidecar | Low confidence and invalid cues visibly flagged; errors explain fix |
| Overlays | Add timed text or images; position, size, opacity, reorder and set in/out | Missing asset warns and blocks affected render |
| Branding | Choose authorized logo, one of nine positions, scale and opacity | Show missing logo and asset permission failure |
| Thumbnail | Choose frame/image, aspect, title, subtitle, logo and export image | Render unavailable frame shows retry; accessible layer list provides alternative |
| Export | Select versioned preset, caption mode, review revision and cost, submit | Unsupported codec/quota or unsaved conflict prevents submit with recovery |

Quick is a projection of the canonical project, not a conversion. Pro-only tracks, effects, keyframes and unsupported transitions remain serialized unchanged. Display a persistent summary of advanced content and route to Pro; restrict only operations that could implicitly replace hidden data, explaining why. Switch back and forth with an uncommitted edit either committed as one command or cancelled. Live preview labels approximate/unavailable effects; server preview is offered where supported. Acceptance: create advanced layers in Pro, change a Quick clip property, switch back and verify all untouched advanced data and output survive; keyboard users complete all seven stages.
