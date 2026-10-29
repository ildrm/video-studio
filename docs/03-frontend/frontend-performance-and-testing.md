# Frontend performance and testing

Status: proposed • Owner: frontend performance engineer • Dependencies: [quality targets](../01-product/non-functional-requirements.md).

Virtualize timeline tracks and clip thumbnails; bound decoded-frame, texture and waveform caches by device class; cancel obsolete seeks and network requests. Capture editor-open, input-to-paint, dropped frames and autosave outcomes with consent and tenant-safe dimensions; no media content or signed URLs in telemetry. Test timeline math and command inverses with property-based cases, browser interactions across selected browser matrix, accessibility with keyboard and assistive technologies, VFR/fractional frame parity fixtures and poor-network recovery. Measure on defined representative devices before adopting targets. Security: isolate tenant caches and avoid persistence of secrets. Acceptance: no unbounded resource growth in long sessions; budgets and regression thresholds are measured before release.
