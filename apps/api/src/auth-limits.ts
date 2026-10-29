import { HttpError } from './db.js';

type Bucket = { count: number; expiresAt: number };

/** A bounded local-adapter safeguard; deployment-wide admission belongs to the identity gateway. */
export class LocalAuthAdmission {
  private readonly buckets = new Map<string, Bucket>();
  private active = 0;
  constructor(private readonly options = { windowMs: 60_000, networkLimit: 30, accountLimit: 10, concurrency: 4, maxBuckets: 10_000 }, private readonly now = Date.now) {}

  enter(network: string, account: string): () => void {
    const now = this.now();
    for (const [key, bucket] of this.buckets) if (bucket.expiresAt <= now) this.buckets.delete(key);
    const reject = (retry: number): never => { throw new HttpError(429, 'AUTH_RATE_LIMITED', 'Too many sign-in attempts. Try again shortly.', { 'Retry-After': String(Math.max(1, Math.ceil(retry / 1000))) }); };
    if (this.active >= this.options.concurrency) reject(1000);
    const keys = [{ key: `network:${network}`, limit: this.options.networkLimit }, { key: `account:${account}`, limit: this.options.accountLimit }];
    for (const { key, limit } of keys) {
      const bucket = this.buckets.get(key);
      if (bucket && bucket.count >= limit) reject(bucket.expiresAt - now);
    }
    const missing = keys.filter(({ key }) => !this.buckets.has(key)).length;
    if (this.buckets.size + missing > this.options.maxBuckets) reject(this.options.windowMs);
    for (const { key } of keys) {
      const bucket = this.buckets.get(key) ?? { count: 0, expiresAt: now + this.options.windowMs };
      bucket.count++; this.buckets.set(key, bucket);
    }
    this.active++;
    let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }
}
