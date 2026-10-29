# Pro editor and timeline interactions

**Status:** Proposed. **Owner:** Timeline interaction designer; media engineer reviews semantics. **Related:** EDT-002/003/005, AUD-001, CAP-001, GFX-001. **Dependencies:** [canonical project schema](../03-frontend/canonical-editor-state-and-schema.md).

Ruler and playhead run in project time. Each clip has source in/out and timeline start/duration; intervals are half-open `[start,end)`. Values use integer 240,000 ticks/second and a rational project frame rate. Resolve boundaries using the canonical frame rounding policy; never approximate fractional frame rates by floating point accumulation. Audio uses sample time with explicit conversions. Pro rows show track name, type, lock, visibility, mute/solo where applicable; clips show thumbnails or waveform, label and handles. Higher visual layers composite in declared order; audio tracks mix rather than obscure one another.

| Action | Gesture and keyboard alternative | Validation / undo |
|---|---|---|
| Select/move | Click or drag; focus clip, use accessible move command and time entry | Clamp nonnegative time, respect locked tracks and collision policy; one undo transaction |
| Trim | Drag edge; select edge and enter time/frame delta | Clamp to source bounds and positive duration; preserve opposite boundary unless mode says otherwise |
| Split | Playhead and split command | Must lie inside clip; adjacent half-open intervals share boundary; source mapping stays continuous |
| Ripple delete | Delete with ripple option | Shift eligible unlocked downstream content as one transaction; blocked dependencies explained |
| Roll | Move common boundary of adjacent clips | Total span stays fixed, require handles on both sources |
| Slip | Shift source in/out together | Timeline bounds and duration fixed, source bounds enforced |
| Slide | Move clip between neighbors | Neighbors absorb boundary change, all locks/handles validated atomically |
| Insert/overwrite | Choose target and insertion policy | Show affected region before commit; locked or insufficient content blocks with no partial change |
| Snap/zoom | Toggle snap; keyboard zoom, scroll and timecode input | Offer visible snap target and threshold; zoom never changes timing |

Expose playhead, current frame, clip properties, selected tracks and editing mode as text. Pointer drag has keyboard/time-entry equivalent; escape cancels gesture without committing. Multi-select edits are atomic; drag preview is transient and pointer release creates one reversible command. Pro-only layers survive Quick changes. Support VFR sources via presentation timestamps and normalize only at documented render/proxy boundaries. Fallback when live preview cannot display an effect: mark it, offer server preview, preserve final render intent. Tests cover edge boundaries, rational rates, missing media, track locks, source handles, keyboard operations, undo and mode round trips.
