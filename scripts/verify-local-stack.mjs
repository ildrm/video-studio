// Integration smoke for a disposable local stack. This does not drive the browser UI.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const timedFetch = (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(30000) });
const base = new URL(process.env.VERIFY_BASE_URL || "http://localhost:3001");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) || base.protocol !== "http:") throw new Error("Verification is restricted to a disposable local HTTP stack.");
const fixture = process.env.VERIFY_MEDIA_FIXTURE;
if (!fixture) throw new Error("Set VERIFY_MEDIA_FIXTURE to a small synthetic, Rec.709-tagged video.");
const video = await readFile(fixture);
assert.ok(video.length > 0 && video.length <= 5 * 1024 * 1024, "Use a synthetic fixture of at most 5 MiB.");
const hash = value => createHash("sha256").update(value).digest("hex");
let cookie = "", csrf = "";
async function call(path, method = "GET", body, extra = {}) {
  const response = await timedFetch(new URL(`/v1${path}`, base), {
    method, headers: { Origin: base.origin, ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${payload?.error?.code || "unexpected response"}`);
  return { response, payload };
}
async function waitJob(workspace, id) {
  for (let count = 0; count < 300; count++) {
    const { payload } = await call(`/workspaces/${workspace}/jobs/${id}`);
    if (payload.state === "completed") return payload;
    if (["failed", "cancelled"].includes(payload.state)) throw new Error(`Media job ${payload.state}: ${payload.errorCode}`);
    await delay(200);
  }
  throw new Error("Media job did not finish within 60 seconds.");
}
const home = await timedFetch(base);
assert.equal(home.status, 200);
assert.equal(home.headers.get("x-frame-options"), "DENY");
assert.equal(home.headers.get("x-content-type-options"), "nosniff");
assert.match(home.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
const created = await call("/auth/register", "POST", { email: `review-${randomUUID()}@example.invalid`, password: randomUUID(), displayName: "Synthetic review" });
cookie = created.response.headers.get("set-cookie").split(";")[0]; csrf = created.payload.csrfToken;
const { payload: workspace } = await call("/workspaces", "POST", { name: "Disposable verification" }, { "Idempotency-Key": randomUUID() });
const scope = `/workspaces/${workspace.id}`;
let result = await call(`${scope}/projects`, "POST", { name: "Caption round trip", canvas: { width: 1080, height: 1080, frameRate: { num: 30, den: 1 }, backgroundColor: "#000000ff", workingColorSpace: "rec709-sdr" } }, { "Idempotency-Key": randomUUID() });
const project = result.payload, projectPath = `${scope}/projects/${project.id}`;
result = await call(`${scope}/uploads`, "POST", { filename: "synthetic.mp4", sizeBytes: video.length, sha256: hash(video) }, { "Idempotency-Key": randomUUID() });
const upload = result.payload;
result = await call(`${scope}/uploads/${upload.id}/parts`, "POST", { partNumber: 1, sha256: hash(video) });
const partURL = new URL(result.payload.url);
assert.equal(partURL.origin, base.origin);
const part = await timedFetch(partURL, { method: "PUT", headers: { ...result.payload.headers, Origin: base.origin, Cookie: cookie, "X-CSRF-Token": csrf }, body: video });
assert.equal(part.status, 200);
result = await call(`${scope}/uploads/${upload.id}/complete`, "POST", { parts: [await part.json()] }, { "Idempotency-Key": randomUUID() });
await waitJob(workspace.id, result.payload.id);
const { payload: assets } = await call(`${scope}/assets`);
const asset = assets.items.find(item => item.sha256 === hash(video));
assert.equal(asset.kind, "video"); assert.equal(asset.thumbnailAvailable, true);
const { payload: font } = await call(`${scope}/fonts`, "POST", { fontId: "dejavu-sans" }, { "Idempotency-Key": randomUUID() });
assert.equal(font.kind, "font"); assert.match(font.metadata.licenseText, /Bitstream/);
const rev = await call(`${projectPath}/revision`);
const doc = rev.payload.document, sequence = doc.sequences.find(item => item.id === doc.activeSequenceId);
const metadata = asset.metadata.video, [num, den] = metadata.timeBase.split("/").map(Number);
const durationTick = 240000, sourceDuration = den / num;
assert.ok(Number.isSafeInteger(sourceDuration));
assert.ok(Number(metadata.durationPts) >= sourceDuration, "Use a fixture of at least one second.");
doc.assets = [asset, font].map(item => ({ assetId: item.id, versionId: item.versionId, kind: item.kind, sha256: item.sha256, status: "ready" }));
sequence.durationTick = durationTick;
const transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0, opacity: 1 };
sequence.tracks = [{ id: randomUUID(), kind: "video", order: 0, locked: false, muted: false, solo: false, visible: true, clips: [{ id: randomUUID(), type: "media", assetVersionId: asset.versionId, startTick: 0, durationTick, sourceRange: { inPts: metadata.startPts, outPts: metadata.startPts + sourceDuration, timeBase: { num, den } }, playbackRate: { num: 1, den: 1 }, sourceAudio: { enabled: true, gainDb: -6 }, transform, effects: [], keyframes: [] }] },
  { id: randomUUID(), kind: "caption", order: 1, locked: false, muted: false, solo: false, visible: true, clips: [{ id: randomUUID(), type: "caption", startTick: 0, durationTick: 120000, text: "Review: مرحبا % literal", language: "en", style: { fontAssetVersionId: font.versionId, fontSizePx: 54, color: "#ffffffff", align: "center", direction: "auto", outlinePx: 3, outlineColor: "#000000ff" }, transform: { ...transform, x: .5, y: .8 } }] }];
await call(`${projectPath}/validate`, "POST", { document: doc });
const saved = await call(`${projectPath}/revision`, "PUT", { document: doc }, { "If-Match": rev.response.headers.get("etag"), "Idempotency-Key": randomUUID() });
result = await call(`${projectPath}/renders`, "POST", { revision: saved.payload.revision, presetId: "square-sdr-mp4", presetVersion: 1 }, { "Idempotency-Key": randomUUID() });
const job = await waitJob(workspace.id, result.payload.id);
const { payload: exports } = await call(`${projectPath}/exports`);
const artifact = exports.items.find(item => item.jobId === job.id);
assert.equal(artifact.state, "available");
const { payload: grant } = await call(`${scope}/exports/${artifact.id}/download`, "POST", {});
const outputURL = new URL(grant.url); assert.equal(outputURL.origin, base.origin);
const range = await timedFetch(outputURL, { headers: { Cookie: cookie, Range: "bytes=0-31" } });
assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 32);
const download = await timedFetch(outputURL, { headers: { Cookie: cookie } });
assert.equal(download.status, 200);
const output = Buffer.from(await download.arrayBuffer());
assert.equal(output.length, artifact.sizeBytes); assert.equal(hash(output), artifact.sha256);
if (process.env.VERIFY_OUTPUT) await writeFile(process.env.VERIFY_OUTPUT, output);
await call(projectPath, "PATCH", { name: "Reviewed project" }, { "Idempotency-Key": randomUUID() });
const { payload: duplicate } = await call(`${projectPath}/duplicate`, "POST", { name: "Reviewed copy" }, { "Idempotency-Key": randomUUID() });
assert.equal(duplicate.revision, 0);
const { payload: copied } = await call(`${scope}/projects/${duplicate.id}/revision`);
assert.equal(copied.document.projectId, duplicate.id); assert.equal(copied.document.sequences[0].tracks[1].clips[0].text, sequence.tracks[1].clips[0].text);
await call(projectPath, "PATCH", { archived: true }, { "Idempotency-Key": randomUUID() });
const { payload: archived } = await call(`${scope}/projects?archived=true&q=Reviewed`);
assert.ok(archived.items.some(item => item.id === project.id));
await call(projectPath, "PATCH", { archived: false }, { "Idempotency-Key": randomUUID() });
await call("/session", "DELETE");
assert.equal((await timedFetch(outputURL, { headers: { Cookie: cookie } })).status, 401);
console.log(JSON.stringify({ stack: "passed", upload: "real", captions: "persisted and rendered", download: "checksum and byte range verified", lifecycle: "rename/copy/archive/restore", revokedSession: "denied", outputBytes: output.length }));
