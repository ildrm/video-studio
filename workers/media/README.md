# Media worker

This is a one-shot, filesystem-staged processor for a limited version-1 project subset. It does not poll a queue, authenticate users, mint download URLs, perform tenant authorization, reserve quota, or provide an operating-system sandbox. A supervising service must authenticate and authorize the job, freeze the revision and asset versions, stage only the job's authorized inputs read-only, run the worker in an isolated environment, and publish its output only after the process completes successfully. Never treat path checks alone as a sandbox for hostile media.

## Runtime

Requires Python 3.10+ and working `ffmpeg`/`ffprobe` with `libx264`, AAC encoder, PNG encoder, `drawtext` with FreeType and text shaping (FriBidi), the relevant filters, and MP4/MOV, Matroska/WebM, WAV, MP3 and AAC demuxers/decoders. Set:

- `MEDIA_WORK_ROOT`: required absolute path to an existing, writable **per-job** directory. All requests must resolve beneath it. Only the supervisor/worker should be able to modify it; stage inputs read-only to avoid time-of-check/time-of-use changes.
- `FFMPEG_PATH`: optional executable path/name, default `ffmpeg`.
- `FFPROBE_PATH`: optional executable path/name, default `ffprobe`.
- `MEDIA_TIMEOUT_SECONDS`: optional integer 1–3600; default 600. Probe and thumbnail phases additionally cap individual subprocesses at 60 seconds.

Use a Linux container or equivalent with an unprivileged identity, read-only root, no credentials, no outbound network, bounded memory/CPU/process count and scratch storage, a wall-clock timeout, and only per-job inputs mounted. The subprocess runs a generated argv array with no shell and a limited protocol/demuxer list. These restrictions reduce exposure but do not replace OS isolation. Media subprocess stdout and stderr are drained while running: stdout has an operation-specific byte cap and stderr is capped at 1 MiB. Excess output terminates the process group with `MEDIA_OUTPUT_TOO_LARGE`, rather than filling temporary storage. All paths below are supervisor-provided absolute staging paths; never pass user-specified host paths. Limit admission, temporary storage, source bytes and concurrent subprocesses externally. A janitor must clean staging after worker/container crashes and SIGKILL.

## Protocol

Run `python3 workers/media/media_worker.py` once per request, write exactly one UTF-8 JSON object to stdin and close stdin. The request is limited to 2 MiB. stdout contains newline-delimited JSON. stderr from FFmpeg and local paths are not forwarded in errors. Successful requests exit 0 with one final `completed` event; failures exit 1 with one final `failed` event. Progress is optional and reflects actual FFmpeg `out_time_us`; clients must treat `fraction: null` as indeterminate. SIGINT/SIGTERM kills the active process group, discards scratch and reports `CANCELLED` where graceful signal handling is possible.

### Probe

```json
{"operation":"probe","inputPath":"/work/input.mp4"}
```

Example success:

```json
{"event":"completed","result":{"durationSeconds":2.0,"format":"mov,mp4,m4a,3gp,3g2,mj2","video":{"codec":"h264","width":160,"height":90,"timeBase":"1/15360","frameRate":"30/1","startPts":0,"durationPts":30720,"colorTransfer":"bt709","colorPrimaries":"bt709","colorSpace":"bt709"},"audio":{"codec":"aac","sampleRate":"48000","channels":1,"timeBase":"1/48000","startPts":0,"durationPts":96000,"startPtsSource":"stream"}}}
```

`video` or `audio` may be null; at least one must be present and there may be at most one of each. Audio metadata includes `startPts`, `durationPts` and `startPtsSource` (`stream`, `first_packet`, or null). For audio-only WAV/MP3/AAC, the response has `video: null` and real audio stream timing. When a stream lacks `start_pts`, the first audio packet's PTS is inspected; no zero is invented. `startPts`/`durationPts` are safe integers or null, and video color fields may be null. Video metadata also includes `sampleAspectRatio` and display `rotation`; rendering and thumbnails preserve the display aspect ratio of non-square pixels and right-angle rotated video. Probe preserves metadata but does not certify media is safe to render. Video rendering needs known timestamps and explicitly tagged Rec.709 SDR color. Metadata is untrusted: the caller must independently enforce authorization and input policy.

### Thumbnail

```json
{"operation":"thumbnail","inputPath":"/work/input.mp4","outputPath":"/work/preview.png","atSeconds":0}
```

The time is finite and inside the inspected source duration. Output is a real PNG decoded from one frame, resized to 320 pixels wide preserving aspect ratio, checked for a valid PNG header/dimensions and fully decoded. It emits `preparing`, `verifying`, then `completed` with `result: {outputPath, sha256, sizeBytes, width, height}`. The destination must not already exist. A missing frame or invalid file fails rather than producing a placeholder.

### Render

```json
{"operation":"render","document":{},"assets":{"<assetVersionId>":"/work/input.mp4"},"outputPath":"/work/output.mp4"}
```

Replace `document` with the canonical project object; `{}` above is only a shape illustration and is not valid input. The key in `assets` is the project's UUID asset version, and the file's SHA-256 must match that project's immutable asset reference. Every referenced video/audio/font asset must be staged with a matching checksum and no extra staged asset is accepted. Fonts must be real immutable tenant-authorized font assets of at most 16 MiB. Exactly one sequence, one visible video track, at most one additional audio track and at most one caption track are supported. With hard cuts, the video track supports 1–32 ordered, contiguous, non-overlapping clips. A single true audio/video crossfade is supported only between exactly two video clips. Every clip must begin and end on an output frame boundary; `sourceRange` uses the probed stream PTS and timebase, and must be within the source. Rational frame rates are limited to the v1 supported set. Only normal-speed clips with identity transforms, no effects and no keyframes are accepted. Other transition kinds are rejected. Source audio may be enabled/disabled, muted by the track or adjusted by the clip's gain; missing audio is represented by silence. Tracks, missing assets and unsupported values are rejected rather than discarded.

The canvas is opaque black, SDR Rec.709, even dimensions up to 3840 on either side and at most 3840×2160 pixels. Sources need explicitly tagged Rec.709 primaries, transfer and color space. Untagged, differently tagged and HDR footage is rejected until a user-approved interpretation/conversion is implemented. Output is H.264/AAC MP4, yuv420p, 48 kHz stereo, fit-and-pad and CRF 20. The actual project canvas determines output dimensions; this implementation does not yet resolve catalog export presets. Right-angle rotation metadata is applied by FFmpeg, and scaling uses the inspected display aspect ratio before producing square output pixels. Other rotation angles are rejected. Color conversion, proxies, waveform, additional video/audio tracks, generated speech and other transitions are not implemented.

The optional audio track uses the canonical track/media-clip fields. It accepts 1–32 audio clips sourced from audio-only files or from the audio stream of a video asset. The first clip may begin later than zero, leaving silence until its `startTick`; later clips must be ordered and contiguous with the previous clip, without gaps or overlaps. Each must end within the video sequence and last no more than 600 seconds. Both `startTick` and `durationTick` must be multiples of 5 timeline ticks (one 48 kHz sample), independent of video frame boundaries. Source in/out are in the **audio stream's** probed `timeBase` and must agree with the timeline duration to within one tick. Asset and track IDs/orders must be distinct.

Each audio clip uses rate 1, the canonical identity transform, empty `effects`/`keyframes`, and `sourceAudio: {enabled, gainDb}` with finite gain from -96 to +24 dB. `enabled:false` creates silence for that clip; `track.muted:true` silences the entire separate track; `track.solo:true` silences the original video audio and retains the unmuted audio track. A muted solo audio track yields silence. The worker applies per-clip gain and sums that track with the original video audio using `amix normalize=0`. There is no automatic normalization, limiter, mastering or clipping guarantee; large positive gains or multiple loud sources can clip. Users must adjust gain explicitly. Other tracks, audio effects, audio automation, looping, overlaps and gaps are rejected, rather than silently omitted. Mixing a music track and the supported video crossfade is supported concurrently.

Before mixing an enabled audio clip, the worker independently decodes its selected source interval at 48 kHz stereo and checks that it contains the exact expected sample count. Insufficient decoded audio fails instead of being padded with synthetic silence. It verifies the output is 48 kHz stereo AAC, starts at zero and has duration within two samples of the project; output video has the exact requested frame count. The MP4 movie/video timescales use 240000 ticks to retain fractional-frame timing. This work can be expensive for long audio; the supervisor must enforce an overall job deadline in addition to per-process timeouts.

The optional caption track uses the existing `CaptionCue` and `TextStyle` model. It must have a greater track order than the video track and may contain 0–500 ordered, non-overlapping cues, each inside the sequence and aligned to output frames. Cues are active on the half-open interval `[startTick, startTick + durationTick)`; the compiler uses frame indices, preserving exact boundaries even at fractional frame rates. A hidden or muted caption track is omitted from the picture, and solo is rejected.

A cue accepts 1–2000 Unicode characters, manual newlines and a bounded language tag. NUL, unsupported control characters and unpaired surrogates are rejected. Its real `fontAssetVersionId` must reference a staged font with a matching immutable checksum. Font size is 8–200 canvas pixels, outline is 0–10 pixels, and colors use explicit `#RRGGBBAA`. `align` is start/center/end and `direction` is ltr/rtl/auto; explicit direction uses Unicode direction embedding plus FFmpeg shaping. Automatic direction resolves the first strong Unicode character for start/end alignment. Text is passed through UTF-8 files with `expansion=none`, so `%{...}`, braces, quotes and filter syntax are literal data. Only generated safe relative filenames enter the filter graph. The generated graph is read from a private script file, so a valid 500-cue project does not exceed the operating system’s per-argument limit. If FFmpeg lacks `drawtext` and shaping, rendering fails explicitly with `MEDIA_CAPABILITY_UNAVAILABLE`.

Caption transform x/y are normalized in [0,1]: x is the horizontal alignment anchor, and y is the top of the text block. For centered lower captions, x=.5 and y=.8 is a useful starting position. Scale must be 1, rotation 0 and opacity 1; other values are rejected. There is no automatic wrapping, emoji fallback guarantee, word animation, transcription, font upload validation or sidecar export. Users must provide explicit line breaks and use glyphs covered by the selected trusted font. Browser preview needs the same registered font and placement; these worker tests do not establish browser/render typography parity.

For the two-clip fade, represent the actual overlap on the canonical timeline, not just a visual animation. The object uses the existing v1 schema:

```json
{"id":"00000040-0000-4000-8000-000000000001","fromClipId":"00000030-0000-4000-8000-000000000001","toClipId":"00000031-0000-4000-8000-000000000001","type":"fade","durationTick":120000,"audioCrossfade":true}
```

Clip 2 starts at clip 1's end minus `durationTick`; both clips and the positive overlap must align to output frames, and the overlap must be strictly shorter than both clips. Sequence duration equals the second clip's end. A 0.5-second fade between two 1-second clips yields 1.5 seconds and 45 video frames at 30 fps. The video uses `xfade=fade` and audio uses an overlapping linear `acrossfade`; a missing or muted audio stream contributes silence. Only one fade is accepted. Reject wrong IDs, gaps, triple/multiple overlaps, unsupported transition types and `audioCrossfade:false`. Onscreen preview must either display the same overlapping visual/audio behavior or clearly indicate that a server preview is needed. No preview implementation is implied by this worker.

Worker progress events look like `{"event":"progress","phase":"running","fraction":0.3}`; final success includes `result: {outputPath, sha256, sizeBytes, durationSeconds, format, video, audio}`. Before publishing to the work directory, the worker verifies output existence, H.264/AAC codecs, canvas dimensions, rational frame rate, duration tolerance and Rec.709 tags, then decodes all streams with FFmpeg and verifies that the decoded video frame count exactly equals the project duration in output frames. It writes into a unique staging directory and uses a no-overwrite hard link to expose the completed file within the work root. This local exposure is not the application's durable artifact publication: the supervisor must commit the immutable artifact manifest atomically, with lease fencing, and clean orphaned staged files. Failures use `{"event":"failed","error":{"code":"...","message":"..."}}` and preserve the original inputs.

## Checks

```sh
python3 -m unittest discover -s workers/media/tests -v
```

Real-media tests create synthetic clips through the configured FFmpeg, inspect PTS, verify red/blue output frames and audio/silence, test a 45-frame overlapping video/audio fade and invalid transition cases, validate 30000/1001 timing and independent WAV/MP3/AAC mixing and mute/gain/solo behavior, create a decoded PNG, check invalid and altered inputs, and exercise cancellation, timeouts and bounded tool output. Caption tests inspect actual decoded pixels at the first and last active frame, literal filter metacharacters, Unicode text, visibility and rejected invalid cues; geometry tests verify non-square pixel rendering and thumbnails. They explicitly skip real-media cases if FFmpeg/FFprobe cannot start. A skipped real-media test is not evidence of media correctness. No cloud integration, isolated-container security test, VFR parity, visual/color accuracy or load test is implied by these tests.
