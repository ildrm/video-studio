import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import type { IncomingMessage } from 'node:http';
import { pool, digest, HttpError } from './db.js';
import { LocalAuthAdmission } from './auth-limits.js';
const scrypt = promisify(scryptCallback);
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
const SESSION_SECRET: string = secret;
const admission = new LocalAuthAdmission();
function admit(req: IncomingMessage, email: string): () => void {
  const hash = (value: string) => createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
  // Forwarded headers are untrusted in the local adapter; use the actual connection.
  return admission.enter(hash(req.socket.remoteAddress ?? 'unknown'), hash(email));
}
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) throw new Error('Production identity provider is not implemented; refusing to start in production');
export const cookieName = isProduction ? '__Host-studio-session' : 'studio_session';
export type User = { id:string; email:string; displayName:string; emailVerified:boolean };
export function csrfFor(token: string): string { return createHmac('sha256', SESSION_SECRET).update(`csrf:${token}`).digest('hex'); }
function rawCookie(req: IncomingMessage): string | undefined {
  const entry = (req.headers.cookie ?? '').split(';').map(p => p.trim()).find(p => p.startsWith(cookieName + '='));
  const value = entry?.slice(cookieName.length + 1); return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
export function ensureOrigin(req: IncomingMessage): void {
  const allowed = process.env.APP_ORIGIN ?? 'http://localhost:3000';
  if (req.headers.origin !== allowed) throw new HttpError(403, 'ORIGIN_DENIED', 'Request origin is not permitted.');
}
export async function requireSession(req: IncomingMessage, mutate = false): Promise<{ user: User; token: string; expiresAt: string }> {
  // Existing local sessions must not remain usable when the adapter is disabled.
  localEnabled();
  const token = rawCookie(req);
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  const r = await pool.query(`SELECT u.id,u.email,u.display_name,u.email_verified,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()`, [digest(token)]);
  if (!r.rowCount) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  if (mutate) {
    ensureOrigin(req);
    const supplied = req.headers['x-csrf-token'];
    const expected = csrfFor(token);
    if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
      throw new HttpError(403, 'CSRF_INVALID', 'Request verification failed.');
  }
  const row = r.rows[0];
  return { user: {id:row.id,email:row.email,displayName:row.display_name,emailVerified:row.email_verified}, token, expiresAt:row.expires_at.toISOString() };
}
function localEnabled(): void {
  if (process.env.NODE_ENV !== 'development' || process.env.AUTH_LOCAL_ENABLED !== 'true') throw new HttpError(503, 'IDENTITY_UNCONFIGURED', 'Identity provider is not configured.');
}
function credentials(value: any): { email:string; password:string; displayName:string } {
  const email = typeof value?.email === 'string' ? value.email.trim().toLowerCase() : '';
  const password = typeof value?.password === 'string' ? value.password : '';
  const displayName = typeof value?.displayName === 'string' ? value.displayName.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || Buffer.byteLength(password) > 256)
    throw new HttpError(400, 'INVALID_CREDENTIALS', 'Enter a valid email and a password of 12–256 bytes.');
  return { email, password, displayName };
}
async function passwordHash(password: string, salt: string): Promise<string> { return (await scrypt(password, salt, 64) as Buffer).toString('hex'); }
export async function register(req: IncomingMessage, body: unknown) {
  localEnabled(); ensureOrigin(req);
  const {email,password,displayName} = credentials(body);
  if (!displayName || displayName.length > 200) throw new HttpError(400, 'INVALID_NAME', 'Enter a display name.');
  const release = admit(req,email);
  try {
  const salt = randomBytes(16).toString('hex'), hash = await passwordHash(password, salt), id = randomUUID();
  try { await pool.query('INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [id,email,displayName,`${salt}:${hash}`]); }
  catch (err: any) { if (err.code === '23505') throw new HttpError(409, 'ACCOUNT_UNAVAILABLE', 'Account cannot be created.'); throw err; }
  return await openSession({id,email,displayName,emailVerified:false});
  } finally { release(); }
}
export async function login(req: IncomingMessage, body: unknown) {
  localEnabled(); ensureOrigin(req);
  const {email,password} = credentials(body);
  const release = admit(req,email);
  try {
  const result = await pool.query('SELECT id,email,display_name,password_hash,email_verified FROM users WHERE lower(email)=lower($1)', [email]);
  const row = result.rows[0]; const [salt, stored] = row?.password_hash?.split(':') ?? ['00000000000000000000000000000000','0'.repeat(128)];
  const actual = await passwordHash(password, salt);
  if (!row || stored.length !== actual.length || !timingSafeEqual(Buffer.from(actual),Buffer.from(stored)))
    throw new HttpError(401,'INVALID_LOGIN','Email or password is incorrect.');
  return await openSession({id:row.id,email:row.email,displayName:row.display_name,emailVerified:row.email_verified});
  } finally { release(); }
}
async function openSession(user: User) {
  const token = randomBytes(32).toString('hex'), expiresAt = new Date(Date.now()+86400000).toISOString();
  await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [digest(token),user.id,expiresAt]);
  const secure = isProduction ? '; Secure' : '';
  return { payload:{ user, csrfToken:csrfFor(token), expiresAt }, cookie:`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}` };
}
export async function logout(token:string) { await pool.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1', [digest(token)]); }
