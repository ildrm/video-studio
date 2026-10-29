# Scalability, reliability and performance

Status: proposed • Owner: SRE • Related: OPS-001, EXP-001. Dependencies: [authoritative NFR targets](../01-product/non-functional-requirements.md), [capacity budgets](../08-engineering/capacity-cost-and-performance-budgets.md).

Scale stateless API separately from CPU/memory-bound workers. Admission reserves tenant/global resources; fair queueing caps concurrency and prevents one workspace starving others. Autoscale on eligible queue age and measured worker saturation with budget caps and headroom. A queue is durable only with DB state/outbox reconciliation and tested lease fencing. No exactly-once execution or storage durability percentage is assumed.

Use NFR-01–NFR-12 as the sole numeric target register: project open 3 s, queue p95 wait 60 s, metadata RPO 15 min and RTO 4 h are proposals under defined workload. API availability includes planned maintenance. Keep measured results in versioned reports rather than overwriting targets. First-frame, service save latency, end-to-end autosave and oldest backlog age are distinct metrics.

Cache only authorized derivatives keyed by tenant, asset version/hash, operation parameters, font/preset/compiler/build versions and time mapping. Invalidate on source/version/policy change; no cross-tenant hash sharing. PostgreSQL indexes, scratch storage, object lifecycle and egress require load and failure tests. Degrade preview quality or stop admission under saturation with visible status; never acknowledge data that was not durably saved. Test database/storage outage, queue duplication, worker death, restore and tenant fairness before approving launch capacity.
