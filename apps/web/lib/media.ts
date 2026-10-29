import { ApiError, key, request } from "./api.ts";

export type Asset = {
  id: string; workspaceId: string; versionId: string; kind: "video" | "audio" | "image" | "font" | "unknown";
  state: "quarantined" | "inspecting" | "processing" | "ready" | "failed" | "deleted";
  sha256: string | null; sizeBytes: number; createdAt: string; errorCode: string | null;
  thumbnailAvailable?: boolean; metadata?: { durationSeconds?: number; video?: { timeBase?: string; startPts?: number | null; durationPts?: number | null; width?: number; height?: number; colorTransfer?:string; colorPrimaries?:string; colorSpace?:string } | null; audio?: {timeBase?:string;startPts?:number|null;durationPts?:number|null;sampleRate?:string;channels?:number}|null } | null;
};
export type Job = {id:string; state:string; kind:string; fraction:number|null; errorCode:string|null; attempt:number};
export type Artifact = { id:string; revision:number; state:string; createdAt:string; mimeType:string; sizeBytes:number };
type Upload = {id:string;partSize:number;partCount:number;assetId:string|null};
type Part = {partNumber:number;etag:string;sha256:string;sizeBytes:number};
type Grant = {method:"PUT";url:string;headers:Record<string,string>};
export type UploadAttempt = {file:File;createKey:string;completeKey:string;session?:Upload;parts?:Part[]};
export const newUploadAttempt=(file:File):UploadAttempt=>({file,createKey:key(),completeKey:key()});
async function hash(buffer: ArrayBuffer) { const digest=await crypto.subtle.digest("SHA-256",buffer); return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join(""); }
function checkAbort(signal:AbortSignal){if(signal.aborted)throw new DOMException("Cancelled","AbortError");}
export async function uploadFile(workspace: string, attempt:UploadAttempt, csrf: string, signal:AbortSignal, update: (message:string)=>void, onSession:(id:string)=>void) {
  const {file}=attempt;
  // WebCrypto requires the full input for SHA-256; use a bounded local upload until incremental hashing is available.
  if(file.size > 256 * 1024 * 1024) throw new Error("This browser uploader currently accepts files up to 256 MiB.");
  update("Checking file integrity…");
  const bytes=await file.arrayBuffer();checkAbort(signal);const sha256=await hash(bytes);checkAbort(signal);const base=`/workspaces/${workspace}`;
  if(!attempt.session)attempt.session=(await request<Upload>(`${base}/uploads`,{method:"POST",signal,headers:{"Idempotency-Key":attempt.createKey},body:JSON.stringify({filename:file.name,sizeBytes:file.size,sha256})},csrf)).data;
  const session=attempt.session;onSession(session.id);checkAbort(signal);
  if(!attempt.parts){
    const existing=(await request<{items:Part[]}>(`${base}/uploads/${session.id}/parts`,{signal})).data.items;
    const parts:Part[]=[];
    for(let n=1;n<=session.partCount;n++) {
      checkAbort(signal);const chunk=bytes.slice((n-1)*session.partSize,Math.min(n*session.partSize,bytes.byteLength));const partHash=await hash(chunk);checkAbort(signal);
      const found=existing.find(p=>p.partNumber===n&&p.sha256===partHash&&p.sizeBytes===chunk.byteLength);
      if(found){parts.push(found);update(`Uploaded ${n} of ${session.partCount} parts`);continue;}
      const grant=(await request<Grant>(`${base}/uploads/${session.id}/parts`,{method:"POST",signal,body:JSON.stringify({partNumber:n,sha256:partHash})},csrf)).data;
      const url=new URL(grant.url,window.location.origin);
      if(url.origin!==window.location.origin) throw new Error("This uploader cannot yet use the configured storage provider.");
      const res=await fetch(url,{method:"PUT",signal,credentials:"same-origin",headers:{...grant.headers,"X-CSRF-Token":csrf},body:chunk});
      if(!res.ok){const body=await res.json().catch(()=>null);throw new ApiError(body?.error?.message || `Upload failed (${res.status}).`,res.status,body?.error?.code || "UPLOAD_FAILED");}
      parts.push(await res.json() as Part);update(`Uploaded ${n} of ${session.partCount} parts`);
    }
    attempt.parts=parts;
  }
  // Retain the complete manifest and key after an uncertain result; retry replays the same request.
  const job=(await request<Job>(`${base}/uploads/${session.id}/complete`,{method:"POST",signal,headers:{"Idempotency-Key":attempt.completeKey},body:JSON.stringify({parts:attempt.parts})},csrf)).data;
  return {job,uploadId:session.id};
}
export async function pollJob(workspace: string, id: string, signal: AbortSignal, update: (job:Job)=>void): Promise<Job> {
  for (;;) {
    checkAbort(signal);
    const job=(await request<Job>(`/workspaces/${workspace}/jobs/${id}`,{signal})).data;update(job);
    if(job.state==="completed" || job.state==="cancelled") return job;
    if(job.state==="failed") throw new Error(job.errorCode ? `Job ${job.state}: ${job.errorCode}` : `Job ${job.state}.`);
    await new Promise<void>((resolve,reject)=>{const onAbort=()=>{window.clearTimeout(timer);reject(new DOMException("Cancelled","AbortError"));};const timer=window.setTimeout(()=>{signal.removeEventListener("abort",onAbort);resolve();},1200);signal.addEventListener("abort",onAbort,{once:true});});
  }
}
