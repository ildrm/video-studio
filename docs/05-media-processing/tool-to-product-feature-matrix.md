# Tool-to-feature mapping

Status: proposed design; not implemented or tested. Owner: media engineering lead. Dependencies: [canonical model](../03-frontend/canonical-editor-state-and-schema.md), [feature catalog](../01-product/feature-catalog.md), [release gates](../09-delivery/phase-gates-and-definition-of-done.md).

The full 42-row mapping, candidate phase and UI/worker linkage are in the [audit](ffmpeg-skill-42-tool-audit.md). These are proposed capabilities, not shipped functionality.

| Product area | Candidate wrapper concepts | Integration constraint |
|---|---|---|
| Ingest and review | probe, scenes, look, cropdetect | Analysis returns suggestions; no semantic approval |
| Edit and compose | cut, join, fit, crop, insert, background, overlay, graphics, render | Compile the canonical timeline, do not accept direct CLI |
| Sound | audio, sync, loudness, silence | Separate measurement from edits; user reviews removal |
| Delivery | proxy, export, check, report, verify | Capability-gate and test output; presets are versioned |
| Advanced | deinterlace, denoise, redact, sphere, straighten, reverse, stabilize, sequence, waveform, freeze, pad, speedramp, loop, broll, metadata, grid, caption, color, batch, multicam | Feature-gate until dedicated fidelity, security and cost tests |

All operations use typed, authorized requests. A wrapper's existence does not establish a usable build, a safe cloud operation, or an equivalent browser preview.
