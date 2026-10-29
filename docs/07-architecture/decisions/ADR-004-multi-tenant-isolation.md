# ADR-004: Tenant isolation

Status: proposed • Owner: principal architect • Review: security, product and subsystem leads.

## Decision

Enforce workspace-scoped authorization in API and workers, with private object storage and workload identities.

## Alternatives and consequences

Shared infrastructure is economical but requires systematic isolation tests, scoped credentials and logging controls. RLS is defense in depth, not sole authorization.

## Validation

Phase 0 must run representative prototypes, security review and operational cost tests before approval. This is a design decision, not a claim of deployed behavior.
