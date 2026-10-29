# Testing strategy and fixtures

**Status:** proposed. **Owner:** test architect; subsystem owners supply fixtures and expected results. **Scope:** all phases. Application/runtime tests remain unexecuted; documentation/schema checks are recorded separately in the quality audit.

## Layers and evidence

Unit tests cover rational time arithmetic, interval boundaries, edit command inverses, authorization and compiler validation. Property tests generate sequences of trim/split/undo/redo and verify no negative duration or out-of-source bounds; supported fields survive, while unknown fields/versions fail explicitly without overwriting stored data. Component tests cover keyboard and screen-reader interaction and loading/error/retry states. API contract tests exercise validation and concurrent revision conflicts; database integration tests run migrations and tenant isolation on a real disposable database. Worker integration tests use pinned images, deterministic files, retries, leases and cancellation. Browser end-to-end tests exercise upload → edit → render → download and switch modes without loss; run a versioned browser/OS/device matrix, including reduced motion, RTL and touch. Evaluate color and screen-reader behavior manually as well as with automation.

Golden media tests compare duration, frame count, timestamps, stream metadata, perceptual image difference with documented tolerance, and aligned audio sample/loudness metrics; allow encoder-specific tolerances and pin build/fixtures. QC also needs human review for framing, subtitle readability and visually unintended freezes; numeric success does not prove creative quality. Deliberately corrupt, truncate and fuzz media in isolated workers. Test queue lease expiry, duplicate delivery, object-store outage, stale revision, provider timeout, cancellation during upload, and restoration from backup. Load tests simulate fair multi-tenant uploads and renders, with cost ceilings, not real user media. AI evaluations use consented datasets and report accuracy, slices, confidence calibration and regression by model/version, without implying perfect correctness.

## Representative fixture matrix

| Fixture | Expected checks |
|---|---|
| VFR phone footage, rotated metadata | correct orientation, timestamps, duration and frame cadence |
| HDR and SDR mixed, mixed fps | explicit tone mapping/metadata; deterministic output frame mapping |
| 44.1/48 kHz, missing audio, silence | sync, no drift, silence/mute semantics |
| Corrupt and truncated input, oversized image | bounded failure, no tenant escape or partial publication |
| Long recordings and many assets | quotas, memory, progress, resume and cleanup |
| Portrait and landscape, alpha | crop/pad, layer order and safe area |
| Persian/Arabic, mixed-direction, CJK and emoji | shaping, font fallback, timing and no clipped text |
| H.264, HEVC, AV1, ProRes, VP9 variants | explicit build capability, expected acceptance or clear refusal |

Fixtures must be licensed, versioned and checksummed; record encoder/build and tolerances. No private customer data. **Gate:** all critical scenarios have reproducible evidence, including visual/manual exceptions, before launch. See [acceptance catalog](../09-delivery/acceptance-test-catalog.md).
