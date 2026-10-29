# Canonical editor state and schema

Status: proposed structural contract • Owner: frontend architect • Related: PRJ-002, EDT-001–006, CAP-001, EXP-001. Dependencies: [time semantics](timeline-model-and-editing-commands.md), [schema v1](schemas/project-v1.schema.json), [example](examples/project-v1.json).

The JSON Schema is the structural source of truth for version 1. OpenAPI references it rather than maintaining a competing model. The example contains 30 frames at 30000/1001 fps: 240240 ticks and 30030 source PTS at timebase 1/30000. Rendering software is not implemented. Schema validation alone cannot establish authorization or timeline arithmetic.

| Object | Contract |
|---|---|
| Project document | schemaVersion=1, projectId, revision, timebase=240000, canvas, immutable asset references, activeSequenceId, sequences, thumbnail and versioned export presets. |
| Canvas | Integer dimensions, rational frame rate, explicit background and workingColorSpace. V1 specifies SDR Rec.709; HDR/nested compositions require an approved schema extension/version. |
| Asset reference | assetId, immutable versionId, media/font kind, content SHA-256 and ready/unresolved status. Server metadata supplies actual streams, source duration, color and orientation; client declarations are untrusted. |
| Sequence | Positive durationTick, tracks, transitions and markers. Active sequence ID must resolve. Unused sequences are retained. |
| Track | Unique ID, kind, order, lock, mute, solo, visibility and clips. Video/graphics tracks composite by ascending order; audio sums. Caption tracks contain typed cues. |
| Media clip | startTick, durationTick, assetVersionId, sourceRange in original integer PTS and rational timeBase, positive rational playbackRate, transform, sourceAudio, effects and clip-local keyframes. Still images use synthetic source timebase 1/240000 and a declared hold interval. |
| Text/caption | Editable Unicode text, font asset, language where applicable, explicit style/direction/transform and half-open timing. Graphics text is separate from caption cues. |
| Effects | Versioned discriminated types with bounded parameters; no arbitrary filter strings or unknown effect payloads in v1. Effects apply in array order. |
| Thumbnail | Independent dimensions and layers. Layer timing fields select the source frame at local tick zero; thumbnail export does not change timeline duration. |

Semantic validation must enforce unique IDs, asset and font references, workspace ownership, ready source versions, supported stream kinds, positive ranges, source bounds, active sequence, unique track order, clips contained within sequence, transition adjacency/overlap, keyframe order/bounds/value ranges and allowed feature phase. `sourceRange` seconds divided by playbackRate must agree with duration within the declared output-frame/audio-sample quantization policy. Save may preserve an unresolved reference to recover a package; render fails with `ASSET_UNRESOLVED`. Never resolve a filename automatically to another asset.

All timeline ticks are nonnegative safe integers, capped at the proposed 24-hour sequence limit (20736000000 ticks); source PTS may be negative for legitimate source preroll and are separately bounded signed safe integers. Zero-length sequence creation uses an empty revision with no renderable media only if schema permits; v1 instead creates a one-frame blank sequence and rejects render until a playable source exists. Generated backgrounds require a later typed schema extension. Canvas limits are schema ceilings, not codec support guarantees. A policy may impose smaller limits.

A save submits the base document revision and If-Match tag. Server validates and atomically writes revision+1; clients adopt the returned document rather than incrementing locally. A render freezes project/asset/font versions, preset version, compiler version, worker digest and policy version. Quick Edit edits only represented fields; hidden advanced values remain unchanged. Unknown schema versions or fields fail with an upgrade/migration error; the prior document remains available. Do not round-trip unsupported fields through an older client. Deterministic migrations create new revisions and retain originals.

Acceptance: validate the example, reject malformed nested clips and unknown effects, preserve supported fields through both views, reject cross-tenant references, and render only an acknowledged immutable revision. See [API contract](../04-backend/api-design-and-contracts.md) and [AT-21–AT-24](../09-delivery/acceptance-test-catalog.md).

Transform x/y are normalized canvas coordinates (0 is left/top, 1 is right/bottom), bounded to [-8,8]; rotation is clockwise degrees and scale is positive. Clip transform positions its source top-left at x/y before rotation about source center. The compiler and preview must share this order. Fade inDurationTick/outDurationTick are local durations, nonnegative and with sum ≤clip duration. Opacity keyframes stay in [0,1]; scale keyframes remain positive; all properties inherit transform bounds.
