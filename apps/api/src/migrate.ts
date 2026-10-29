import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool, digest } from './db.js';
const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
const db = await pool.connect();
try {
  // One connection holds the session lock through the full run, including each commit.
  await db.query("SELECT pg_advisory_lock(hashtext('studio-schema-migrations'))");
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  for(const file of (await readdir(dir)).filter(x=>/^\d+_[a-z0-9_]+\.sql$/.test(x)).sort()) {
    const source=await readFile(path.join(dir,file),'utf8'),hash=digest(source);
    const prior=await db.query('SELECT sha256 FROM schema_migrations WHERE filename=$1',[file]);
    if(prior.rowCount){if(prior.rows[0].sha256!==hash)throw new Error(`Previously applied migration changed: ${file}`);continue;}
    // Existing migration files may contain one outer transaction. The runner now owns it
    // so schema changes and their checksum record commit or roll back together.
    const sql=source.replace(/^\s*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'');
    await db.query('BEGIN');
    try{await db.query(sql);await db.query('INSERT INTO schema_migrations(filename,sha256) VALUES($1,$2)',[file,hash]);await db.query('COMMIT');}
    catch(error){await db.query('ROLLBACK');throw error;}
    console.log(`Applied ${file}`);
  }
} finally { await db.query("SELECT pg_advisory_unlock(hashtext('studio-schema-migrations'))").catch(()=>{});db.release();await pool.end(); }
