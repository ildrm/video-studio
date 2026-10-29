# Captions, graphics and thumbnail experience

**Status:** Proposed. **Owner:** Product designer. **Related:** CAP-001/002, GFX-001/002, THM-001. **Dependencies:** [screen specifications](screen-by-screen-specifications.md), [localization](localization-and-rtl.md).

## Captions
A transcript panel pairs each cue with editable text, start/end, seek and split/merge actions. Generated words retain source association and uncertainty; user correction creates a revision. Import validates file type, timestamps, ordering, encoding and size; report offending cues without discarding valid work. Styles control font, color, outline, shadow, background, placement and grouping; later animation and karaoke are explicit options. Burned captions, selectable tracks and sidecar files are distinct export choices. Overlaps are allowed only under the track policy and must remain legible; warn about safe-area conflicts.

## Graphics and branding
Layer list and inspector expose type, asset, timing, position, scale, rotation, opacity and order. Canvas drag is mirrored by numeric controls and keyboard nudge. Branding supports nine anchor positions and independent opacity/scale. Cross-workspace assets cannot be attached without permission. Missing assets show affected layers and a relink action. Inputs become validated structured project properties, never raw filter expressions.

## Thumbnail
Separate editable state holds canvas dimensions/aspect, background image or captured frame, crop/contain and position, text/title/subtitle, logo, layer order, typography and safe area. Show preview and a labeled layer list; PNG export reports dimensions and missing fonts/assets. Later templates and AI suggestions are proposed, with explicit review. Thumbnail changes do not rewrite timeline clips. Acceptance: round-trip multilingual text and image layers through save/reload; keyboard edit all properties; compare rendered output against preview using agreed tolerance and disclose unsupported fonts or approximations.
