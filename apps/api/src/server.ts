import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pool, digest, HttpError, idempotent } from './db.js';
import { requireSession, register, login, logout, csrfFor, cookieName } from './auth.js';
import { json, send, fail, header, stable, uuid, name, paging, cursor } from './http.js';
import { membership, lockedMembership, authorizedRead, initialDocument, validateCanvas, validateDocument } from './projects.js';
import { handleMedia, startMediaWorker, stopMediaWorker } from './media.js';
import { handleProjectLifecycle, projectShape } from './project-lifecycle.js';

const port = Number(process.env.PORT ?? 4000), host = process.env.API_HOST ?? '127.0.0.1';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured');
const server = createServer(async (req,res) => {
  try {
    const method=req.method ?? 'GET'; const u=new URL(req.url ?? '/', 'http://internal'); const path=u.pathname; const m=(r:RegExp)=>path.match(r);
    if(method==='GET' && path==='/health') { await pool.query('SELECT 1'); return send(res,200,{status:'ok',database:'ok'}); }
    if(method==='POST' && path==='/v1/auth/register') { const out=await register(req,await json(req)); return send(res,201,out.payload,{'Set-Cookie':out.cookie}); }
    if(method==='POST' && path==='/v1/auth/login') { const out=await login(req,await json(req)); return send(res,200,out.payload,{'Set-Cookie':out.cookie}); }
    const session=await requireSession(req, !['GET','HEAD'].includes(method)); const user=session.user;
    if(method==='GET' && path==='/v1/session') return send(res,200,{user,csrfToken:csrfFor(session.token),expiresAt:session.expiresAt});
    if(method==='DELETE' && path==='/v1/session') { await logout(session.token); return send(res,204,undefined,{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`}); }
    if(method==='GET' && path==='/v1/users/me') return send(res,200,user);
    if(method==='GET' && path==='/v1/workspaces') {
      const scope=`workspaces:${user.id}`,page=paging(u,scope);const r=await pool.query("SELECT w.id,w.name,w.created_at,w.created_at::text AS sort_at FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=$1 AND m.revoked_at IS NULL AND m.role='owner' AND ($2::timestamptz IS NULL OR (w.created_at,w.id)>($2::timestamptz,$3::uuid)) ORDER BY w.created_at,w.id LIMIT $4",[user.id,page.after?.time??null,page.after?.id??null,page.limit+1]);const rows=r.rows.slice(0,page.limit);
      return send(res,200,{items:rows.map(x=>({id:x.id,name:x.name,createdAt:x.created_at.toISOString()})),nextCursor:r.rows.length>page.limit?cursor(scope,rows[rows.length-1]):null});
    }
    if(method==='POST' && path==='/v1/workspaces') {
      const body=await json(req), n=name(body.name), scope='POST:/v1/workspaces';
      const out=await idempotent(user.id,scope,header(req,'idempotency-key'),digest(stable(body)),async db=>{
        const id=randomUUID();const r=await db.query('INSERT INTO workspaces(id,name) VALUES($1,$2) RETURNING id,name,created_at',[id,n]);
        await db.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')",[id,user.id]);const w=r.rows[0];
        return {status:201,payload:{id:w.id,name:w.name,createdAt:w.created_at.toISOString()},headers:{Location:`/v1/workspaces/${id}`}};
      });return send(res,out.status,out.payload,out.headers);
    }
    if(await handleProjectLifecycle(req,res,u,user)) return;
    const wp=m(/^\/v1\/workspaces\/([^/]+)\/projects$/);
    if(wp && uuid(wp[1]!)) {
      const wid=wp[1]!; await membership(wid,user.id);
      if(method==='GET') {const rawArchived=u.searchParams.get('archived');if(rawArchived!==null&&!['true','false'].includes(rawArchived))throw new HttpError(400,'INVALID_FILTER','Archive filter must be true or false.');const archived=rawArchived==='true',q=(u.searchParams.get('q')??'').trim();if(q.length>200)throw new HttpError(400,'INVALID_FILTER','Search is limited to 200 characters.');const scope=`projects:v2:${user.id}:${wid}:${archived}:${q}`,page=paging(u,scope);const r=await authorizedRead(wid,user.id,db=>db.query('SELECT *,created_at::text AS sort_at FROM projects WHERE workspace_id=$1 AND deleted_at IS NULL AND (archived_at IS NOT NULL)=$2 AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid)) AND position(lower($5) in lower(name))>0 ORDER BY created_at DESC,id DESC LIMIT $6',[wid,archived,page.after?.time??null,page.after?.id??null,q,page.limit+1]));const rows=r.rows.slice(0,page.limit);return send(res,200,{items:rows.map(projectShape),nextCursor:r.rows.length>page.limit?cursor(scope,rows[rows.length-1]):null});}
      if(method==='POST') {const body=await json(req),n=name(body.name);validateCanvas(body.canvas);const out=await idempotent(user.id,`POST:${path}`,header(req,'idempotency-key'),digest(stable(body)),async db=>{
        await lockedMembership(db,wid,user.id);const pid=randomUUID(),doc=initialDocument(pid,body.canvas);
        const r=await db.query('INSERT INTO projects(workspace_id,id,name) VALUES($1,$2,$3) RETURNING *',[wid,pid,n]);
        await db.query('INSERT INTO project_revisions(workspace_id,project_id,revision,document) VALUES($1,$2,0,$3)',[wid,pid,JSON.stringify(doc)]);const p=r.rows[0];
        return {status:201,payload:projectShape(p),headers:{Location:`${path}/${pid}`}};
      }, db=>lockedMembership(db,wid,user.id));return send(res,out.status,out.payload,out.headers);}
    }
    const project=m(/^\/v1\/workspaces\/([^/]+)\/projects\/([^/]+)(?:\/(revision|revisions\/\d+))?$/);
    if(project && uuid(project[1]!) && uuid(project[2]!)) {
      const wid=project[1]!,pid=project[2]!,suffix=project[3];await membership(wid,user.id);
      if(method==='GET' && !suffix) {const r=await authorizedRead(wid,user.id,db=>db.query('SELECT * FROM projects WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL AND archived_at IS NULL',[wid,pid]));if(!r.rowCount) throw new HttpError(404,'NOT_FOUND','Resource not found.');return send(res,200,projectShape(r.rows[0]));}
      if(method==='GET' && suffix) {const revision=suffix.startsWith('revisions/')?Number(suffix.slice(10)):null;if(revision!==null&&(!Number.isSafeInteger(revision)||revision>2147483647))throw new HttpError(400,'INVALID_REVISION','Invalid revision.');const r=await authorizedRead(wid,user.id,db=>db.query('SELECT r.* FROM projects p JOIN project_revisions r ON r.workspace_id=p.workspace_id AND r.project_id=p.id AND r.revision=COALESCE($3,p.current_revision) WHERE p.workspace_id=$1 AND p.id=$2 AND p.deleted_at IS NULL AND p.archived_at IS NULL',[wid,pid,revision]));if(!r.rowCount) throw new HttpError(404,'NOT_FOUND','Resource not found.');const x=r.rows[0];return send(res,200,{revision:x.revision,document:x.document,createdAt:x.created_at.toISOString()},{ETag:`"rev-${x.revision}"`});}
      if(method==='PUT' && suffix==='revision') {const match=header(req,'if-match');if(!match) throw new HttpError(428,'PRECONDITION_REQUIRED','A revision precondition is required.');const parsed=/^"rev-(\d+)"$/.exec(match);if(!parsed) throw new HttpError(400,'INVALID_PRECONDITION','Invalid revision precondition.');const base=Number(parsed[1]);if(!Number.isSafeInteger(base)) throw new HttpError(400,'INVALID_PRECONDITION','Invalid revision precondition.');
        const body=await json(req);const out=await idempotent(user.id,`PUT:${path}`,header(req,'idempotency-key'),digest(stable(body)+match),async db=>{
          await lockedMembership(db,wid,user.id);const p=await db.query('SELECT current_revision FROM projects WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL AND archived_at IS NULL FOR UPDATE',[wid,pid]);if(!p.rowCount) throw new HttpError(404,'NOT_FOUND','Resource not found.');
          if(p.rows[0].current_revision!==base) throw new HttpError(412,'REVISION_MISMATCH','Reload or resolve the conflicting revision.');await validateDocument(body.document,wid,pid,base,db);
          const doc={...body.document,revision:base+1};const r=await db.query('INSERT INTO project_revisions(workspace_id,project_id,revision,document) VALUES($1,$2,$3,$4) RETURNING created_at',[wid,pid,base+1,JSON.stringify(doc)]);
          await db.query('UPDATE projects SET current_revision=$3 WHERE workspace_id=$1 AND id=$2',[wid,pid,base+1]);return {status:200,payload:{revision:base+1,document:doc,createdAt:r.rows[0].created_at.toISOString()},headers:{ETag:`"rev-${base+1}"`}};
        }, db=>lockedMembership(db,wid,user.id));return send(res,out.status,out.payload,out.headers);
      }
    }
    if(await handleMedia(req,res,u,user)) return;
    throw new HttpError(404,'NOT_FOUND','Resource not found.');
  } catch(error) { if(!res.headersSent) fail(res,error);else res.destroy(); }
});
server.listen(port,host,()=>{startMediaWorker();console.log(JSON.stringify({level:'info',event:'api_listening',host,port}));});
process.on('SIGTERM',()=>server.close(()=>void stopMediaWorker().finally(()=>pool.end())));
