export type User = { id: string; email: string; displayName: string; emailVerified: boolean };
export type Session = { user: User; csrfToken: string; expiresAt: string };
export type Workspace = { id: string; name: string; createdAt: string };
export type Project = { id: string; workspaceId: string; name: string; revision: number; createdAt: string };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type Canvas = { width: number; height: number; frameRate: { num: number; den: number }; backgroundColor: string; workingColorSpace: "rec709-sdr" };
export type Revision<T = ProjectDocument> = { revision: number; document: T; createdAt: string };
export type SourceRange = { inPts: number; outPts: number; timeBase: { num: number; den: number } };
export type Clip = { id: string; type: "media"; assetVersionId: string; startTick: number; durationTick: number; sourceRange: SourceRange; playbackRate: { num: number; den: number }; sourceAudio: { enabled: boolean; gainDb: number }; transform: { x: number; y: number; scaleX: number; scaleY: number; rotationDeg: number; opacity: number }; effects: unknown[]; keyframes: unknown[] };
export type TextStyle = { fontAssetVersionId: string; fontSizePx: number; color: string; align: "start" | "center" | "end"; direction: "ltr" | "rtl" | "auto"; outlinePx: number; outlineColor: string };
export type CaptionCue = { id: string; type: "caption"; startTick: number; durationTick: number; text: string; language: string; style: TextStyle; transform: Clip["transform"] };
type TrackBase = { id: string; order: number; locked: boolean; muted: boolean; solo: boolean; visible: boolean };
export type MediaTrack = TrackBase & { kind: "video" | "audio"; clips: Clip[] };
export type CaptionTrack = TrackBase & { kind: "caption"; clips: CaptionCue[] };
export type GraphicsTrack = TrackBase & { kind: "graphics"; clips: Array<{id:string;type:string;startTick:number;durationTick:number}> };
export type Track = MediaTrack | CaptionTrack | GraphicsTrack;
export type ProjectDocument = { schemaVersion: number; projectId: string; revision: number; timebase: number; canvas: Canvas; assets: Array<{assetId: string; versionId: string; kind: string; sha256: string; status: string}>; activeSequenceId: string; sequences: Array<{id:string; durationTick:number; tracks:Track[]; transitions:unknown[]; markers:unknown[]}>; thumbnail: {width:number; height:number; layers:unknown[]}; exportPresets: Array<{id:string; version:number}> };
export class ApiError extends Error { status:number; code:string; constructor(message: string, status: number, code: string) { super(message); this.status=status; this.code=code; } }
export async function request<T>(path: string, init: RequestInit = {}, csrf?: string): Promise<{data:T; etag:string|null}> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (csrf) headers.set("X-CSRF-Token", csrf);
  const response = await fetch(`/v1${path}`, { ...init, credentials: "same-origin", headers, cache: "no-store" });
  if (!response.ok) {
    const parsed = await response.json().catch(() => null);
    throw new ApiError(parsed?.error?.message || `Request failed (${response.status}).`, response.status, parsed?.error?.code || "REQUEST_FAILED");
  }
  return { data: (response.status === 204 ? undefined : await response.json()) as T, etag: response.headers.get("ETag") };
}
export const key = () => crypto.randomUUID();
