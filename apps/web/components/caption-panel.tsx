"use client";

import { useEffect, useRef, useState } from "react";
import type { CaptionCue, ProjectDocument } from "@/lib/api";
import type { Asset } from "@/lib/media";
import { canEditCaptions, captionTrack, putCaption, removeCaption } from "@/lib/captions";
import { frameTicks } from "@/lib/timeline";
import styles from "./editor-tools.module.css";

type Props = { workspaceId: string; doc: ProjectDocument; disabled: boolean; ensureFont: () => Promise<Asset>; onChange: (change: ProjectDocument | ((current: ProjectDocument) => ProjectDocument)) => void; onError: (error: unknown) => void; onSeek: (tick: number) => void };
export default function CaptionPanel({ workspaceId, doc, disabled, ensureFont, onChange, onError, onSeek }: Props) {
  const track = captionTrack(doc), ft = frameTicks(doc), sequence = doc.sequences.find(s => s.id === doc.activeSequenceId)!;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [selected, setSelected] = useState<string | null>(null), [working, setWorking] = useState(false);
  const [text, setText] = useState(""), [language, setLanguage] = useState("en"), [start, setStart] = useState("0"), [end, setEnd] = useState("1");
  const [fontSize, setFontSize] = useState("54"), [color, setColor] = useState("#ffffff"), [outline, setOutline] = useState("3");
  const [align, setAlign] = useState<CaptionCue["style"]["align"]>("center"), [direction, setDirection] = useState<CaptionCue["style"]["direction"]>("auto");
  const cue = track?.clips.find(c => c.id === selected);
  const fontRef = doc.assets.find(a => a.kind === "font" && (!cue || a.versionId === cue.style.fontAssetVersionId));
  const editable = canEditCaptions(doc), locked = disabled || working || !editable;
  useEffect(() => {
    if (!cue) return;
    setText(cue.text); setLanguage(cue.language); setStart(String(cue.startTick / ft)); setEnd(String((cue.startTick + cue.durationTick) / ft));
    setFontSize(String(cue.style.fontSizePx)); setColor(cue.style.color.slice(0, 7)); setOutline(String(cue.style.outlinePx)); setAlign(cue.style.align); setDirection(cue.style.direction);
  }, [cue?.id, cue?.text, cue?.language, cue?.startTick, cue?.durationTick, cue?.style.fontSizePx, cue?.style.color, cue?.style.outlinePx, cue?.style.align, cue?.style.direction, ft]);
  function newCue() {
    const after = track?.clips.at(-1); const first = after ? (after.startTick + after.durationTick) / ft : 0;
    setSelected(null); setText(""); setStart(String(first)); setEnd(String(Math.min(sequence.durationTick / ft, first + Math.max(1, Math.round(2 * doc.canvas.frameRate.num / doc.canvas.frameRate.den)))));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setWorking(true);
    try {
      const startFrame = Number(start), endFrame = Number(end);
      if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrame)) throw new Error("Use whole frame numbers for caption times.");
      const font = cue ? null : await ensureFont();
      if (!mounted.current) return;
      const fontAssetVersionId = cue?.style.fontAssetVersionId || font!.versionId;
      const nextCue: CaptionCue = { id: cue?.id || crypto.randomUUID(), type: "caption", text, language, startTick: startFrame * ft, durationTick: (endFrame - startFrame) * ft,
        style: { fontAssetVersionId, fontSizePx: Number(fontSize), color: `${color}${cue?.style.color.slice(7)||"ff"}`, align, direction, outlinePx: Number(outline), outlineColor: cue?.style.outlineColor || "#000000ff" },
        transform: cue?.transform || { x: .5, y: .8, scaleX: 1, scaleY: 1, rotationDeg: 0, opacity: 1 } };
      onChange(current => {
        const next = putCaption(current, nextCue);
        if (font && !next.assets.some(a => a.versionId === font.versionId)) { if (!font.sha256) throw new Error("The caption font checksum is unavailable."); next.assets.push({assetId:font.id, versionId:font.versionId, kind:"font", sha256:font.sha256, status:"ready"}); }
        return next;
      }); setSelected(nextCue.id);
    } catch (error) { if (mounted.current) onError(error); } finally { if (mounted.current) setWorking(false); }
  }
  return <div className={styles.captionPanel}>
    <div className="panel-head"><div><span className="panel-overline">CAPTION STUDIO</span><h2>Manual captions</h2></div></div>
    <p className="panel-subtitle">Write timed captions for your video. Captions are burned into the exported MP4.</p>
    {!editable && <p role="status">This caption track is preserved but cannot be edited here.</p>}
    <div className={styles.cueList}>{track?.clips.map((item, index) => <div className={styles.cueRow} key={item.id}>
      <button className={styles.cueButton} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); onSeek(item.startTick); }}><strong>{index + 1}. {item.text}</strong><small>Frames {item.startTick / ft}–{(item.startTick + item.durationTick) / ft}</small></button>
      <button className="icon-button danger" aria-label={`Delete caption ${index + 1}`} disabled={locked} onClick={() => { try { onChange(removeCaption(doc, item.id)); if (selected === item.id) newCue(); } catch (e) { onError(e); } }}>×</button>
    </div>)}</div>
    <button className="text-button" onClick={newCue} disabled={locked}>New caption</button>
    <form className={styles.captionForm} onSubmit={submit}>
      <label>Caption text<textarea required maxLength={2000} rows={3} value={text} onChange={e => setText(e.target.value)} disabled={locked} dir="auto" /></label>
      <div className={styles.fields}><label>Start frame<input type="number" min={0} max={sequence.durationTick / ft - 1} step={1} required value={start} onChange={e => setStart(e.target.value)} disabled={locked} /></label><label>End frame<input type="number" min={1} max={sequence.durationTick / ft} step={1} required value={end} onChange={e => setEnd(e.target.value)} disabled={locked} /></label></div>
      <label>Language tag<input required value={language} maxLength={35} onChange={e => setLanguage(e.target.value)} disabled={locked} placeholder="en or fa" /></label>
      <div className={styles.fields}><label>Font size (px)<input required type="number" min={8} max={200} value={fontSize} onChange={e => setFontSize(e.target.value)} disabled={locked} /></label><label>Text color<input type="color" value={color} onChange={e => setColor(e.target.value)} disabled={locked} /></label></div>
      <div className={styles.fields}><label>Outline (px)<input required type="number" min={0} max={10} step={.5} value={outline} onChange={e => setOutline(e.target.value)} disabled={locked} /></label><label>Alignment<select value={align} onChange={e => setAlign(e.target.value as typeof align)} disabled={locked}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option></select></label></div>
      <label>Text direction<select value={direction} onChange={e => setDirection(e.target.value as typeof direction)} disabled={locked}><option value="auto">Automatic</option><option value="ltr">Left to right</option><option value="rtl">Right to left</option></select></label>
      <button className="button secondary" disabled={locked}>{working ? "Preparing font…" : cue ? "Update caption" : "Add caption"}</button>
      <small>{fontRef&&<><a href={`/v1/workspaces/${workspaceId}/assets/${fontRef.assetId}/license`} target="_blank" rel="noopener noreferrer">Font license</a> · </>}DejaVu Sans · up to 500 cues · no overlaps. Use manual line breaks to fit the canvas. Preview fonts and placement may differ slightly from export. Remove captions before changing clip timing.</small>
    </form>
  </div>;
}
