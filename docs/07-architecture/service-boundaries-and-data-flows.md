# Service boundaries and data flows

Status: proposed • Owner: principal architect • Dependencies: [backend](../04-backend/backend-architecture.md).

The modular monolith owns identity integration, tenancy, project revisions, asset registry, collaboration, quota and job orchestration; dedicated workers own untrusted media computation. A transactional outbox publishes at-least-once jobs. Upload flow: authorize and reserve → scoped multipart upload → checksum and inspect → proxy/waveform → ready. Render flow: authorize revision → freeze snapshot and reserve quota → enqueue → sandbox executes allowlisted plan → verify → atomically publish artifact → notify → expire by policy. AI flow uses separate adapter, consent and quota, then presents results as reviewable proposals. Data access passes through tenant checks; provider access is limited by purpose and contract. Failures are durable and retryable where safe; status does not imply output is verified until QC passes.
