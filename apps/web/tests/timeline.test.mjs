import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addFade, assetTiming, audioTiming, canEditContiguous, canRemoveFade, frameTicks, removeFade, serialiseTrack, splitClip } from '../lib/timeline.ts';

const document=JSON.parse(readFileSync(new URL('../../../docs/03-frontend/examples/project-v1.json',import.meta.url),'utf8'));
const source=(timeBase,startPts,durationPts)=>({metadata:{video:{timeBase,startPts,durationPts}}});

test('fractional frame rate uses exact source presentation timestamps',()=>{
  const t=assetTiming(source('1/30000',0,30030),document);
  assert.equal(frameTicks(document),8008);assert.deepEqual([t.frames,t.outPts,t.frameStep],[30,30030,1]);
});
test('incompatible source and frame timebases snap down without exceeding the input',()=>{
  const project=structuredClone(document);project.canvas.frameRate={num:30,den:1};
  const t=assetTiming(source('1/12800',-10,12600),project);
  assert.equal(t.frameStep,3);assert.equal(t.frames,27);assert.ok(t.outPts<=12590);
});
test('missing or invalid timing cannot be represented as an editable clip',()=>{
  for(const a of [source('1/90000',null,90000),source('0/90000',0,1),source('1/90000',0,0),source('broken',0,1)])assert.equal(assetTiming(a,document),null);
});
test('split preserves source and timeline boundaries without mutating input',()=>{
  const clip=structuredClone(document.sequences[0].tracks[0].clips[0]);
  const [a,b]=splitClip(clip,15,document,'second');
  assert.equal(a.sourceRange.outPts,b.sourceRange.inPts);assert.equal(a.durationTick+b.durationTick,clip.durationTick);
  assert.equal(clip.sourceRange.outPts,30030);assert.equal(b.id,'second');
});
test('split rejects a source boundary that cannot be represented exactly',()=>{
  const project=structuredClone(document);project.canvas.frameRate={num:30,den:1};
  const clip=structuredClone(project.sequences[0].tracks[0].clips[0]);clip.durationTick=240000;clip.sourceRange.timeBase={num:1,den:12800};clip.sourceRange.outPts=12800;
  assert.throws(()=>splitClip(clip,1,project,'second'),/timebase/);
});
test('timeline reflow changes only the copy and preserves adjacent positions',()=>{
  const clip=document.sequences[0].tracks[0].clips[0];const before=JSON.stringify(document);
  const copy=serialiseTrack(document,[clip,{...clip,id:'next'}]);const [a,b]=copy.sequences[0].tracks[0].clips;
  assert.equal(a.startTick,0);assert.equal(b.startTick,a.durationTick);assert.equal(copy.sequences[0].durationTick,2*a.durationTick);assert.equal(JSON.stringify(document),before);
});

test('simple timeline controls refuse gaps, speed changes and hidden advanced content',()=>{
  assert.equal(canEditContiguous(document),true);
  const gap=structuredClone(document);gap.sequences[0].tracks[0].clips[0].startTick=8008;assert.equal(canEditContiguous(gap),false);
  const speed=structuredClone(document);speed.sequences[0].tracks[0].clips[0].playbackRate={num:2,den:1};assert.equal(canEditContiguous(speed),false);
  const locked=structuredClone(document);locked.sequences[0].tracks[0].locked=true;assert.equal(canEditContiguous(locked),false);
  const effect=structuredClone(document);effect.sequences[0].tracks[0].clips[0].effects.push({type:'color'});assert.equal(canEditContiguous(effect),false);
  const transform=structuredClone(document);transform.sequences[0].tracks[0].clips[0].transform.scaleX=2;assert.equal(canEditContiguous(transform),false);
  const hidden=structuredClone(document);hidden.sequences[0].tracks[0].visible=false;assert.equal(canEditContiguous(hidden),false);
  const tail=structuredClone(document);tail.sequences[0].durationTick+=8008;assert.equal(canEditContiguous(tail),false);
});

test('a dissolve creates a true overlap and can be removed without changing source ranges',()=>{
  const c=document.sequences[0].tracks[0].clips[0];const base=serialiseTrack(document,[c,{...structuredClone(c),id:'second'}]);
  const faded=addFade(base,'transition');const t=faded.sequences[0].transitions[0];const [a,b]=faded.sequences[0].tracks[0].clips;
  assert.equal(t.durationTick,120120);assert.equal(b.startTick,a.durationTick-t.durationTick);assert.equal(faded.sequences[0].durationTick,360360);
  assert.equal(canEditContiguous(faded),false);assert.equal(canRemoveFade(faded),true);
  const restored=removeFade(faded);assert.deepEqual(restored.sequences[0],base.sequences[0]);assert.equal(document.sequences[0].tracks[0].clips.length,1);
});
test('transition removal refuses unknown or ambiguous overlap',()=>{
  const c=document.sequences[0].tracks[0].clips[0];const base=serialiseTrack(document,[c,{...structuredClone(c),id:'second'}]);
  const faded=addFade(base,'transition');faded.sequences[0].transitions[0].audioCrossfade=false;assert.equal(canRemoveFade(faded),false);assert.throws(()=>removeFade(faded));
});

test('background audio uses exact sample boundaries and never exceeds the sequence or source',()=>{
  const audio={metadata:{audio:{timeBase:'1/44100',startPts:0,durationPts:44100}}};
  const timing=audioTiming(audio,192003);assert.equal(timing.durationTick,192000);assert.equal(timing.outPts,35280);assert.equal(timing.durationTick%5,0);
  assert.equal(audioTiming({metadata:{audio:{timeBase:'1/44100',startPts:null,durationPts:44100}}},192000),null);
});
