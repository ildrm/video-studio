# System context and containers

Status: proposed • Owner: principal architect • Dependencies: [boundaries](service-boundaries-and-data-flows.md), [deployment](deployment-architecture.md).

```mermaid
flowchart LR
 U[Creator or reviewer] --> B[Browser editor]
 B --> API[API modular monolith]
 B --> OBJ[Private object storage via scoped URLs]
 API --> DB[(PostgreSQL)]
 API --> Q[Durable queue]
 Q --> W[Isolated media workers]
 Q --> AI[AI adapters]
 W --> OBJ
 AI --> P[External providers, governed]
 API --> ID[Identity provider]
```

All components are proposed. Browser holds ephemeral state and authorized proxy data; API owns authorization and transactions; worker processes isolated media against immutable snapshots. External speech/AI providers receive only approved minimal inputs. No browser or third-party provider has direct database access. Threat boundaries: public ingress, tenant-scoped application, worker sandbox and provider egress. Scope and assumptions are in [governance](../00-governance/assumptions-and-open-decisions.md).
