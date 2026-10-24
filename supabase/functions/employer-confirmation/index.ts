// WorkVerify employer confirmation endpoint. STAGED SOURCE ONLY.
// OFF until explicit server-side enablement, independent contact verification,
// live synthetic QA and operator release approval. No website key can enable it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const responseHeaders: Record<string,string> = {
 "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"
};
const reply=(status:number,body:Record<string,unknown>)=>
 new Response(JSON.stringify(body),{status,headers:responseHeaders});
async function digest(input:string){
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
 return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async (req:Request)=>{
 if(Deno.env.get("WORKVERIFY_EMPLOYER_INTAKE_ENABLED")!=="true")
  return reply(503,{error:"employer_confirmation_not_live",message:"Employer confirmation is not accepting responses yet."});
 if(req.method!=="POST")return reply(405,{error:"method_not_allowed"});
 if(req.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json")
  return reply(415,{error:"application_json_required"});
 const size=Number(req.headers.get("content-length")||0);
 if(!Number.isFinite(size)||size>2048)return reply(413,{error:"request_too_large"});
 const raw=await req.text();
 if(raw.length>2048)return reply(413,{error:"request_too_large"});
 let payload:Record<string,unknown>;
 try{
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("invalid");
  payload=parsed as Record<string,unknown>;
 }catch{return reply(400,{error:"invalid_request"});}
 const fields=["token","employment","dates","schedule","role"];
 if(Object.keys(payload).some(k=>!fields.includes(k))||
   fields.some(k=>typeof payload[k]!=="string"))return reply(400,{error:"invalid_request"});
 const token=payload.token as string,role=(payload.role as string).trim();
 if(!/^[a-f0-9]{64}$/.test(token)||
  !["yes","no","unknown"].includes(payload.employment as string)||
  !["yes","no","unknown"].includes(payload.dates as string)||
  !["yes","no","unknown"].includes(payload.schedule as string)||
  role.length<2||role.length>80)return reply(400,{error:"invalid_request"});
 const url=Deno.env.get("SUPABASE_URL");
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const salt=Deno.env.get("WORKVERIFY_RATE_SALT");
 if(!url||!key||!salt||salt.length<32)return reply(503,{error:"intake_not_configured"});
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 // Token-specific throttle, avoiding reliance on forgeable client IP headers.
 // Second independent, coarse server-wide limit catches rotated guessed tokens.
 // It is deliberately NOT IP-based: untrusted X-Forwarded-For is attacker-controlled.
 // This global budget can be exhausted by an attacker, so edge WAF controls are
 // still required before enabling intake.
 const globalBucket=await digest("workverify:global:"+salt);
 const {data:globalAllowed,error:globalGateError}=await sb.rpc("yp_workverify_abuse_gate",{
  p_bucket_hash:globalBucket,p_max_hits:300,p_window_seconds:3600
 });
 if(globalGateError||globalAllowed!==true)return reply(429,{error:"request_unavailable"});
 const bucket=await digest("workverify:"+salt+":"+token);
 const {data:allowed,error:gateError}=await sb.rpc("yp_employer_response_rate_gate",{
  p_bucket_hash:bucket,p_max_hits:8,p_window_seconds:3600
 });
 if(gateError||allowed!==true)return reply(429,{error:"request_unavailable"});
 const {data,error}=await sb.rpc("yp_consume_employer_invitation",{
  p_token:token,p_employment:payload.employment,p_dates:payload.dates,
  p_schedule:payload.schedule,p_role:role
 });
 if(error||data?.received!==true)return reply(400,{error:"invitation_unavailable"});
 return reply(202,{received:true,status:"pending_review",employment_verified:false});
});
