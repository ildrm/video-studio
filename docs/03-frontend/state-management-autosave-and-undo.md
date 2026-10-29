# State, autosave and undo

Status: proposed • Owner: frontend lead • Related: PRJ-002, SEC-001. Depends on [commands](timeline-model-and-editing-commands.md) and [API](../04-backend/api-design-and-contracts.md).

Keep acknowledged immutable server revision, pending local command log and ephemeral UI state separate. Debounce saves for 1 s after a committed command; queue within the [NFR target](../01-product/non-functional-requirements.md). Only one save per project is in flight; coalesce later edits behind it. Explicit Save flushes the queue. Send the exact base document revision, strong If-Match tag and operation idempotency key. A successful response becomes the new base; reapply later pending commands locally.

On 412 preserve local draft and offer reload, save copy, or explicit conflict resolution; never retry with the new ETag automatically. A 409 denotes idempotency/body or other resource-state conflict, not a stale If-Match. On timeout retry the same request/key/precondition until its outcome is known. Authentication is rechecked on replay. Undo submits a new revision based on the current acknowledged state; it does not delete history. History is local to the editing session; reload retains only deliberately persisted recovery history. New edits clear redo.

Use memory by default for unsaved content. Browser storage is not assumed encrypted or private from scripts or a shared device. Optional IndexedDB draft recovery requires a disclosed local-cache setting, scoped account/workspace IDs, bounded retention and clearing on logout/workspace removal; application-managed encryption does not protect against active script compromise. Never store auth tokens or signed media URLs in the draft. On session expiry retain in-memory edits during reauthentication, while preventing a different account from adopting them without an explicit authorized copy. A new login/workspace must not inherit another identity's cache.

Hydration validates schema and authorized references before enabling edits. Migration is server-controlled and retains a prior revision. Render requires an acknowledged save, with conflict and offline states blocking submission. Acceptance: concurrent save, lost response, reconnect, logout, account switch and undo preserve intended work without cross-account disclosure. See AT-03 and AT-23.

Security reference: [OWASP browser storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#storage-apis).
