# Ingestion and compatibility

Status: proposed design; not implemented or tested. Owner: media engineering lead. Dependencies: [canonical model](../03-frontend/canonical-editor-state-and-schema.md), [feature catalog](../01-product/feature-catalog.md), [release gates](../09-delivery/phase-gates-and-definition-of-done.md).

Upload into quarantine with bounded multipart size and checksum; complete only after server verification. Scan according to policy, probe in isolated worker, retain stream metadata and content hash, then create asset version, thumbnails, waveforms and preview proxy. Reject encrypted, corrupted, oversized or unsupported streams with actionable diagnostics; never trust extension or client MIME. Object keys are server assigned. Probe may read hostile inputs; disable external protocols and cap input, decoded pixels, duration, streams, temporary disk and time.

| Family | Ingest candidate | Browser preview | Cloud processing | Output candidate |
|---|---|---|---|---|
| H.264 MP4/MOV, AAC | probe and validate | native where browser supports | decode/encode build dependent | baseline MP4 candidate |
| HEVC, AV1, VP9, ProRes; MOV/WebM | conditional | device/browser dependent; use proxy | conditional codec and license | gated preset only |
| MP3, WAV, FLAC, AAC | probe audio-only | browser dependent | mix with selected stream | preset dependent |
| HDR, alpha, image sequences | inspect tags and limits | proxy may differ | explicit processing path | gated; no silent metadata loss |

For VFR preserve source timestamps and map through decoded presentation timestamps; generate CFR proxy deliberately, recording mapping. Normalize phone rotation once, respect sample aspect, color tags and mixed frame rates. Silent video gets silence only when composition demands it; audio-only gets no invented image. Originals remain immutable. Long recordings and large sequences require chunking limits and capacity tests. No cell above represents tested support. [FFprobe documentation](https://ffmpeg.org/ffprobe.html) specifies machine-readable stream and format inspection.
