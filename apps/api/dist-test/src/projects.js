import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default;
import { pool, transaction, HttpError } from './db.js';
const schemaPath = process.env.PROJECT_SCHEMA_PATH ?? fileURLToPath(new URL('../../../docs/03-frontend/schemas/project-v1.schema.json', import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const projectSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const validateProject = ajv.compile(projectSchema);
const canvasSchema = ajv.compile(projectSchema.$defs.Canvas);
export async function membership(workspaceId, userId, actions = ['owner']) {
    const r = await pool.query('SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 AND revoked_at IS NULL', [workspaceId, userId]);
    if (!r.rowCount || !actions.includes(r.rows[0].role))
        throw new HttpError(404, 'NOT_FOUND', 'Resource not found.');
    return r.rows[0];
}
export function validateCanvas(canvas) {
    if (!canvasSchema(canvas))
        throw new HttpError(400, 'INVALID_CANVAS', 'Invalid canvas settings.');
}
export function initialDocument(projectId, canvas) {
    validateCanvas(canvas);
    const seq = randomUUID(), track = randomUUID();
    const f = canvas.frameRate;
    const durationTick = Math.round(240000 * f.den / f.num);
    return { schemaVersion: 1, projectId, revision: 0, timebase: 240000, canvas, assets: [], activeSequenceId: seq,
        sequences: [{ id: seq, durationTick, tracks: [{ id: track, kind: 'video', order: 0, locked: false, muted: false, solo: false, visible: true, clips: [] }], transitions: [], markers: [] }],
        thumbnail: { width: canvas.width, height: canvas.height, layers: [] }, exportPresets: [] };
}
export async function validateDocument(doc, workspaceId, projectId, baseRevision, db) {
    if (!validateProject(doc))
        throw new HttpError(400, 'INVALID_PROJECT', 'Project document failed schema validation.');
    if (doc.projectId !== projectId || doc.revision !== baseRevision)
        throw new HttpError(400, 'REVISION_BODY_MISMATCH', 'Project or revision does not match the request.');
    if (!doc.sequences.some((s) => s.id === doc.activeSequenceId))
        throw new HttpError(400, 'INVALID_PROJECT', 'Active sequence is missing.');
    const ids = new Set();
    const add = (id) => { if (ids.has(id))
        throw new HttpError(400, 'DUPLICATE_ID', 'Project IDs must be unique.'); ids.add(id); };
    const references = new Map();
    const actual = new Map();
    for (const a of doc.assets) {
        add(a.assetId);
        if (references.has(a.versionId))
            throw new HttpError(400, 'DUPLICATE_ID', 'Asset version appears twice.');
        references.set(a.versionId, a);
    }
    if (references.size) {
        const r = await db.query("SELECT id,version_id,kind,sha256,state,metadata FROM media_assets WHERE workspace_id=$1 AND version_id=ANY($2::uuid[]) AND state<>'deleted' FOR SHARE", [workspaceId, [...references.keys()]]);
        for (const row of r.rows) {
            const a = references.get(row.version_id);
            actual.set(row.version_id, row);
            if (a && (a.assetId !== row.id || a.kind !== row.kind || a.sha256 !== row.sha256 || (a.status === 'ready' && row.state !== 'ready')))
                throw new HttpError(400, 'ASSET_MISMATCH', 'Asset metadata or readiness does not match the workspace.');
        }
        for (const a of doc.assets)
            if (!actual.has(a.versionId) && a.status !== 'unresolved')
                throw new HttpError(400, 'ASSET_UNAVAILABLE', 'An asset is missing or inaccessible.');
    }
    const frameDen = BigInt(240000) * BigInt(doc.canvas.frameRate.den), fpsNum = BigInt(doc.canvas.frameRate.num);
    const aligned = (v) => BigInt(v) * fpsNum % frameDen === 0n;
    for (const seq of doc.sequences) {
        add(seq.id);
        if (!aligned(seq.durationTick))
            throw new HttpError(400, 'FRAME_ALIGNMENT', 'Sequence duration must end at a frame boundary.');
        const orders = new Set(), clips = new Map(), tracks = new Map();
        for (const track of seq.tracks) {
            add(track.id);
            if (orders.has(track.order))
                throw new HttpError(400, 'TRACK_ORDER_DUPLICATE', 'Track order must be unique in the sequence.');
            orders.add(track.order);
            for (const clip of track.clips) {
                add(clip.id);
                clips.set(clip.id, clip);
                tracks.set(clip.id, track.id);
                if (clip.startTick + clip.durationTick > seq.durationTick)
                    throw new HttpError(400, 'CLIP_OUT_OF_BOUNDS', 'Clip exceeds sequence duration.');
                if (track.kind === 'video' && (!aligned(clip.startTick) || !aligned(clip.durationTick)))
                    throw new HttpError(400, 'FRAME_ALIGNMENT', 'Video clips must use output frame boundaries.');
                if (clip.type === 'media') {
                    const reference = references.get(clip.assetVersionId), meta = actual.get(clip.assetVersionId)?.metadata;
                    if (!reference || clip.sourceRange.outPts <= clip.sourceRange.inPts || (track.kind === 'video' && reference.kind !== 'video') || (track.kind === 'audio' && !['audio', 'video'].includes(reference.kind)))
                        throw new HttpError(400, 'INVALID_MEDIA_CLIP', 'Clip references invalid media or source range.');
                    const source = clip.sourceRange, rate = clip.playbackRate;
                    const numerator = (BigInt(source.outPts) - BigInt(source.inPts)) * BigInt(source.timeBase.num) * BigInt(rate.den) * 240000n;
                    const denominator = BigInt(source.timeBase.den) * BigInt(rate.num);
                    const difference = numerator - BigInt(clip.durationTick) * denominator;
                    if ((difference < 0n ? -difference : difference) > denominator)
                        throw new HttpError(400, 'SOURCE_DURATION_MISMATCH', 'Source and timeline durations must agree within one tick.');
                    const stream = (track.kind === 'audio' || reference.kind === 'audio') ? meta?.audio : meta?.video;
                    if (stream?.timeBase) {
                        const parts = String(stream.timeBase).split('/').map(Number), start = stream.startPts, duration = stream.durationPts;
                        if (parts.length !== 2 || !parts.every(Number.isSafeInteger) || parts.some(v => v <= 0) || BigInt(parts[0]) * BigInt(source.timeBase.den) !== BigInt(source.timeBase.num) * BigInt(parts[1]))
                            throw new HttpError(400, 'SOURCE_TIMEBASE_MISMATCH', 'Clip timebase does not match the source.');
                        if (Number.isSafeInteger(start) && Number.isSafeInteger(duration) && (BigInt(source.inPts) < BigInt(start) || BigInt(source.outPts) > BigInt(start) + BigInt(duration)))
                            throw new HttpError(400, 'SOURCE_OUT_OF_BOUNDS', 'Clip range exceeds the source.');
                    }
                    for (const effect of clip.effects)
                        if (effect.type === 'fade' && effect.parameters.inDurationTick + effect.parameters.outDurationTick > clip.durationTick)
                            throw new HttpError(400, 'INVALID_EFFECT', 'Fade durations exceed clip duration.');
                    let prior = -1;
                    const keys = new Set();
                    for (const k of clip.keyframes) {
                        const id = `${k.property}:${k.tick}`;
                        if (k.tick < prior || k.tick > clip.durationTick || keys.has(id))
                            throw new HttpError(400, 'INVALID_KEYFRAME', 'Keyframes must be ordered, unique and within the clip.');
                        prior = k.tick;
                        keys.add(id);
                        if ((k.property === 'opacity' && (k.value < 0 || k.value > 1)) || (['scaleX', 'scaleY'].includes(k.property) && (k.value <= 0 || k.value > 100)) || (['x', 'y'].includes(k.property) && (k.value < -8 || k.value > 8)) || (k.property === 'rotationDeg' && (k.value < -360 || k.value > 360)))
                            throw new HttpError(400, 'INVALID_KEYFRAME', 'Keyframe value is outside the property bounds.');
                    }
                }
                if (clip.style?.fontAssetVersionId && references.get(clip.style.fontAssetVersionId)?.kind !== 'font')
                    throw new HttpError(400, 'ASSET_UNAVAILABLE', 'A referenced font is missing.');
            }
        }
        const transitions = new Map();
        for (const transition of seq.transitions) {
            add(transition.id);
            const pair = `${transition.fromClipId}:${transition.toClipId}`;
            if (!clips.has(transition.fromClipId) || !clips.has(transition.toClipId) || tracks.get(transition.fromClipId) !== tracks.get(transition.toClipId) || transitions.has(pair))
                throw new HttpError(400, 'INVALID_TRANSITION', 'Transition clips are missing, duplicated or on different tracks.');
            transitions.set(pair, transition);
        }
        const used = new Set();
        for (const track of seq.tracks) {
            if (!['video', 'audio', 'caption'].includes(track.kind))
                continue;
            const ordered = [...track.clips].sort((a, b) => a.startTick - b.startTick);
            for (let i = 1; i < ordered.length; i++) {
                const a = ordered[i - 1], b = ordered[i], overlap = a.startTick + a.durationTick - b.startTick;
                if (overlap > 0) {
                    if (track.kind === 'caption')
                        throw new HttpError(400, 'CAPTION_OVERLAP', 'Caption cues cannot overlap on one track.');
                    if (i > 1 && ordered[i - 2].startTick + ordered[i - 2].durationTick > b.startTick)
                        throw new HttpError(400, 'INVALID_TRANSITION', 'Three clips cannot overlap.');
                    const pair = `${a.id}:${b.id}`, transition = transitions.get(pair);
                    if (!transition || transition.durationTick !== overlap || overlap > b.durationTick || overlap > a.durationTick)
                        throw new HttpError(400, 'INVALID_TRANSITION', 'Overlap needs an exactly matching transition.');
                    used.add(pair);
                }
            }
        }
        if (used.size !== transitions.size)
            throw new HttpError(400, 'INVALID_TRANSITION', 'Transition does not match an adjacent overlap.');
        for (const marker of seq.markers) {
            add(marker.id);
            if (marker.tick > seq.durationTick)
                throw new HttpError(400, 'INVALID_MARKER', 'Marker is outside the sequence.');
        }
    }
    for (const layer of doc.thumbnail.layers) {
        add(layer.id);
        if (layer.type === 'media' && !references.has(layer.assetVersionId))
            throw new HttpError(400, 'ASSET_UNAVAILABLE', 'A thumbnail source is missing.');
        if (layer.style?.fontAssetVersionId && references.get(layer.style.fontAssetVersionId)?.kind !== 'font')
            throw new HttpError(400, 'ASSET_UNAVAILABLE', 'A thumbnail font is missing.');
    }
}
export async function lockedMembership(db, workspaceId, userId, actions = ['owner']) {
    const r = await db.query('SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 AND revoked_at IS NULL FOR SHARE', [workspaceId, userId]);
    if (!r.rowCount || !actions.includes(r.rows[0].role))
        throw new HttpError(404, 'NOT_FOUND', 'Resource not found.');
}
export async function authorizedRead(workspaceId, userId, fn) { return transaction(async (db) => { await lockedMembership(db, workspaceId, userId); return fn(db); }); }
//# sourceMappingURL=projects.js.map