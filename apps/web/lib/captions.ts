import type { CaptionCue, CaptionTrack, ProjectDocument } from "./api";
import { frameTicks } from "./timeline.ts";

export function captionTrack(doc: ProjectDocument): CaptionTrack | undefined {
  return doc.sequences.find(s => s.id === doc.activeSequenceId)?.tracks.find(t => t.kind === "caption");
}

export function canEditCaptions(doc: ProjectDocument) {
  const sequence = doc.sequences.find(s => s.id === doc.activeSequenceId);
  const tracks = sequence?.tracks.filter(t => t.kind === "caption") || [];
  return !!sequence && doc.sequences.length === 1 && tracks.length <= 1 && !tracks.some(t => t.locked || t.solo || !t.visible || t.muted || t.clips.some(c => c.transform.scaleX !== 1 || c.transform.scaleY !== 1 || c.transform.rotationDeg !== 0 || c.transform.opacity !== 1 || c.transform.x < 0 || c.transform.x > 1 || c.transform.y < 0 || c.transform.y > 1));
}

export function putCaption(doc: ProjectDocument, cue: CaptionCue): ProjectDocument {
  const sequence = doc.sequences.find(s => s.id === doc.activeSequenceId);
  const ft = frameTicks(doc);
  if (!sequence || !canEditCaptions(doc)) throw new Error("This caption track cannot be safely edited here.");
  if (!Number.isSafeInteger(cue.startTick) || !Number.isSafeInteger(cue.durationTick) || cue.startTick < 0 || cue.durationTick < ft || cue.startTick % ft || cue.durationTick % ft || cue.startTick + cue.durationTick > sequence.durationTick) throw new Error("Caption times must be whole frames inside the sequence.");
  if (!cue.text.trim() || cue.text.length > 2000 || /[\u0000-\u0008\u000b-\u001f]/.test(cue.text)) throw new Error("Enter 1–2000 characters without control characters.");
  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(cue.language) || cue.language.length > 35) throw new Error("Enter a language tag such as en or fa.");
  const style = cue.style;
  if (!Number.isFinite(style.fontSizePx) || style.fontSizePx < 8 || style.fontSizePx > 200 || !Number.isFinite(style.outlinePx) || style.outlinePx < 0 || style.outlinePx > 10 || !/^#[0-9a-fA-F]{8}$/.test(style.color) || !/^#[0-9a-fA-F]{8}$/.test(style.outlineColor)) throw new Error("Caption styling is outside the supported limits.");
  const transform = cue.transform;
  if (transform.scaleX !== 1 || transform.scaleY !== 1 || transform.rotationDeg !== 0 || transform.opacity !== 1 || !Number.isFinite(transform.x) || !Number.isFinite(transform.y) || transform.x < 0 || transform.x > 1 || transform.y < 0 || transform.y > 1) throw new Error("Caption transforms are outside the supported limits.");
  const existing = captionTrack(doc)?.clips || [];
  if (existing.some(c => c.id !== cue.id && cue.startTick < c.startTick + c.durationTick && cue.startTick + cue.durationTick > c.startTick)) throw new Error("Captions on this track cannot overlap.");
  if (existing.length >= 500 && !existing.some(c => c.id === cue.id)) throw new Error("This caption track supports up to 500 cues.");
  const copy = structuredClone(doc), seq = copy.sequences.find(s => s.id === copy.activeSequenceId)!;
  let track = captionTrack(copy);
  if (!track) { track = { id: crypto.randomUUID(), kind: "caption", order: Math.max(-1, ...seq.tracks.map(t => t.order)) + 1, locked: false, muted: false, solo: false, visible: true, clips: [] }; seq.tracks.push(track); }
  track.clips = [...track.clips.filter(c => c.id !== cue.id), structuredClone(cue)].sort((a, b) => a.startTick - b.startTick);
  return copy;
}

export function removeCaption(doc: ProjectDocument, id: string): ProjectDocument {
  if (!canEditCaptions(doc)) throw new Error("This caption track cannot be safely edited here.");
  const copy = structuredClone(doc), track = captionTrack(copy);
  if (track) track.clips = track.clips.filter(c => c.id !== id);
  return copy;
}

export function activeCaptions(doc: ProjectDocument, tick: number) {
  const track = captionTrack(doc);
  return track && track.visible && !track.muted ? track.clips.filter(c => tick >= c.startTick && tick < c.startTick + c.durationTick) : [];
}
