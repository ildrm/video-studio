# ADR-002: Project model and timebase

Status: proposed • Owner: principal architect • Review: security, product and subsystem leads.

## Decision

Use versioned immutable JSON revisions, rational FPS and integer 240000 ticks/second; intervals are half-open.

## Alternatives and consequences

Floating point seconds drift; arbitrary frame/sample rates require rational conversion and defined rounding. Keep source PTS for variable frame rate and test long timelines.

## Validation

Phase 0 must run representative prototypes, security review and operational cost tests before approval. This is a design decision, not a claim of deployed behavior.
