# ADR-006: AI provider abstraction

Status: proposed • Owner: principal architect • Review: security, product and subsystem leads.

## Decision

Use typed provider adapters with explicit consent, quota, provenance and human approval of edits.

## Alternatives and consequences

A single provider is easier initially but creates lock-in and policy risk. Capabilities differ, so unsupported requests fail explicitly and no model availability is assumed.

## Validation

Phase 0 must run representative prototypes, security review and operational cost tests before approval. This is a design decision, not a claim of deployed behavior.
