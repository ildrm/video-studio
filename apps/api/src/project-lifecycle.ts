import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { User } from './auth.js';
import { digest, HttpError, idempotent } from './db.js';
import { header, json, name, send, stable, uuid } from './http.js';
import { authorizedRead, lockedMembership, membership, validateDocument } from './projects.js';

export function projectShape(row: any) {
  return { id: row.id, workspaceId: row.workspace_id, name: row.name, revision: row.current_revision,
    createdAt: row.created_at.toISOString(), archivedAt: row.archived_at?.toISOString() ?? null };
}

/** Metadata actions serialize with revision saves and render admission on the project row. */
export async function handleProjectLifecycle(req: IncomingMessage, res: ServerResponse, url: URL, user: User): Promise<boolean> {
  const route = url.pathname.match(/^\/v1\/workspaces\/([^/]+)\/projects\/([^/]+)(?:\/(duplicate|validate))?$/);
  if (!route || !uuid(route[1]!) || !uuid(route[2]!)) return false;
  const [, wid, pid, action] = route as [string, string, string, string | undefined];
  const method = req.method ?? 'GET';
  if (!(method === 'PATCH' && !action) && !(method === 'POST' && ['duplicate', 'validate'].includes(action ?? ''))) return false;
  await membership(wid, user.id);
  const body = await json(req);
  if (action === 'validate') {
    const currentRevision = await authorizedRead(wid, user.id, async db => {
      const current = await db.query('SELECT current_revision FROM projects WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL AND archived_at IS NULL FOR SHARE', [wid, pid]);
      if (!current.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Resource not found.');
      await validateDocument(body.document, wid, pid, body.document?.revision, db);
      return current.rows[0].current_revision;
    });
    send(res, 200, { valid: true, currentRevision });
    return true;
  }
  if (action === 'duplicate') {
    if (Object.keys(body).some(k => k !== 'name')) throw new HttpError(400, 'INVALID_PROJECT_UPDATE', 'Only the new project name is accepted.');
    name(body.name);
  } else {
    const keys = Object.keys(body);
    if (!keys.length || keys.some(k => !['name', 'archived'].includes(k)) || ('archived' in body && typeof body.archived !== 'boolean'))
      throw new HttpError(400, 'INVALID_PROJECT_UPDATE', 'Provide a name or archive state.');
    if ('name' in body) name(body.name);
  }
  const out = await idempotent(user.id, `${method}:${url.pathname}`, header(req, 'idempotency-key'), digest(stable(body)), async db => {
    await lockedMembership(db, wid, user.id);
    const source = await db.query('SELECT * FROM projects WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE', [wid, pid]);
    if (!source.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Resource not found.');
    const row = source.rows[0];
    if (action === 'duplicate') {
      if (row.archived_at) throw new HttpError(409, 'PROJECT_ARCHIVED', 'Restore this project before duplicating it.');
      const revision = await db.query('SELECT document FROM project_revisions WHERE workspace_id=$1 AND project_id=$2 AND revision=$3', [wid, pid, row.current_revision]);
      if (!revision.rowCount) throw new Error('Current project revision is missing');
      const id = randomUUID(), document = { ...revision.rows[0].document, projectId: id, revision: 0 };
      const inserted = await db.query('INSERT INTO projects(workspace_id,id,name) VALUES($1,$2,$3) RETURNING *', [wid, id, name(body.name)]);
      await db.query('INSERT INTO project_revisions(workspace_id,project_id,revision,document) VALUES($1,$2,0,$3)', [wid, id, JSON.stringify(document)]);
      return { status: 201, payload: projectShape(inserted.rows[0]), headers: { Location: `/v1/workspaces/${wid}/projects/${id}` } };
    }
    const updated = await db.query(`UPDATE projects SET name=$3, archived_at=CASE WHEN $4::boolean IS NULL THEN archived_at WHEN $4 THEN COALESCE(archived_at,now()) ELSE NULL END
      WHERE workspace_id=$1 AND id=$2 RETURNING *`, [wid, pid, 'name' in body ? name(body.name) : row.name, 'archived' in body ? body.archived : null]);
    return { status: 200, payload: projectShape(updated.rows[0]) };
  }, db => lockedMembership(db, wid, user.id));
  send(res, out.status, out.payload, out.headers);
  return true;
}
