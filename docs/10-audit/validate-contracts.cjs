// Resolve the same schema validator used by the API, including workspace-local installs.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const requireApi = createRequire(path.resolve(__dirname, '../../apps/api/package.json'));
const Ajv = requireApi('ajv/dist/2020');
const addFormats = requireApi('ajv-formats');
const root = path.resolve(__dirname, '..');
const load = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const project = load('03-frontend/schemas/project-v1.schema.json');
const snapshot = load('03-frontend/schemas/render-snapshot.schema.json');
const api = load('04-backend/openapi.yaml');
const projectId = 'https://studio.invalid/contracts/project-v1.schema.json';
const snapshotId = 'https://studio.invalid/contracts/render-snapshot.schema.json';
const apiId = 'https://studio.invalid/contracts/api';
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema({...project, $id: projectId}, projectId);
ajv.addSchema({...snapshot, $id: snapshotId}, snapshotId);
function rewrite(value) {
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => {
    if (k === '$ref' && v.startsWith('#/components/schemas/')) return [k, apiId + '#/$defs/' + v.split('/').at(-1)];
    if (k === '$ref' && v.startsWith('../03-frontend/schemas/project-v1.schema.json')) return [k, projectId + v.slice('../03-frontend/schemas/project-v1.schema.json'.length)];
    return [k, rewrite(v)];
  }));
  return value;
}
ajv.addSchema({$id:apiId, $defs:rewrite(api.components.schemas)}, apiId);
for (const name of Object.keys(api.components.schemas)) ajv.getSchema(apiId + "#/$defs/" + name);
let checked = 0;
function valid(schema, data, name) {
  const test = typeof schema === 'string' ? ajv.getSchema(schema) : ajv.compile(rewrite(schema));
  assert(test(data), name + ': ' + JSON.stringify(test.errors));
  checked++;
}
const example = load('03-frontend/examples/project-v1.json');
valid(projectId, example, 'project example');
const snap = load('03-frontend/examples/render-snapshot.json');
valid(snapshotId, snap, 'snapshot example');
assert.equal(snap.projectId,snap.document.projectId); assert.equal(snap.revision,snap.document.revision);
const crypto = require('node:crypto');
assert.equal(snap.documentSha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'03-frontend/examples/project-v1.json'))).digest('hex'));
for (const [p, methods] of Object.entries(api.paths)) for (const [method, op] of Object.entries(methods)) {
  for (const media of Object.values(op.requestBody?.content || {})) if ('example' in media) valid(media.schema,media.example,method+' '+p+' request');
  for (const [status,response] of Object.entries(op.responses)) for (const [type,media] of Object.entries(response.content || {})) {
    if ('example' in media) valid(media.schema,media.example,method+' '+p+' '+status);
    if (type === 'text/event-stream' && media.example) {
      const data = media.example.split('\n').find(x=>x.startsWith('data: ')).slice(6);
      valid(apiId+'#/$defs/Event',JSON.parse(data),'SSE data envelope');
    }
  }
}
// These regressions reject permissive model boundaries; they do not mirror application code.
const negative = [
  ['unknown schema', x=>x.schemaVersion=99],
  ['fractional ticks', x=>x.sequences[0].tracks[0].clips[0].durationTick=1.5],
  ['negative timeline', x=>x.sequences[0].tracks[0].clips[0].startTick=-1],
  ['missing source range', x=>delete x.sequences[0].tracks[0].clips[0].sourceRange],
  ['unbounded opacity', x=>x.sequences[0].tracks[0].clips[0].transform.opacity=2],
  ['untrusted filter', x=>x.sequences[0].tracks[0].clips[0].effects=[{type:'raw',filter:'movie=https://example.invalid'}]],
  ['unknown nested field', x=>x.sequences[0].tracks[0].clips[0].shell='invalid'],
  ['unsupported rational fps', x=>x.canvas.frameRate={num:29.97,den:1}],
  ['zero source denominator', x=>x.sequences[0].tracks[0].clips[0].sourceRange.timeBase.den=0],
  ['invalid UUID', x=>x.projectId='foreign-name']
];
const testProject = ajv.getSchema(projectId);
for (const [name,mutate] of negative) {const x=structuredClone(example); mutate(x); assert.equal(testProject(x),false,name+' must fail');}
// Rational example and split invariants are checked with integer arithmetic.
const fps=example.canvas.frameRate, duration=example.sequences[0].durationTick;
assert.equal(BigInt(duration)*BigInt(fps.num),30n*240000n*BigInt(fps.den));
assert.equal(147n*240000n,800n*44100n);
console.log(JSON.stringify({schemaExamples:checked,rejectedInvalidProjects:negative.length,rationalTimingChecks:'pass'}));
