import type { Asset } from "./media";
import type { Clip, MediaTrack, ProjectDocument } from "./api";

const gcd=(a:bigint,b:bigint):bigint=>b===0n?a:gcd(b,a%b);
export function primary(doc:ProjectDocument){return doc.sequences.find(s=>s.id===doc.activeSequenceId)?.tracks.find((t):t is MediaTrack=>t.kind==="video");}
export function frameTicks(doc:ProjectDocument){return 240000*doc.canvas.frameRate.den/doc.canvas.frameRate.num;}
export function assetTiming(asset:Asset,doc:ProjectDocument){
  const video=asset.metadata?.video; const match=video?.timeBase?.match(/^(\d+)\/(\d+)$/);
  if(!video||!match||video.startPts==null||video.durationPts==null||!Number.isSafeInteger(video.startPts)||!Number.isSafeInteger(video.durationPts)||video.durationPts<=0)return null;
  const tbNum=Number(match[1]),tbDen=Number(match[2]),ft=frameTicks(doc);
  if(!Number.isSafeInteger(tbNum)||!Number.isSafeInteger(tbDen)||tbNum<=0||tbDen<=0||!Number.isSafeInteger(ft))return null;
  const ptsNumerator=BigInt(ft)*BigInt(tbDen),ptsDenominator=240000n*BigInt(tbNum);
  const frameStep=ptsDenominator/gcd(ptsNumerator,ptsDenominator);
  // Integer arithmetic avoids silently extending source duration on long or fractional-rate inputs.
  let frames=BigInt(video.durationPts)*ptsDenominator/ptsNumerator; frames=frames/frameStep*frameStep;
  if(frames<=0n||frames>BigInt(Number.MAX_SAFE_INTEGER)||frameStep>BigInt(Number.MAX_SAFE_INTEGER))return null;
  const durationPts=frames*ptsNumerator/ptsDenominator;
  const out=BigInt(video.startPts)+durationPts;
  if(out>BigInt(Number.MAX_SAFE_INTEGER)||out<BigInt(Number.MIN_SAFE_INTEGER))return null;
  return {startPts:video.startPts,outPts:Number(out),num:tbNum,den:tbDen,frames:Number(frames),frameStep:Number(frameStep)};
}
export function serialiseTrack(doc:ProjectDocument,clips:Clip[]){
  const copy=structuredClone(doc);const seq=copy.sequences.find(s=>s.id===copy.activeSequenceId);const track=seq?.tracks.find((t):t is MediaTrack=>t.kind==="video");
  if(!seq||!track)throw new Error("The active video track is unavailable.");
  let tick=0;track.clips=clips.map(c=>{const next={...c,startTick:tick};tick+=c.durationTick;return next;});seq.durationTick=Math.max(tick,frameTicks(copy));return copy;
}
export function splitClip(clip:Clip,frames:number,doc:ProjectDocument,secondId:string):[Clip,Clip]{
  const ft=frameTicks(doc),totalFrames=clip.durationTick/ft;
  if(!Number.isSafeInteger(frames)||frames<=0||frames>=totalFrames)throw new Error("The selected split is outside the clip.");
  const num=BigInt(frames)*BigInt(ft)*BigInt(clip.sourceRange.timeBase.den), den=240000n*BigInt(clip.sourceRange.timeBase.num);
  if(num%den!==0n)throw new Error("The split is not aligned with the source timebase.");
  const midpoint=Number(BigInt(clip.sourceRange.inPts)+num/den);
  if(!Number.isSafeInteger(midpoint)||midpoint<=clip.sourceRange.inPts||midpoint>=clip.sourceRange.outPts)throw new Error("The selected split is outside the source range.");
  return [{...clip,durationTick:frames*ft,sourceRange:{...clip.sourceRange,outPts:midpoint}},{...clip,id:secondId,durationTick:clip.durationTick-frames*ft,sourceRange:{...clip.sourceRange,inPts:midpoint}}];
}

/** Reflow commands are only safe for a simple contiguous, normal-speed track. */
export function canEditContiguous(doc: ProjectDocument): boolean {
  const sequence=doc.sequences.find(s=>s.id===doc.activeSequenceId);
  const track=primary(doc);
  if(!sequence||!track||doc.sequences.length!==1||track.locked||!track.visible||sequence.transitions.length||sequence.tracks.filter(t=>t.kind==='video').length!==1||sequence.tracks.some(t=>t.kind!=='video'&&t.clips.length>0))return false;
  let expected=0;
  for(const clip of track.clips){
    if(clip.type!=='media'||clip.startTick!==expected||clip.playbackRate.num!==1||clip.playbackRate.den!==1||clip.effects.length||clip.keyframes.length||clip.transform.x!==0||clip.transform.y!==0||clip.transform.scaleX!==1||clip.transform.scaleY!==1||clip.transform.rotationDeg!==0||clip.transform.opacity!==1)return false;
    expected+=clip.durationTick;
  }
  return sequence.durationTick===Math.max(expected,frameTicks(doc));
}

type Fade = {id:string;fromClipId:string;toClipId:string;type:'fade';durationTick:number;audioCrossfade:true};
export function canRemoveFade(doc:ProjectDocument):boolean{
  const seq=doc.sequences.find(s=>s.id===doc.activeSequenceId);const track=primary(doc);
  if(!seq||!track||doc.sequences.length!==1||track.locked||!track.visible||seq.tracks.filter(t=>t.kind==='video').length!==1||seq.tracks.some(t=>t.kind!=='video'&&t.clips.length>0)||track.clips.length!==2||seq.transitions.length!==1)return false;
  const [a,b]=track.clips;const t=seq.transitions[0] as Partial<Fade>;
  const identity=(c:Clip)=>c.transform.x===0&&c.transform.y===0&&c.transform.scaleX===1&&c.transform.scaleY===1&&c.transform.rotationDeg===0&&c.transform.opacity===1;
  return a.type==='media'&&b.type==='media'&&identity(a)&&identity(b)&&a.startTick===0&&a.playbackRate.num===1&&a.playbackRate.den===1&&b.playbackRate.num===1&&b.playbackRate.den===1&&!a.effects.length&&!b.effects.length&&!a.keyframes.length&&!b.keyframes.length&&t.type==='fade'&&t.audioCrossfade===true&&t.fromClipId===a.id&&t.toClipId===b.id&&typeof t.durationTick==='number'&&t.durationTick>0&&t.durationTick<a.durationTick&&t.durationTick<b.durationTick&&t.durationTick%frameTicks(doc)===0&&b.startTick===a.durationTick-t.durationTick&&seq.durationTick===b.startTick+b.durationTick;
}
export function addFade(doc:ProjectDocument,id:string):ProjectDocument{
  const track=primary(doc);if(!canEditContiguous(doc)||!track||track.clips.length!==2)throw new Error('A dissolve requires exactly two adjacent simple clips.');
  const [first,second]=track.clips;const ft=frameTicks(doc);
  const frames=Math.min(Math.round(doc.canvas.frameRate.num/(2*doc.canvas.frameRate.den)),first.durationTick/ft-1,second.durationTick/ft-1);
  if(!Number.isInteger(frames)||frames<1)throw new Error('The clips are too short for a dissolve.');
  const copy=structuredClone(doc),seq=copy.sequences.find(s=>s.id===copy.activeSequenceId)!,target=seq.tracks.find((t):t is MediaTrack=>t.kind==='video')!;
  const durationTick=frames*ft;target.clips[1].startTick=target.clips[0].durationTick-durationTick;seq.durationTick=target.clips[1].startTick+target.clips[1].durationTick;
  seq.transitions=[{id,fromClipId:first.id,toClipId:second.id,type:'fade',durationTick,audioCrossfade:true} satisfies Fade];return copy;
}
export function removeFade(doc:ProjectDocument):ProjectDocument{
  if(!canRemoveFade(doc))throw new Error('This transition cannot be safely changed here.');
  const copy=structuredClone(doc),seq=copy.sequences.find(s=>s.id===copy.activeSequenceId)!,track=seq.tracks.find((t):t is MediaTrack=>t.kind==='video')!;
  seq.transitions=[];return serialiseTrack(copy,track.clips);
}

/** Return a sample-aligned source interval clipped to the current sequence. */
export function audioTiming(asset:Asset, sequenceDurationTick:number){
  const audio=asset.metadata?.audio;const match=audio?.timeBase?.match(/^(\d+)\/(\d+)$/);
  if(!audio||!match||audio.startPts==null||audio.durationPts==null||!Number.isSafeInteger(audio.startPts)||!Number.isSafeInteger(audio.durationPts)||audio.durationPts<=0||!Number.isSafeInteger(sequenceDurationTick)||sequenceDurationTick<=0)return null;
  const n=Number(match[1]),d=Number(match[2]);if(!Number.isSafeInteger(n)||!Number.isSafeInteger(d)||n<=0||d<=0)return null;
  const quantumDen=240000n*BigInt(n),quantumNum=5n*BigInt(d),step=5n*(quantumDen/gcd(quantumNum,quantumDen));
  const maxSource=BigInt(audio.durationPts)*quantumDen/BigInt(d);const sequenceMax=BigInt(sequenceDurationTick)<144000000n?BigInt(sequenceDurationTick):144000000n;const maxTicks=maxSource<sequenceMax?maxSource:sequenceMax;
  const ticks=maxTicks/step*step;if(ticks<=0n||ticks>BigInt(Number.MAX_SAFE_INTEGER))return null;
  const out=BigInt(audio.startPts)+ticks*BigInt(d)/quantumDen;if(out>BigInt(Number.MAX_SAFE_INTEGER)||out<BigInt(Number.MIN_SAFE_INTEGER))return null;
  return {startPts:audio.startPts,outPts:Number(out),num:n,den:d,durationTick:Number(ticks)};
}

/** Inserting audio leaves caption timing and source video content unchanged. */
export function canAddBackgroundAudio(doc:ProjectDocument):boolean{
  const seq=doc.sequences.find(s=>s.id===doc.activeSequenceId);
  if(!seq||!primary(doc)?.clips.length)return false;
  const audio=seq.tracks.filter(t=>t.kind==='audio');
  if(audio.length>1||audio.some(t=>t.locked||t.clips.length>0)||seq.tracks.some(t=>t.kind!=='video'&&t.kind!=='audio'&&t.kind!=='caption'))return false;
  const visual=structuredClone(doc);for(const sequence of visual.sequences)sequence.tracks=sequence.tracks.filter(t=>t.kind!=='caption');
  return canEditContiguous(visual)||canRemoveFade(visual);
}
