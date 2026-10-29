import type { ProjectDocument } from "./api";

const PREFIX = "studio:draft:v1:";
const MAX_BYTES = 2 * 1024 * 1024;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export type RecoveryScope = { userId: string; workspaceId: string; projectId: string };
export type PendingSave = { document: ProjectDocument; etag: string; key: string };
export type RecoveryDraft = { version: 1; scope: RecoveryScope; savedAt: number; baseRevision: number; document: ProjectDocument; pending: PendingSave | null };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
const scopeKey = (scope: RecoveryScope) => `${PREFIX}${scope.userId}:${scope.workspaceId}:${scope.projectId}`;

/** The server validates the document and current asset permissions before restore. */
export function readRecovery(storage: StorageLike, scope: RecoveryScope, now = Date.now()): RecoveryDraft | null {
  const name = scopeKey(scope);
  const raw = storage.getItem(name);
  if (!raw) return null;
  try {
    if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error("Draft exceeds storage limit");
    const value = JSON.parse(raw) as RecoveryDraft;
    if (value.version !== 1 || (value.scope?.userId !== scope.userId || value.scope?.workspaceId !== scope.workspaceId || value.scope?.projectId !== scope.projectId) || !Number.isSafeInteger(value.savedAt) || value.savedAt > now || now - value.savedAt > RETENTION_MS || !Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0 || value.document?.projectId !== scope.projectId || value.document.revision !== value.baseRevision || !value.document.sequences) throw new Error("Invalid draft");
    if (value.pending && (value.pending.document?.projectId !== scope.projectId || !Number.isSafeInteger(value.pending.document.revision) || value.pending.etag !== `"rev-${value.pending.document.revision}"` || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.pending.key))) throw new Error("Invalid pending save");
    return value;
  } catch {
    storage.removeItem(name);
    return null;
  }
}

export function writeRecovery(storage: StorageLike, scope: RecoveryScope, baseRevision: number, document: ProjectDocument, pending: PendingSave | null, now = Date.now()) {
  // No session credentials, signed URLs, media bytes or user profile are cached.
  const value: RecoveryDraft = { version: 1, scope, savedAt: now, baseRevision, document, pending };
  const raw = JSON.stringify(value);
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error("This draft exceeds the 2 MiB local recovery limit. Download it to preserve your changes.");
  storage.setItem(scopeKey(scope), raw);
}

export function removeRecovery(storage: StorageLike, scope: RecoveryScope) { storage.removeItem(scopeKey(scope)); }

export function clearRecoveryForUser(userId: string, storage?: StorageLike): boolean {
  try {
    const cache = storage ?? window.localStorage, prefix = `${PREFIX}${userId}:`;
    for (let i = cache.length - 1; i >= 0; i--) { const name = cache.key(i); if (name?.startsWith(prefix)) cache.removeItem(name); }
    return true;
  } catch { return false; }
}

export function acknowledgeSave(latest: ProjectDocument, pending: PendingSave, acknowledged: { document: ProjectDocument; revision: number }) {
  const hasLaterChanges = JSON.stringify(latest) !== JSON.stringify(pending.document);
  return { document: hasLaterChanges ? { ...latest, revision: acknowledged.revision } : acknowledged.document, dirty: hasLaterChanges };
}
