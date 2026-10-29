# Operations runbooks and incidents

**Status:** proposed. **Owner:** on-call SRE; security lead owns security incidents. **Dependencies:** observability, access policy and tested rollback.

## Incident command

SEV1: ongoing cross-tenant exposure, data loss or broad outage; page incident commander, security and service owners immediately. SEV2: significant service degradation or sustained render failure; page on-call and communicate status. SEV3: limited impact with workaround; ticket and investigate. Record start, impact, actions, timeline and decision owner in an access-controlled incident record. Assign incident commander, technical lead and communications lead; preserve evidence and avoid exposing customer media in incident channels. After mitigation, review root causes and track corrective actions with deadlines; no speculative public claims.

## Procedures

- **Queue backlog:** inspect oldest eligible job age, worker health, retries and tenant fairness; pause offending capability/tenant if authorized, increase bounded worker pool if budget allows, and verify lease reclamation. Avoid blindly replaying completed jobs.
- **Worker crash or malformed input:** quarantine job and input reference, check sandbox limits and sanitized error, cap attempts, isolate build regression, route exhausted jobs to dead letter; retry only with idempotent publish guard.
- **Storage outage:** stop admitting work that cannot persist safely, retain upload session state, retry with jitter; reconcile unfinished uploads and unreachable artifacts after recovery.
- **Bad deploy:** stop rollout, disable relevant flag, restore previously verified image; check migration compatibility and queue version before restarting workers. Do not roll back data blindly.
- **Suspected tenant leak:** isolate affected access path and revoke credentials, preserve access/audit logs, invoke security response and legal/privacy assessment; determine scope before deletion or notification.
- **Credential compromise:** revoke and rotate affected identities and signing keys, invalidate sessions/links as appropriate, audit usage and monitor re-entry.
- **Failed backup:** page owner, establish last verified restore point, repair backup chain, take verified new backup and escalate if RPO is at risk.

Every runbook needs an owner, access prerequisites, diagnosis, safe mitigation, rollback and verification. Run incident exercises and track actual times; none are claimed here.
