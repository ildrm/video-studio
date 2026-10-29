import test from 'node:test';
import assert from 'node:assert/strict';
import { newUploadAttempt, uploadFile } from '../lib/media.ts';

const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
test('an uncertain completion is retried with the same idempotency key and manifest',async()=>{
  const originalFetch=globalThis.fetch,originalWindow=globalThis.window;
  const parts=[],completeKeys=[],completeBodies=[];let createCalls=0,partPuts=0;
  globalThis.window={location:{origin:'http://localhost:3000'}};
  globalThis.fetch=async (url,init={})=>{
    const path=String(url),method=init.method||'GET';
    if(path.endsWith('/uploads')&&method==='POST'){createCalls++;return json({id:'upload-1',partSize:3,partCount:2,assetId:null});}
    if(path.endsWith('/uploads/upload-1/parts')&&method==='GET')return json({items:parts,nextCursor:null});
    if(path.endsWith('/uploads/upload-1/parts')&&method==='POST'){const b=JSON.parse(init.body);return json({method:'PUT',url:`http://localhost:3000/part/${b.partNumber}`,headers:{'X-Part-Hash':b.sha256}});}
    if(path.includes('/part/')&&method==='PUT'){partPuts++;const n=Number(path.split('/').at(-1)),sha=init.headers['X-Part-Hash'];const p={partNumber:n,etag:sha,sha256:sha,sizeBytes:init.body.byteLength};parts.push(p);return json(p);}
    if(path.endsWith('/complete')&&method==='POST'){completeKeys.push(new Headers(init.headers).get('Idempotency-Key'));completeBodies.push(init.body);if(completeKeys.length===1)throw new TypeError('connection lost after commit');return json({id:'job-1',state:'queued'},202);}
    throw new Error(`Unexpected ${method} ${path}`);
  };
  try{
    const attempt=newUploadAttempt(new File(['abcdef'],'fixture.mp4',{type:'video/mp4'}));const signal=new AbortController().signal;
    await assert.rejects(uploadFile('w',attempt,'csrf',signal,()=>{},()=>{}),/connection lost/);
    const result=await uploadFile('w',attempt,'csrf',signal,()=>{},()=>{});
    assert.equal(result.job.id,'job-1');assert.equal(createCalls,1);assert.equal(partPuts,2);assert.equal(completeKeys[0],completeKeys[1]);assert.equal(completeBodies[0],completeBodies[1]);
  }finally{globalThis.fetch=originalFetch;globalThis.window=originalWindow;}
});
test('an aborted upload does not create a server session',async()=>{
  const originalFetch=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error('must not send');};
  try{const controller=new AbortController();controller.abort();const attempt=newUploadAttempt(new File(['a'],'x.mp4'));await assert.rejects(uploadFile('w',attempt,'csrf',controller.signal,()=>{},()=>{}),{name:'AbortError'});assert.equal(requests,0);}finally{globalThis.fetch=originalFetch;}
});

test('retry reconciles uploaded parts and sends only the missing part',async()=>{
  const previousFetch=globalThis.fetch,previousWindow=globalThis.window;globalThis.window={location:{origin:'http://localhost:3000'}};
  const parts=[];const attempts=[];let failOnce=true;
  globalThis.fetch=async(url,init={})=>{
    const path=String(url),method=init.method||'GET';
    if(path.endsWith('/uploads')&&method==='POST')return json({id:'upload-2',partSize:3,partCount:2,assetId:null});
    if(path.endsWith('/uploads/upload-2/parts')&&method==='GET')return json({items:parts,nextCursor:null});
    if(path.endsWith('/uploads/upload-2/parts')&&method==='POST'){const b=JSON.parse(init.body);return json({method:'PUT',url:`http://localhost:3000/part/${b.partNumber}`,headers:{'X-Part-Hash':b.sha256}});}
    if(path.includes('/part/')&&method==='PUT'){const n=Number(path.split('/').at(-1));attempts.push(n);if(n===2&&failOnce){failOnce=false;throw new TypeError('network interrupted');}const sha=init.headers['X-Part-Hash'],part={partNumber:n,etag:sha,sha256:sha,sizeBytes:init.body.byteLength};parts.push(part);return json(part);}
    if(path.endsWith('/complete')&&method==='POST')return json({id:'job-2',state:'queued'},202);
    throw Error(`Unexpected ${method} ${path}`);
  };
  try{const attempt=newUploadAttempt(new File(['abcdef'],'fixture.mp4'));const signal=new AbortController().signal;await assert.rejects(uploadFile('w',attempt,'csrf',signal,()=>{},()=>{}),/interrupted/);const result=await uploadFile('w',attempt,'csrf',signal,()=>{},()=>{});assert.equal(result.job.id,'job-2');assert.deepEqual(attempts,[1,2,2]);}
  finally{globalThis.fetch=previousFetch;globalThis.window=previousWindow;}
});
