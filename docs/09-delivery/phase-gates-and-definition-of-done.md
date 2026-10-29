# Phase gates and definition of done

**Status:** proposed. **Owner:** product and engineering leads; QA, security, accessibility, privacy and operations approve their areas. No gate has yet passed.

## Universal definition of done

A requirement has a stable ID, owner, scope, accessible design and explicit failure states. Implementation has reviewed code, server authorization and tenant isolation, versioned API/schema and migration/rollback, automated and relevant manual tests, observability, documented limits, cost/abuse controls, support guidance and evidence. A control rendered on screen or a successful subprocess alone is insufficient. Release owner accepts any residual risk explicitly; high severity unresolved security or data-loss defects block release.

| Area | Additional required evidence |
|---|---|
| Product/UX | persona, measurable outcome, edge cases, keyboard/touch/RTL review and error recovery |
| Frontend | supported browser matrix, responsive behavior, state and concurrency tests, accessibility review |
| Backend/API | validated contract, validation/permission tests, migration compatibility and integration tests |
| Media | fixture-based media correctness, sync, output decode/QC, sandbox, failure/cancel cleanup and visual review where needed |
| AI | consent, data destination and cost, provider/version, evaluation by language/cohort, human review/rollback and abuse tests |
| Security | threat review, least privilege, audit, secret handling and resolved critical findings |
| Operations | dashboards, on-call, alerts, rollback, restore exercise, runbooks and SLO evidence |
| Documentation | linked contracts, ownership, known limitations, tested examples and no unsupported claims |

Phase 0 requires signed architecture, licensing, threat model, schema/timebase, benchmark fixtures and unresolved decisions assigned. Phase 1 requires AT-01–AT-07, AT-12, AT-21–AT-25 as applicable, API contract and verified upload-to-download. Phase 2 adds guided workflows, static caption styles, baseline provider safeguards (T02-07), and AT-08, AT-10–AT-13, AT-26. Phase 3 requires advanced edit and media regression evidence. Phase 4 requires codec/HDR/sync capability and golden fixtures. Phase 5 requires AT-13–AT-14 and privacy/provider review. Phase 6 requires all applicable acceptance cases, independent security and accessibility evaluation, verified recovery, measured SLOs, support readiness and legal sign-off. These are minimum gates; each feature also requires its own acceptance tests. See [test catalog](acceptance-test-catalog.md).
