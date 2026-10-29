# Job queues, workers and render orchestration

Status: proposed • Owner: distributed systems engineer • Related: EXP-001, OPS-001, AIF-002. Dependencies: [compiler](../05-media-processing/render-compiler-and-execution-graph.md), [API](api-design-and-contracts.md).

| From | Allowed next states | Condition |
|---|---|---|
| created | validating, cancel_requested | Durable admission and quota reservation already committed. |
| validating | queued, failed, cancel_requested | Schema, access, capabilities and snapshot checked. |
| queued | preparing, cancel_requested | Worker atomically claims lease and increments attempt. |
| preparing | running, retry_pending, failed, cancel_requested | Authorized dependencies staged; no unsupported fallback. |
| running | verifying, retry_pending, failed, cancel_requested | Process exit alone is not completion. |
| verifying | uploading, retry_pending, failed, cancel_requested | Mandatory QC must pass; creative warnings remain explicit. |
| uploading | completed, retry_pending, failed, cancel_requested | Completed only after output exists and DB manifest promotion commits. |
| retry_pending | queued, failed, cancel_requested | Backoff expires; max attempts/deadline and current policy checked. |
| cancel_requested | cancelled | Controller/supervisor stops process, prevents promotion and records cleanup/reconciliation. |
| completed / failed / cancelled | none | Explicit user retry creates a new logical job, same immutable snapshot where policy permits. |

A transient error enters retry_pending directly, not terminal failed. Proposed policy: up to three execution attempts, capped exponential jitter and a per-operation deadline configured before launch; never automatically retry provider calls with unknown billing outcome. Queue delivery is at least once. Worker claim obtains fencing token and lease; heartbeat before lease expiry. Reaper invalidates expired token and schedules retry_pending or failed. Stale workers cannot update job or publish manifest. Progress fraction is optional, per phase and may reset on a new attempt; monotonic event sequence, not phase rank, orders updates.

Cancellation and publication use compare-and-swap against current state and fencing token. If completed wins first, cancel returns terminal completed with no promise of revoking an already issued artifact. If cancel_requested wins, publication is rejected, supervisor terminates process group and cleans scratch/staged objects. A queued job may be cancelled by controller without worker execution. Repeated cancel is idempotent. Cleanup has its own retry/alert ledger; failure to delete a scratch object does not justify publishing it.

Use a transactional outbox and unique job operation key; all DB state, reservation and event changes commit atomically. Outputs upload to immutable attempt-specific keys; object storage has no assumed cross-object transaction or rename. Atomically publish only a database manifest pointer after upload/QC; orphan staged objects are swept. Durable snapshots pin versions and hashes. Per-tenant admission, fair scheduling, CPU/RAM/disk/pid/time limits, heartbeat and dead-letter operations prevent unbounded work. Explicit retry rechecks access and quota and uses a fresh API idempotency key; replaying a previous key returns the original job, not another attempt. See AT-05–AT-07 and AT-24.
