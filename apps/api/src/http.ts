import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { HttpError } from './db.js';
export async function bytes(req:IncomingMessage, limit:number):Promise<Buffer> {
  const chunks:Buffer[]=[]; let length=0;
  for await (const chunk of req) { const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk); length+=b.length; if(length>limit) throw new HttpError(413,'PAYLOAD_TOO_LARGE','Request exceeds size limit.'); chunks.push(b); }
  return Buffer.concat(chunks);
}
export async function json(req:IncomingMessage):Promise<any> {
  if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new HttpError(400,'CONTENT_TYPE','Expected application/json.');
  try { const value=JSON.parse((await bytes(req,2*1024*1024)).toString('utf8'));if(!value || typeof value!=='object' || Array.isArray(value))throw new HttpError(400,'INVALID_JSON','Expected a JSON object.');return value; } catch(e) { if(e instanceof HttpError) throw e; throw new HttpError(400,'INVALID_JSON','Invalid JSON body.'); }
}
export function send(res:ServerResponse,status:number,payload?:unknown,headers:Record<string,string>={}) {
  res.writeHead(status,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(payload === undefined ? {} : {'Content-Type':'application/json; charset=utf-8'}),...headers});
  res.end(payload === undefined ? undefined : JSON.stringify(payload));
}
export function fail(res:ServerResponse,error:unknown) {
  const requestId=randomUUID();
  if(error instanceof HttpError) return send(res,error.status,{error:{code:error.code,message:error.message,requestId}},error.headers);
  console.error(JSON.stringify({level:'error',requestId,code:'INTERNAL_ERROR'}));
  return send(res,500,{error:{code:'INTERNAL_ERROR',message:'The request could not be completed.',requestId}});
}
export function header(req:IncomingMessage,name:string):string|undefined { const v=req.headers[name.toLowerCase()]; return typeof v==='string'?v:undefined; }
export function stable(value:any):string {
  if(Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if(value && typeof value==='object') return `{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')}}`;
  return JSON.stringify(value);
}
export function uuid(value:string):boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export function name(value:unknown):string {
  if(typeof value!=='string' || !value.trim() || value.trim().length>200) throw new HttpError(400,'INVALID_NAME','Enter a name of 1–200 characters.');
  return value.trim();
}
export function paging(url:URL,scope:string):{limit:number;after?:{time:string;id:string}} {
  const raw=url.searchParams.get('limit');const limit=raw===null?25:Number(raw);
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new HttpError(400,'INVALID_PAGE','Page limit must be 1 to 100.');
  const token=url.searchParams.get('cursor');if(!token)return {limit};
  try{const p=JSON.parse(Buffer.from(token,'base64url').toString('utf8'));if(p.scope!==scope||typeof p.time!=='string'||!Number.isFinite(Date.parse(p.time))||!uuid(p.id))throw new Error('invalid');return {limit,after:{time:p.time,id:p.id}};}
  catch{throw new HttpError(400,'INVALID_CURSOR','Page cursor is invalid for this list.');}
}
export function cursor(scope:string,row:{sort_at:string;id:string}):string {return Buffer.from(JSON.stringify({scope,time:row.sort_at,id:row.id})).toString('base64url');}
