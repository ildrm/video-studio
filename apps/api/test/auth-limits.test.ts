import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalAuthAdmission } from '../src/auth-limits.js';
import { HttpError } from '../src/db.js';

const limited = (fn: () => unknown, retry: string) => assert.throws(fn, error => error instanceof HttpError && error.status === 429 && error.headers['Retry-After'] === retry);

test('authentication admission bounds concurrency and releases failed work exactly once', () => {
  const limits = new LocalAuthAdmission({ windowMs: 60_000, networkLimit: 30, accountLimit: 10, concurrency: 2, maxBuckets: 10 });
  const one = limits.enter('a','one'), two = limits.enter('b','two');
  limited(() => limits.enter('c','three'), '1');
  one(); one();
  const three = limits.enter('c','three');
  limited(() => limits.enter('d','four'), '1');
  two(); three(); limits.enter('d','four')();
});

test('authentication bursts are limited by account and connection and recover after expiry', () => {
  let now=1000;const limits=new LocalAuthAdmission({windowMs:60_000,networkLimit:3,accountLimit:2,concurrency:2,maxBuckets:20},()=>now);
  limits.enter('one','account')();limits.enter('two','account')();
  limited(()=>limits.enter('three','account'),'60');
  limits.enter('one','other')();limits.enter('one','third')();
  limited(()=>limits.enter('one','fourth'),'60');
  now+=60_000;limits.enter('one','account')();
});

test('authentication admission keeps attacker-controlled bucket cardinality bounded', () => {
  let now=0;const limits=new LocalAuthAdmission({windowMs:1000,networkLimit:10,accountLimit:10,concurrency:2,maxBuckets:2},()=>now);
  limits.enter('one','account')();limited(()=>limits.enter('two','other'),'1');
  now=1000;limits.enter('two','other')();
});
