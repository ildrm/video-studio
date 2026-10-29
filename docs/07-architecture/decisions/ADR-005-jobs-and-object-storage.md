# ADR-005: Durable jobs and storage

Status: proposed • Owner: principal architect • Review: security, product and subsystem leads.

## Decision

Use durable at-least-once queue, transactional outbox, leases and fencing; immutable objects and atomic artifact promotion.

## Alternatives and consequences

Exactly-once execution is not assumed. Deduplicate effects, reconcile reservations and clean orphaned attempts.

## Validation

Phase 0 must run representative prototypes, security review and operational cost tests before approval. This is a design decision, not a claim of deployed behavior.
