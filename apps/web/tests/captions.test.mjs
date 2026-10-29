import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeCaptions, canEditCaptions, captionTrack, putCaption, removeCaption} from '../lib/captions.ts';
import {canAddBackgroundAudio, canEditContiguous, frameTicks} from '../lib/timeline.ts';
const document=JSON.parse(readFileSync(new URL('../../../docs/03-frontend/examples/project-v1.json',import.meta.url),'utf8'));
const ft=frameTicks(document);
const cue={id:'9a37848c-1746-4a11-a52b-3cb764920d03',type:'caption',startTick:0,durationTick:ft*10,text:'Hello\nسلام',language:'fa',style:{fontAssetVersionId:'ba37848c-1746-4a11-a52b-3cb764920d03',fontSizePx:54,color:'#ffffffff',align:'center',direction:'auto',outlinePx:3,outlineColor:'#000000ff'},transform:{x:.5,y:.8,scaleX:1,scaleY:1,rotationDeg:0,opacity:1}};
test('manual captions preserve canonical video state and have half-open preview intervals',()=>{
  const original=JSON.stringify(document),next=putCaption(document,cue);
  assert.equal(JSON.stringify(document),original);assert.deepEqual(next.sequences[0].tracks[0],document.sequences[0].tracks[0]);
  assert.equal(activeCaptions(next,0).length,1);assert.equal(activeCaptions(next,cue.durationTick-1).length,1);assert.equal(activeCaptions(next,cue.durationTick).length,0);
  assert.equal(canEditContiguous(next),false);assert.equal(captionTrack(removeCaption(next,cue.id)).clips.length,0);
});
test('cue edits enforce exact frames, sequence bounds, nonoverlap and bounded literal text',()=>{
  const next=putCaption(document,cue);
  for(const change of [{startTick:1},{durationTick:1},{startTick:document.sequences[0].durationTick},{text:'\0bad'},{text:'x'.repeat(2001)},{text:' '},{language:'invalid language'},{transform:{...cue.transform,rotationDeg:90}}])assert.throws(()=>putCaption(document,{...cue,...change}));
  assert.throws(()=>putCaption(next,{...cue,id:'other',startTick:ft}),/overlap/);
  const later=putCaption(next,{...cue,id:'other',startTick:cue.durationTick});assert.equal(captionTrack(later).clips.length,2);
  const changed=putCaption(next,{...cue,text:'Corrected'});assert.equal(captionTrack(changed).clips.length,1);assert.equal(captionTrack(changed).clips[0].text,'Corrected');
});
test('locked, hidden, muted and transformed captions remain preserved without unsafe edits',()=>{
  const next=putCaption(document,cue);
  for(const setting of [{locked:true},{visible:false},{muted:true},{solo:true}]){const changed=structuredClone(next);Object.assign(captionTrack(changed),setting);assert.equal(canEditCaptions(changed),false);assert.throws(()=>removeCaption(changed,cue.id));}
  const transformed=structuredClone(next);captionTrack(transformed).clips[0].transform.rotationDeg=45;assert.equal(canEditCaptions(transformed),false);
});

test('background audio can be added after captions without retiming or overwriting them',()=>{
  const next=putCaption(document,cue),before=JSON.stringify(next);assert.equal(canAddBackgroundAudio(next),true);assert.equal(JSON.stringify(next),before);
  const filled=structuredClone(next);filled.sequences[0].tracks.push({id:'audio',kind:'audio',order:2,locked:false,muted:false,solo:false,visible:true,clips:[{}]});assert.equal(canAddBackgroundAudio(filled),false);
  const advanced=structuredClone(next);advanced.sequences[0].tracks[0].clips[0].transform.scaleX=2;assert.equal(canAddBackgroundAudio(advanced),false);
});
