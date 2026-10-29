import { request, key } from "./api.ts";

type Operation = { path: string; method: "POST" | "PATCH"; body: unknown };
type Result<T> = { data: T; etag: string | null };
type Sender = typeof request;

/** Keep an uncertain mutation's key until its outcome is known or its inputs change. */
export class MutationJournal {
  private entries = new Map<string, { fingerprint: string; key: string; promise?: Promise<unknown> }>();
  private send: Sender;
  constructor(send: Sender = request) { this.send = send; }

  execute<T>(scope: string, operation: Operation, csrf: string): Promise<Result<T>> {
    const fingerprint = JSON.stringify(operation);
    let entry = this.entries.get(scope);
    if (!entry || entry.fingerprint !== fingerprint) {
      entry = { fingerprint, key: key() };
      this.entries.set(scope, entry);
    }
    if (entry.promise) return entry.promise as Promise<Result<T>>;
    const attempt = entry;
    const promise = this.send<T>(operation.path, {
      method: operation.method,
      headers: { "Idempotency-Key": attempt.key },
      body: JSON.stringify(operation.body),
    }, csrf).then(result => {
      if (this.entries.get(scope) === attempt) this.entries.delete(scope);
      return result;
    }).finally(() => { attempt.promise = undefined; });
    attempt.promise = promise;
    return promise;
  }

  clear() { this.entries.clear(); }
}

export function projectListPath(workspaceId: string, archived: boolean, query: string, cursor?: string | null) {
  const params = new URLSearchParams({ limit: "100" });
  if (archived) params.set("archived", "true");
  if (query.trim()) params.set("q", query.trim());
  if (cursor) params.set("cursor", cursor);
  return `/workspaces/${workspaceId}/projects?${params}`;
}
