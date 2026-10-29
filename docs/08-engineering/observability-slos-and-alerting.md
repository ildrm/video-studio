# Observability, SLOs and alerting

Status: proposed, unmeasured • Owner: SRE • Related: OPS-001, EXP-001, SEC-001. [NFR targets](../01-product/non-functional-requirements.md) are authoritative. Monthly availability includes planned maintenance; do not substitute a rolling-window or maintenance-excluded number without an approved target change.

| Signal | Measurement and proposed action |
|---|---|
| Availability (NFR-05) | Successful eligible authorized requests / eligible requests. Count timeout, internal failure, maintenance and overload as failures; report excluded genuine client/quota errors. Use short/long error-budget burn alerts. |
| Save safety (NFR-03/07) | Acknowledged revision remains readable and valid; any confirmed loss is SEV1. Measure service processing and end-to-end save separately. |
| Queue latency (NFR-04) | Per-job queued-to-preparing wait p95 ≤60 s under reference load; oldest eligible queued job >5 min sustained pages on-call. The latter is an alarm, not a competing SLO. |
| Render quality | QC-passed jobs / accepted eligible jobs, segmented by logical job and execution attempt. Report cancellations, invalid input, retries and provider failures explicitly. A provisional 99% completion objective requires a defined deadline before adoption. |
| Event propagation (NFR-11) | State committed to authorized connected subscriber p95 ≤5 s. Monitor reconnect gaps and polling fallback. |
| Cost/resources (NFR-12) | CPU/RAM/scratch, storage, retries, egress, quota rejects, queue fairness and actual provider units by approved bounded dimensions. |

Trace request → revision → snapshot → job/attempt → artifact with opaque correlation IDs. Avoid tenant/project IDs as unbounded metric labels; scoped diagnostic logs may contain opaque IDs with restricted access. Never log tokens, signed URLs, filenames, transcripts, raw media or prompts. Redact provider error payloads. Audit events and product analytics have separate access/retention.

Alert on stale leases, failed QC, authorization anomalies, backup failure, storage exhaustion, event backlog and unusual cost; attach runbook and owner. Synthetic journeys use licensed synthetic media. Pause risky rollout when error budget is exhausted or data loss/isolation failure occurs. See [runbooks](operations-runbooks-and-incidents.md).
