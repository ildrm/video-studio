import pg from 'pg';
import { createHash } from 'node:crypto';
const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
export type Db = pg.PoolClient;
export type Result = { status: number; payload?: unknown; headers?: Record<string,string> };
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export async function transaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const result = await fn(db); await db.query('COMMIT'); return result; }
  catch (err) { await db.query('ROLLBACK'); throw err; } finally { db.release(); }
}
export async function idempotent(actor: string, scope: string, key: string | undefined, hash: string, fn: (db: Db) => Promise<Result>, authorize?: (db: Db) => Promise<void>): Promise<Result> {
  if (!key || key.length < 16 || key.length > 128) throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid idempotency key is required.');
  const kh = digest(key);
  return transaction(async db => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [actor, scope + kh]);
    if (authorize) await authorize(db);
    const old = await db.query('SELECT * FROM idempotency_records WHERE actor_id=$1 AND scope=$2 AND key_hash=$3 AND expires_at>now()', [actor,scope,kh]);
    if (old.rowCount) {
      const row = old.rows[0];
      if (row.request_hash !== hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'The key was used with a different request.');
      return { status: row.status, payload: row.payload, headers: row.headers };
    }
    await db.query('DELETE FROM idempotency_records WHERE actor_id=$1 AND scope=$2 AND key_hash=$3', [actor,scope,kh]);
    const result = await fn(db);
    await db.query('INSERT INTO idempotency_records(actor_id,scope,key_hash,request_hash,status,payload,headers) VALUES($1,$2,$3,$4,$5,$6,$7)', [actor,scope,kh,hash,result.status,JSON.stringify(result.payload ?? null),JSON.stringify(result.headers ?? {})]);
    return result;
  });
}
export class HttpError extends Error { constructor(public status: number, public code: string, message: string, public headers:Record<string,string> = {}) { super(message); } }
