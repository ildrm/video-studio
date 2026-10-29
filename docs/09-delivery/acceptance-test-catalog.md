# Acceptance test catalog

**Status:** proposed scenarios, not executed. **Owner:** QA lead, with domain and security reviewers. Evidence must include build, fixture digest, environment, operator, results and issue links; failure blocks the relevant gate.

| ID | Given / action | Expected result and evidence |
|---|---|---|
| AT-01 | Two unrelated workspaces; user requests foreign project, asset, render and signed URL | denied without disclosure; server audit records sanitized denial |
| AT-02 | Interrupted multipart upload | resume only missing parts, checksum final original, inspect once, fail safely for malformed data |
| AT-03 | Save twice with same base revision from separate clients | one succeeds, other receives 412 REVISION_MISMATCH and can recover edits; acknowledged revision survives reload |
| AT-04 | Timeline with non-frame-aligned source, rational fps and half-open adjacent ranges | split/trim produces no gap or duplicate at declared rounding boundary and remains in source bounds |
| AT-05 | Request render at revision A, then edit to B | render is from immutable A; output is verified and correct user can download it |
| AT-06 | Worker dies after encoding or lease expires | bounded retry and lease fencing yield at most one published artifact, with no cross-tenant access |
| AT-07 | User requests cancellation at queue, processing and upload stages | if cancel wins, cancelled with subprocess/temporary cleanup and no publication; if completion wins first, return completed and preserve verified artifact; no unverified artifact published |
| AT-08 | Pro project has overlapping layers, keyframes and unsupported Quick controls | mode switch preserves full model; Quick clearly indicates read-only/unsupported elements and cannot silently flatten |
| AT-09 | VFR, rotated, HDR/SDR and missing-audio fixtures | explicit conversion/compatibility, deterministic duration and metadata; unsupported paths report clear error |
| AT-10 | Music and narration at clip boundaries | expected gain/ducking, no unintended discontinuity and measured A/V sync within published tolerances |
| AT-11 | RTL, mixed direction, CJK and emoji caption fixtures | editable timing, correct shaping, fallback, safe areas and output consistent with declared preview fidelity |
| AT-12 | Accessible keyboard-only create/edit/export journey | focus visible, labels announced, alternatives to drag and no inaccessible blocking control; manual evidence |
| AT-13 | AI plan proposes editing and external processing | cost/data destination and actions shown; approval required for every project mutation and governed external dispatch; no arbitrary command or unauthorized asset access; undo restores prior revision |
| AT-14 | Revoked invitation/share token or membership | subsequent API access denied; already issued URLs expire according to policy and revocation limits are disclosed |
| AT-15 | Restore to isolated environment | declared revision and originals restored with checksums, tenant controls and job reconciliation; actual RPO/RTO recorded |
| AT-16 | Fail canary and kill flag | rollout stops, known compatible artifact resumes, no invalid migration rollback, metrics recover |
| AT-17 | Multiple tenants exhaust job quota | fairness and per-tenant limits prevent starvation; sanitized 429/usage guidance; no lost accepted work |
| AT-18 | Incorrect codec, dimensions or failed decode on output | QC fails, artifact is not marked complete or published, failure remains actionable |
| AT-19 | Billing administrator attempts to read a project or alter membership; simultaneous requests consume final quota | Unauthorized access is denied; atomic reservations do not exceed quota; metering is auditable without exposing media. |
| AT-20 | Export and import a versioned project package containing a missing asset, then retry job notification delivery | Import validates schema and preserves an unresolved asset reference for relink; duplicate notification events do not duplicate user-visible notifications. |
| AT-21 | Schema-valid 30-frame 30000/1001 example and 44.1 kHz split fixtures; negative PTS and malformed references | Frame duration is 240240 ticks; shared boundaries use exact rational mapping; invalid references, triple overlap and out-of-bounds keyframes reject atomically. |
| AT-22 | Core API requests/responses, duplicate key, stale/missing ETag, CSRF, pagination and SSE | Typed schema-valid responses; 201/202 include Location; stale If-Match is 412, missing is 428, changed key payload is 409; poll returns JSON and stream returns SSE. |
| AT-23 | Timeout after save commit, queued edits, session expiry, logout and account change | Same request/key resolves once; later edits rebase only on acknowledged response; conflict preserves draft; no other account inherits cached content. |
| AT-24 | Lease expires, cancel races manifest commit, or upload completes before DB crash | Fencing rejects stale writes; one logical output pointer; orphan staging cleaned; no cancelled upload becomes a ready asset. |
| AT-25 | Project editor lists workspace library, contributor edits, org admin promotes self, support requests media | Only explicitly authorized references/actions succeed; scope and membership do not imply content, share or finance privileges. |
| AT-26 | Phase-2 speech submission before consent, quota, region or voice capability is approved | No provider call occurs; supported approved result is a draft artifact, reviewed and attached only through a new revision. |

The [feature-family traceability matrix](epics-user-stories-and-tasks.md#feature-family-traceability) maps all current catalog families to these cases and delivery tasks. Add detailed subfeature-specific expected values and tolerances during Phase 0 and update both documents when scope changes. See [testing strategy](../08-engineering/testing-strategy-and-fixtures.md).
