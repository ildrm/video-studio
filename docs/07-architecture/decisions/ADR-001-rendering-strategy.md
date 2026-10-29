# ADR-001: Cloud rendering

Status: proposed • Owner: principal architect • Review: security, product and subsystem leads.

## Decision

Use cloud FFmpeg workers for final output; browser preview uses proxies.

## Alternatives and consequences

Browser-only rendering limits codec availability, resource control and parity; isolated cloud processing costs compute and egress. Audit codecs and licensing per build.

## Validation

Phase 0 must run representative prototypes, security review and operational cost tests before approval. This is a design decision, not a claim of deployed behavior.
