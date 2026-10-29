# Non-functional requirements

Status: proposed, unmeasured • Owner: engineering lead with SRE, security and accessibility review. Related: OPS-001, SEC-001. This table is the authoritative target register; architecture and runbooks reference it instead of inventing competing values. No service commitment is made.

Reference scenario to validate in phase 0: 100 active editors, 20 uploads and 10 admitted basic renders, with 100-clip projects; name actual CPU/RAM/browser/network/build/cache profile in every benchmark. Cold, warm, failed and degraded runs must be reported separately. A cached-proxy desktop test proposes at least 8 GB RAM, four CPU cores, 10 Mbit/s and 50 ms RTT; these are workload assumptions, not supported minimum hardware.

| ID | Attribute | Proposed target and exact measurement |
|---|---|---|
| NFR-01 | Local editing | p95 input-to-visible feedback ≤100 ms for committed trim/move controls, excluding decode but reporting decode separately. |
| NFR-02 | Project open | p95 ≤3 s navigation to metadata/timeline interactive for the reference 100-clip cached-proxy project; first video frame measured separately. |
| NFR-03 | Autosave | Queue committed edit within 2 s; p95 acknowledgment within 10 s on healthy reference connection; backend save processing p95 ≤500 ms excluding transfer. |
| NFR-04 | Render admission | p95 eligible basic-job queued-to-preparing wait ≤60 s at reference load; render compute time measured by fixture/tier, no universal render-time claim. |
| NFR-05 | API availability | Monthly ≥99.9% eligible authorized-request success. Include scheduled maintenance, internal failures, server timeouts and overload rejection; exclude validated client errors/quota violations, but report them separately. |
| NFR-06 | Recovery | Metadata RPO ≤15 min, RTO ≤4 h for create/open/save, measured during isolated restore drills. Object-original RPO must be chosen by storage class; do not infer it from metadata objective. |
| NFR-07 | Integrity | Every published output has checksum, immutable snapshot, mandatory QC pass and durable manifest. No acknowledged revision loss is acceptable; confirmed loss pages incident response. |
| NFR-08 | Isolation | Negative authorization tests for every protected operation and referenced object; any accepted cross-tenant access blocks release. |
| NFR-09 | Accessibility | WCAG 2.2 AA target for supported flows, with keyboard/assistive-technology manual evidence; conformance not yet assessed. |
| NFR-10 | Preview | Cached-proxy seek-to-frame p95 ≤500 ms on reference profile; dropped frames, A/V timing and memory separately measured. |
| NFR-11 | Events | Commit-to-subscriber job update p95 ≤5 s for connected authorized clients; reconnect and poll correctness independently tested. |
| NFR-12 | Cost/capacity | Measure worker seconds, retry cost, storage byte-time, egress and provider units per verified minute. Admit only within configured tenant/global budgets; scenario is not achieved capacity. |

Report p50/p95/p99, sample count, confidence/variability, failures and workload details. Do not turn exclusions into hidden failures. Saturation response is fair admission, bounded scaling and clear delayed/unsaved states; no edits discarded. A five-minute oldest-queue alert is an operational alarm, not another queue SLO. Targets need evidence and approval before release. See [SLO operations](../08-engineering/observability-slos-and-alerting.md) and [capacity](../08-engineering/capacity-cost-and-performance-budgets.md).
