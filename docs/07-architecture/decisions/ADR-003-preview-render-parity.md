# ADR-003: Preview fidelity

Status: proposed • Owner: principal architect • Review: security, product and subsystem leads.

## Decision

Interpret one project model in browser and server, label operations timing-exact, approximate or server-rendered. Timing-exact does not promise pixel identity from lossy proxies.

## Alternatives and consequences

A single runtime everywhere is impractical across browser codecs and fonts. Compare fixtures with declared tolerances; block unrepresented effects only when misleading.

## Validation

Phase 0 must run representative prototypes, security review and operational cost tests before approval. This is a design decision, not a claim of deployed behavior.
