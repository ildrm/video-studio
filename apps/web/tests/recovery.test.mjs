import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acknowledgeSave, clearRecoveryForUser, readRecovery, removeRecovery, writeRecovery} from '../lib/recovery.ts';
const document=JSON.parse(readFileSync(new URL('../../../docs/03-frontend/examples/project-v1.json',import.meta.url),'utf8'));
const scope={userId:'user-a',workspaceId:'workspace-a',projectId:document.projectId};
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]||null,get length(){return values.size;}};};
test('save acknowledgement preserves edits committed while the request was in flight',()=>{
  const pending={document:structuredClone(document),etag:'"rev-1"',key:'9a37848c-1746-4a11-a52b-3cb764920d03'};
  const later=structuredClone(document);later.canvas.backgroundColor='#123456ff';
  const acknowledged={revision:2,document:{...document,revision:2}};
  const result=acknowledgeSave(later,pending,acknowledged);
  assert.equal(result.dirty,true);assert.equal(result.document.canvas.backgroundColor,'#123456ff');assert.equal(result.document.revision,2);
  assert.deepEqual(acknowledgeSave(document,pending,acknowledged),{document:acknowledged.document,dirty:false});
});
test('recovery is isolated by account, workspace and project and retains exact uncertain save',()=>{
  const store=storage(),pending={document,etag:`"rev-${document.revision}"`,key:'9a37848c-1746-4a11-a52b-3cb764920d03'};
  writeRecovery(store,scope,document.revision,document,pending,1000);
  assert.deepEqual(readRecovery(store,scope,1001).pending,pending);
  assert.equal(readRecovery(store,{...scope,userId:'user-b'},1001),null);
  assert.equal(readRecovery(store,{...scope,workspaceId:'workspace-b'},1001),null);
  assert.equal(readRecovery(store,{...scope,projectId:'project-b'},1001),null);
});
test('expired, malformed and oversized cached drafts are rejected and removed',()=>{
  const store=storage();writeRecovery(store,scope,document.revision,document,null,1000);
  assert.equal(readRecovery(store,scope,1000+8*86400000),null);assert.equal(store.length,0);
  store.setItem('studio:draft:v1:user-a:workspace-a:'+document.projectId,'{bad');assert.equal(readRecovery(store,scope),null);assert.equal(store.length,0);
  const big=structuredClone(document);big.extra='x'.repeat(2*1024*1024);assert.throws(()=>writeRecovery(store,scope,document.revision,big,null),/2 MiB/);
});
test('logout clears every recovery entry for only the signed-out account',()=>{
  const store=storage();writeRecovery(store,scope,document.revision,document,null);
  writeRecovery(store,{...scope,workspaceId:'other-workspace'},document.revision,document,null);
  writeRecovery(store,{...scope,userId:'user-b'},document.revision,document,null);
  clearRecoveryForUser(scope.userId,store);assert.equal(store.length,1);assert.ok(readRecovery(store,{...scope,userId:'user-b'}));
  removeRecovery(store,{...scope,userId:'user-b'});assert.equal(store.length,0);
});

test('revision-zero projects recover and blocked storage cannot prevent logout',()=>{
  const store=storage(),first={...document,revision:0};writeRecovery(store,scope,0,first,null,1000);assert.equal(readRecovery(store,scope,1001).baseRevision,0);
  const blocked={get length(){throw new Error('Storage disabled');},getItem(){throw new Error('Storage disabled');},removeItem(){throw new Error('Storage disabled');},setItem(){},key(){return null;}};
  assert.equal(clearRecoveryForUser(scope.userId,blocked),false);
});
