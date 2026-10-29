# Database design

Status: proposed • Owner: database architect • Related: PRJ-002, SEC-001, OPS-001. Dependencies: [ERD](domain-model-and-erd.md), [schema](../03-frontend/canonical-editor-state-and-schema.md).

Users and organizations are global identities; workspace-scoped tables use workspace_id. UUID primary keys, created_at/updated_at, optional deleted_at and explicit foreign keys apply. Use unique `(workspace_id,id)` keys on scoped parents and composite child foreign keys, not independent workspace/project columns that can disagree.

| Table | Required key/constraint/index |
|---|---|
| membership | unique(workspace_id,user_id), role/scope, revoked_at; invitation tokens stored hashed with expiry. Project-scoped grants are separate rows scoped to project. |
| project | FK workspace; unique(workspace_id,id), current_revision; index(workspace_id,deleted_at,created_at,id). |
| project_revision | PK(workspace_id,project_id,revision), composite FK project, immutable JSONB/content_hash; transaction inserts revision+1 and compare-and-swaps project.current_revision. |
| media_asset / asset_version | Composite FK workspace/asset; immutable object version and SHA-256. Ready version requires verified content hash; uniqueness does not enable cross-tenant deduplication. |
| upload_session | workspace, actor, state, expected bytes/hash, opaque key, expiry and object multipart ID; constrained unique completion/asset version. |
| job / render_snapshot | workspace, actor, project/revision FKs, snapshot hash, policy/build/preset; state, attempt, fencing_token, lease_expires_at, available_at. Index(state,available_at) and (workspace_id,created_at,id). |
| render_artifact | Unique(job_id,logical_output), immutable attempt object key/checksum and verified_at; manifest promotion only under valid lease/state. |
| outbox_event | Unique aggregate/event sequence, committed with state; delivery_at tracked independently from source transaction. |
| idempotency_record | Unique(actor_id,scope,method,path,key_hash), request_hash incl. precondition, result reference and expiry; no raw token or signed URL caching. |
| usage_record / reservation | Immutable unique(workspace_id,source_type,source_id,meter), amount/unit; attempt cost source IDs differ from logical customer-charge IDs. Atomic admission and reconciliation. |
| share_link / comment | workspace/project/revision FK, artifact FK and validated same revision; hashed token, mandatory expiry, revoked_at; comment anchors revision/sequence/tick. |
| notification / audit_event | Notification user/event dedup key; audit append-only, content-free, scoped access and retention. |

Sequences/tracks/clips/effects live inside authoritative revision JSON, not competing writable tables. Search projections are rebuildable. Enforce tenant predicates in the application and RLS as defense in depth. Runtime roles must be neither superuser, table owner nor BYPASSRLS; tenant context is transaction-local and reset safely with connection pooling. FORCE ROW LEVEL SECURITY on applicable tables, dedicated migration/maintenance roles, and negative tests are required. RLS does not protect every operation and does not replace composite keys. See [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Encrypt transport/storage and restrict content fields; not every ordinary column needs application-layer encryption. Expand/backfill/verify/contract migrations retain old readers and avoid destructive rollback. Backups preserve object-version references and restore keys. Acceptance: simultaneous saves yield one success/one 412; foreign-scope composite references fail; pooled tenant context cannot leak; logical billing events deduplicate despite retried attempts.
