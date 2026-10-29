import test from "node:test";
import assert from "node:assert/strict";
import { MutationJournal, projectListPath } from "../lib/project-actions.ts";

test("retrying a lost project-creation response reuses admission rather than duplicating it", async () => {
  const keys = [];
  const journal = new MutationJournal(async (_path, init) => {
    keys.push(init.headers["Idempotency-Key"]);
    if (keys.length === 1) throw new TypeError("connection lost after commit");
    return { data: { id: "created-project" }, etag: null };
  });
  const operation = { path: "/workspaces/w/projects", method: "POST", body: { name: "Story" } };
  await assert.rejects(journal.execute("create", operation, "csrf"));
  assert.equal((await journal.execute("create", operation, "new-csrf")).data.id, "created-project");
  assert.equal(keys[0], keys[1]);
  await journal.execute("create", operation, "csrf");
  assert.notEqual(keys[1], keys[2], "a new deliberate creation has its own admission key");
});

test("double submission shares one request and changed payload or account gets a fresh key", async () => {
  const keys = [];
  let finish;
  const journal = new MutationJournal(async (_path, init) => {
    keys.push(init.headers["Idempotency-Key"]);
    await new Promise(resolve => { finish = resolve; });
    return { data: {}, etag: null };
  });
  const operation = { path: "/projects/p", method: "PATCH", body: { name: "One" } };
  const first = journal.execute("rename", operation, "csrf");
  assert.equal(first, journal.execute("rename", operation, "csrf"));
  assert.equal(keys.length, 1);
  finish(); await first;
  const second = journal.execute("rename", { ...operation, body: { name: "Two" } }, "csrf");
  finish(); await second;
  assert.notEqual(keys[0], keys[1]);
  journal.clear();
  const third = journal.execute("rename", operation, "csrf");
  finish(); await third;
  assert.notEqual(keys[1], keys[2]);
});

test("project pagination preserves archive and search filters with URL-safe cursors", () => {
  const path = projectListPath("workspace", true, "  A & B  ", "a+/b=");
  const url = new URL(path, "https://studio.invalid");
  assert.equal(url.searchParams.get("archived"), "true");
  assert.equal(url.searchParams.get("q"), "A & B");
  assert.equal(url.searchParams.get("cursor"), "a+/b=");
});
