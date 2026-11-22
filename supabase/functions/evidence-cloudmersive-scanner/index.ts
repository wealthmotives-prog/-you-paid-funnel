// You Paid / Cloudmersive quarantined-file scanner: STAGED SOURCE ONLY.
// No deployment and no direct member upload enablement. Service-role-only invocation.
// A clean vendor response records an inspection signal; NEVER approves/release a file.
import { createClient } from "npm:@supabase/supabase-js@2";
const BUCKET = "you-paid-work-evidence";
const ENDPOINT = "https://api.cloudmersive.com/virus/scan/file";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^[a-f0-9]{64}$/;
const MAX = 10485760;
const reply = (status:number, payload:Record<string,unknown>) =>
  Response.json(payload,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const sha = async (bytes:Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))]
  .map(x=>x.toString(16).padStart(2,"0")).join("");
function signature(bytes:Uint8Array):string|null {
 if(bytes.length>=5&&[37,80,68,70,45].every((n,i)=>bytes[i]===n))return "pdf";
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return "png";
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "jpg";
 return null;
}
function outcome(payload:unknown):"clean"|"infected"|"indeterminate" {
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return "indeterminate";
 const p=payload as Record<string,unknown>;
 if(p.CleanResult===false)return "infected";
 // Explicit clean=true and no reported viruses, no ambiguous extra result.
 if(p.CleanResult===true&&(p.FoundViruses===null||Array.isArray(p.FoundViruses)&&p.FoundViruses.length===0))
   return "clean";
 return "indeterminate";
}
Deno.serve(async(req:Request)=>{
 if(Deno.env.get("YOU_PAID_CLOUDMERSIVE_SCANNER_ENABLED")!=="true")
   return reply(503,{error:"scanner_not_enabled"});
 if(req.method!=="POST")return reply(405,{error:"method_not_allowed"});
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const vendorKey=Deno.env.get("CLOUDMERSIVE_API_KEY")||"";
 const url=Deno.env.get("SUPABASE_URL")||"";
 // Browser/member tokens cannot authorize this worker.
 if(!serviceKey||req.headers.get("authorization")!==`Bearer ${serviceKey}`)
   return reply(403,{error:"forbidden"});
 if(!vendorKey||!url)return reply(503,{error:"not_configured"});
 let jobId:string;
 try {
  const contentLength=Number(req.headers.get("content-length")||0);
  if(contentLength>256)return reply(413,{error:"invalid_body"});
  const raw=await req.text();
  if(raw.length>256)return reply(413,{error:"invalid_body"});
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||Object.keys(parsed).join(",")!=="job_id")
    return reply(400,{error:"invalid_body"});
  jobId=parsed.job_id;
  if(typeof jobId!=="string"||!UUID.test(jobId))return reply(400,{error:"invalid_job"});
 }catch{return reply(400,{error:"invalid_body"});}
 const sb=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 try {
  const {data:job,error:je}=await sb.from("evidence_inspection_jobs")
   .select("id,artifact_id,bucket_id,object_path,state,attempts,failure_code,scanner_name")
   .eq("id",jobId).maybeSingle();
  if(je||!job)return reply(404,{error:"job_unavailable"});
  if(job.state!=="quarantined"||job.failure_code!=="awaiting_antivirus_scan"||job.scanner_name)
    return reply(409,{error:"job_not_scannable"});
  const {data:artifact,error:ae}=await sb.from("evidence_artifacts")
    .select("id,content_hash,storage_reference").eq("id",job.artifact_id).maybeSingle();
  if(ae||!artifact||job.bucket_id!==BUCKET||artifact.storage_reference!==BUCKET+"/"+job.object_path)
    return reply(409,{error:"artifact_link_mismatch"});
  const objectPath=String(job.object_path||"");
  if(!/^[0-9a-f-]{36}\/[a-zA-Z0-9_./-]+$/.test(objectPath)||objectPath.includes(".."))
    return reply(409,{error:"unsafe_object_path"});
  const {data:file,error:fe}=await sb.storage.from(BUCKET).download(objectPath);
  if(fe||!file)return reply(503,{error:"quarantined_file_unavailable"});
  const bytes=new Uint8Array(await file.arrayBuffer());
  const digest=await sha(bytes),ext=objectPath.split(".").at(-1)?.toLowerCase();
  if(bytes.length===0||bytes.length>MAX||signature(bytes)!==ext||!HEX.test(artifact.content_hash)||digest!==artifact.content_hash)
    return reply(409,{error:"preflight_revalidation_failed"});
  // Server-to-server Cloudmersive request; no API key or file contents in logs.
  const form=new FormData();
  form.append("inputFile",new Blob([bytes],{type:ext==="pdf"?"application/pdf":ext==="png"?"image/png":"image/jpeg"}),"evidence."+ext);
  let verdict:"clean"|"infected"|"indeterminate"="indeterminate";
  try {
   const response=await fetch(ENDPOINT,{method:"POST",headers:{"Apikey":vendorKey},
    body:form,signal:AbortSignal.timeout(20000),redirect:"error"});
   if(response.ok&&Number(response.headers.get("content-length")||0)<=16384) {
    const body=await response.text();
    if(body.length<=16384)verdict=outcome(JSON.parse(body));
   }
  }catch{verdict="indeterminate";}
  // Store a scan outcome only; keep ALL evidence quarantined. Forensic review required.
  const failure=verdict==="clean"?"awaiting_human_review":
    verdict==="infected"?"malware_detected":"scan_indeterminate";
  const {data:updated,error:ue}=await sb.from("evidence_inspection_jobs")
    .update({scanner_name:"cloudmersive-basic-v1",scanned_at:new Date().toISOString(),
      failure_code:failure,attempts:Number(job.attempts||0)+1,updated_at:new Date().toISOString()})
    .eq("id",jobId).eq("state","quarantined").eq("failure_code","awaiting_antivirus_scan")
    .is("scanner_name",null).select("id").maybeSingle();
  if(ue||!updated)return reply(409,{error:"scan_record_conflict"});
  return reply(202,{job_id:jobId,state:"quarantined",
   scan_status:verdict==="clean"?"pending_human_review":verdict==="infected"?"blocked":"indeterminate",
   approved:false,member_access:false});
 }catch {
  // Deliberately avoid raw error logging (may carry private object metadata).
  return reply(503,{error:"scan_unavailable"});
 }
});
