# 42-tool toolkit audit

Status: proposed design; not implemented or tested. Owner: media engineering lead. Dependencies: [canonical model](../03-frontend/canonical-editor-state-and-schema.md), [feature catalog](../01-product/feature-catalog.md), [release gates](../09-delivery/phase-gates-and-definition-of-done.md).

## Evidence and boundaries

An external local processing toolkit’s README and contract documentation, inspected 2026-10-29 on `main`, describe 42 public wrappers. The branch SHA was not available through the browsing interface; no upstream script, contract command, FFmpeg job, or test was executed here. Confidence: low for unpinned README-described purpose and for exact version-specific flags and behavior. Pin a reviewed commit before integration and generate an authoritative per-tool contract snapshot and capability report. These are wrappers around FFmpeg, not proof of native FFmpeg features or platform functionality. The README reports parser-derived input schemas and separately maintained metadata, contract-driven MCP, dry-run/plan/progress, input preservation, cache and verification; test those claims on the pinned version. `dry-run` may still perform measurements and is not a sandbox.

A = analysis, E = execution, H = analysis/execution hybrid, V = verification; these are planning classifications, not a verbatim contract snapshot. Phase is a product-release proposal, separate from a phase-0 technical spike; the feature catalog controls scope. In/out and output are broad categories, not a compatibility guarantee. The UI control maps to the named tenant-authorized worker operation. Each row calls for adaptation, not direct exposure of a local CLI.

All operations run against authorized immutable asset versions within a tenant-scoped, resource-limited worker. Validate inputs and bounds, prohibit network protocols and user-supplied paths or filter expressions, preserve originals, and return structured diagnostics. Actual codec/filter availability is per deployed FFmpeg build. Output jobs require probe and decode checks; picture-changing work also requires contact-sheet review. Unknown capability is not a pass. Performance and exact per-tool input/option/conditional component details remain unverified until the pinned contract and representative fixtures are executed. Phase numbers are proposed release sequencing, not a claim of availability.

Preconditions for each row: asset access and measured compatible streams, bounded parameters, a capability-checked worker and sufficient quota. Shared failures include unreadable or malformed input, absent decoder/filter/encoder, invalid bounds, timeout, resource exhaustion and QC failure; surface structured errors and leave source intact. No throughput is asserted. `look` generates a sheet, not automated semantic understanding; scene/audio ranks are proxies, not quality judgments. Redaction uses supplied coordinates and does not detect subjects. Required components for individual operations must be resolved from the pinned contract's required/conditional capabilities and actual `doctor` output; examples are `yadif` for deinterlace, `hqdn3d` for denoise, `vidstabdetect`/`vidstabtransform` for stabilization, `loudnorm` for loudness and `subtitles`/libass for subtitle rendering. Missing or unknown is a deployment gate, never a silent fallback.

| Tool | Role | Purpose | Input → artifact | UI | Worker operation | Candidate phase |
|---|---|---|---|---|---|---|
| `probe.py` | A | inspect streams, timing and color | media → metadata | asset details | probe | 0 |
| `scenes.py` | A | detect cuts and measured candidate ranks | video/audio → intervals | scene markers | scene analysis | 3 |
| `look.py` | V | create contact sheets and comparisons | video → PNG | review sheet | look | 1 |
| `cut.py` | E | trim or retain ranges | media → media | trim | trim | 1 |
| `join.py` | E | join normalized clips and transitions | media → media | transition | compose | 1 |
| `silence.py` | H | detect/remove pauses; filler needs timed transcript | audio/video → ranges or media | pause review | silence analysis | 3 |
| `fit.py` | E | fit duration or aspect; pad, crop, rotate | video → video | aspect and fit | reframe | 1 |
| `crop.py` | E | crop exact rectangle | video → video | crop handles | crop | 3 |
| `cropdetect.py` | A | measure bars or motion centroid | video → rectangle/measurements | crop suggestion | crop analysis | 3 |
| `deinterlace.py` | E | deinterlace frame or field | interlaced video → video | deinterlace | deinterlace | 3 |
| `denoise.py` | E | reduce spatial/temporal video noise | video → video | denoise strength | denoise | 3 |
| `redact.py` | E | blur/pixelate supplied region | video → video | redaction box | redact | 3 |
| `sphere.py` | E | project specified spherical viewport | 360 video → video | viewport angles | viewport | 4 |
| `straighten.py` | E | rotate arbitrary angle | video → video | horizon angle | rotate | 3 |
| `insert.py` | E | turn still into timed clip | image → video | still duration/motion | still clip | 2 |
| `background.py` | E | generate solid or gradient clip | parameters → video | background color | generate background | 2 |
| `reverse.py` | E | reverse video and optionally audio | media → media | reverse | reverse | 3 |
| `stabilize.py` | E | two-pass stabilization | video → video | stabilization | stabilize | 3 |
| `sequence.py` | E | encode numbered still sequence | image sequence → video | sequence rate | sequence | 3 |
| `waveform.py` | E | make waveform/spectrum visualization | audio → video/image | audiogram | audiogram | 3 |
| `freeze.py` | E | hold a frame | video → video | freeze duration | freeze | 3 |
| `pad.py` | E | add timeline black/silence padding | media → media | start/end padding | pad | 2 |
| `speedramp.py` | E | apply stepped speed segments | video → video | speed segments | speed | 3 |
| `loop.py` | E | repeat media or boomerang | media → media | repeat duration | loop | 3 |
| `broll.py` | E | overlay B-roll window while retaining A audio | A/B video → video | cutaway | overlay | 3 |
| `metadata.py` | E | write chapters and container tags | media + metadata → media | chapters | metadata | 3 |
| `grid.py` | E | compose labeled video grid | multiple video → video | grid layout | grid | 4 |
| `audio.py` | E | mix, duck, clean and apply dynamics | audio/video → media | mixer | audio mix | 2 |
| `sync.py` | H | measure audio offsets and correct drift | two or more recordings → offsets/media | sync review | sync | 4 |
| `loudness.py` | H | measure and normalize loudness | audio/video → measurement/media | target loudness | loudness | 2 |
| `caption.py` | E | render timed subtitles and styling | video + cues → video/subtitles | caption studio | captions | 2 |
| `overlay.py` | E | composite graphics or picture-in-picture | video + layer → video | overlay controls | overlay | 2 |
| `graphics.py` | E | render templated motion graphics | media + typed content → video | graphics templates | graphics | 3 |
| `color.py` | E | tone map, apply LUT and color corrections | video + typed controls → video | color controls | color | 3 |
| `export.py` | E | encode preset deliverable | media → output | export settings | export | 1 |
| `proxy.py` | E | create low-bitrate proxy | media → proxy | proxy status | proxy | 1 |
| `check.py` | V | check delivery parameters and content signals | media → QC report | quality report | check | 1 |
| `report.py` | V | assemble delivery HTML report | media and checks → HTML | delivery report | report | 3 |
| `render.py` | E | execute declarative project stages | project + media → output | render | render | 1 |
| `batch.py` | E | apply recipe across files using cache | assets + recipe → outputs | batch queue | batch | 3 |
| `multicam.py` | E | align and switch multiple sources | recordings + switches → media | multicam | multicam | 4 |
| `verify.py` | V | run toolchain verification on device files | fixtures → results | test report | verify | 0 |

## Contract and open evidence work

Before any direct invocation, record exact input formats, flags, output schema, per-operation dependencies and verification policy from the pinned machine-readable contract and parser, then test the actual container. Do not expose raw argv, MCP, local paths, expressions or unbounded lists to users. The toolkit reports content-hash caching and project plans, but cloud cache keys must include tenant, asset versions, compiler and renderer versions. Validate licenses, resource cost and fidelity independently. Per-tool exact options, detailed FFmpeg components, performance and experimentally observed failures are **not yet verified**; this audit is therefore partial, not a complete runtime certification.


## Upstream source-declared minimums and verification

The following is a source reading of the toolkit’s `TOOL_META`, inspected on `main` on 2026-10-29; it is not an executed capability report. `F` means ffmpeg and ffprobe; `X` means libx264; `A` means AAC encoder. Conditional dependencies vary with codec, input and options and are not exhaustively listed here; consult and execute the pinned contract. Probe/visual entries describe the source's declared verification policy, not completed checks.

| Tool | Declared minimum components | Source-declared verification |
|---|---|---|
| `probe.py` | ffprobe | none |
| `scenes.py` | F, scdet | none |
| `look.py` | F, tile | none |
| `cut.py` | F | probe |
| `join.py` | F, xfade, acrossfade | probe + look |
| `silence.py` | F, silencedetect | probe |
| `fit.py` | F, X, A | probe + look |
| `crop.py` | F, X, A | probe + look |
| `cropdetect.py` | F, cropdetect | none |
| `deinterlace.py` | F, X, A, yadif | probe + look |
| `denoise.py` | F, X, A, hqdn3d | probe + look |
| `redact.py` | F, X, A, boxblur | probe + look |
| `sphere.py` | F, X, A, v360 | probe + look |
| `straighten.py` | F, X, A, rotate | probe + look |
| `insert.py` | F, X | probe + look |
| `background.py` | F, X | probe + look |
| `reverse.py` | F, X, reverse | probe + look |
| `stabilize.py` | F, X, vidstabdetect, vidstabtransform | probe + look |
| `sequence.py` | F, X | probe + look |
| `waveform.py` | F, X, A, showwaves | probe + look |
| `freeze.py` | F, X, A, tpad | probe + look |
| `pad.py` | F, X, A, tpad | probe + look |
| `speedramp.py` | F, X, A | probe + look |
| `loop.py` | F, X, A | probe + look |
| `broll.py` | F, X, A, overlay, amix | probe + look |
| `metadata.py` | F | probe |
| `grid.py` | F, X, xstack | probe + look |
| `audio.py` | F | probe |
| `sync.py` | F | probe |
| `loudness.py` | F, loudnorm | probe + check |
| `caption.py` | F, X, A, subtitles | probe + look |
| `overlay.py` | F, X, A | probe + look |
| `graphics.py` | F, X, A, drawtext | probe + look |
| `color.py` | F | probe + look |
| `export.py` | F | probe + check |
| `proxy.py` | F, X, A | probe + look |
| `check.py` | ffprobe | none |
| `report.py` | F, loudnorm | none |
| `render.py` | F; stages delegate | probe + check + look |
| `batch.py` | F; steps delegate | probe |
| `multicam.py` | F, X, A | probe + look |
| `verify.py` | F; steps delegate | none |

Examples of conditional requirements include `zscale`/`tonemap` for HDR-to-SDR color, `ass` for animated captions, `drawtext` for text overlays, `sidechaincompress` for ducking, and encoder variants for the selected format. The source contract labels `look` verification and `stabilize`/`multicam` execution even though those flows also analyze or emit images. A valid filter listing does not establish successful execution, correct fonts, GPU/driver support, or semantic correctness.
