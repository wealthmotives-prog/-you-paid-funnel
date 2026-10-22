// You Paid preflight inspector. NOT an antivirus scanner.
// Deliberately never emits a "clean" verdict or enables member upload.
import { createClient } from "npm:@supabase/supabase-js@2";
const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "you-paid-work-evidence";
const allowed: Record<string,string> = {"pdf":"application/pdf","png":"image/png","jpg":"image/jpeg"};
const hex = (bytes: Uint8Array) => Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
function signature(bytes:Uint8Array): string|null {
  if(bytes.length>=5 && [37,80,68,70,45].every((v,i)=>bytes[i]===v))return "pdf";
  if(bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return "png";
  if(bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return "jpg";
  return null;
}
Deno.serve(async(req)=>{
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  // The gateway validates a JWT, but ordinary member JWTs must never run a service-role worker.
  const bearer=req.headers.get("authorization")||"";
  if(!key || bearer!==`Bearer ${key}`)return new Response("Forbidden",{status:403});
  let jobId="";
  try {
    const input=await req.json(); jobId=String(input.job_id||"");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId))
      return new Response("Invalid job id",{status:400});
    const {data:j,error:fetchError}=await sb.from("evidence_inspection_jobs")
      .select("id,artifact_id,bucket_id,object_path,state,attempts")
      .eq("id",jobId).maybeSingle();
    if(fetchError)throw fetchError;
    if(!j)return new Response("Not found",{status:404});
    if(j.state!=="queued")return Response.json({job_id:jobId,state:j.state,processed:false});
    const {data:a,error:artError}=await sb.from("evidence_artifacts")
      .select("id,content_hash,storage_reference").eq("id",j.artifact_id).single();
    if(artError)throw artError;
    if(j.bucket_id!==BUCKET||a.storage_reference!==BUCKET+"/"+j.object_path)
      return new Response("Invalid evidence linkage",{status:409});
    const {data:blob,error:downloadError}=await sb.storage.from(BUCKET).download(j.object_path);
    if(downloadError)throw downloadError;
    const bytes=new Uint8Array(await blob.arrayBuffer());
    const digest=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)));
    const ext=j.object_path.split(".").at(-1)?.toLowerCase();
    const actual=signature(bytes);
    const valid=bytes.length>0&&bytes.length<=10485760&&actual!==null&&actual===ext&&digest===a.content_hash.toLowerCase();
    // Preflight only: valid documents remain quarantined pending independent antivirus scanning.
    const state="quarantined";
    const {error:updateError}=await sb.from("evidence_inspection_jobs")
      .update({state,attempts:j.attempts+1,actual_sha256:digest,
        failure_code:valid?"awaiting_antivirus_scan":"preflight_mismatch",
        updated_at:new Date().toISOString()})
      .eq("id",jobId).eq("state","queued");
    if(updateError)throw updateError;
    return Response.json({job_id:jobId,state,preflight_valid:valid,antivirus_scanned:false});
  }catch(err){
    console.error("Preflight inspection failed",err instanceof Error?err.name:"unknown");
    return new Response("Inspection failed",{status:500});
  }
});
