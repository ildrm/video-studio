# Capacity, cost and performance budgets

**Status:** proposed planning targets, not benchmarks or promises. **Owner:** platform/SRE and finance. **Dependencies:** [authoritative NFR register](../01-product/non-functional-requirements.md), fixture matrix, worker quotas and metering.

| Dimension | Initial proposed budget or method |
|---|---|
| Editor interaction | NFR-01 p95 local input-to-visible feedback ≤100 ms; measure separately from server save |
| Project open | NFR-02 p95 ≤3 s for reference 100-clip cached-proxy metadata/timeline interactivity; first video frame separately |
| Preview seek | NFR-10 p95 ≤500 ms for cached proxy on reference profile; report cold/degraded cases separately |
| Upload | measure MiB/s and retries per network class, not one universal throughput promise |
| Render | measure wall-clock/media-minute, queue wait and CPU/GPU, by source, effects, resolution and worker image |
| Capacity | starting load scenario 100 concurrent active editors, 20 simultaneous uploads and 10 renders; it is a test scenario, not capacity achieved |
| Autoscaling | scale on oldest eligible queue age and resource saturation, capped by budget, fairness and worker quotas |

Measure cost per output minute as `(worker compute + temporary storage + egress + allocated retry cost)/verified output minutes`; separate AI provider costs, original/derived storage and idle capacity. Meter by workspace and job, reconcile actual invoice with estimates and alert on anomalous retries. Choose concurrency only after memory, scratch disk, decoder and I/O load measurements; cap per-tenant jobs and staged upload bytes. Preserve headroom for burst and fail safely when quota or budget is exhausted. GPU feasibility requires actual deployment drivers, codecs and licensing tests; do not infer support from a local workstation. Benchmark dataset includes mixed fps, HDR, audio, captions and long-form. Review budgets each quarter and after architecture changes; identify hardware, build, browser, cache state and percentile in every result.
