// You Paid synthetic-only Cloudmersive connectivity probe.
// NEVER accepts file uploads, user payloads, member IDs, or customer records.
// Service-role bearer required; manually invoked only by trusted operator.
// This probe sends a hard-coded fictional text fixture to Cloudmersive.
const ENDPOINT="https://api.cloudmersive.com/virus/scan/file";
const ALLOW_PROBE = false; // Explicit engineering release gate; not deployable live without review.
const reply=(status:number,data:Record<string,unknown>)=>Response.json(data,{
 status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});
function classify(input:unknown):"clean"|"infected"|"indeterminate"{
 if(!input||typeof input!=="object"||Array.isArray(input))return "indeterminate";
 const value=input as Record<string,unknown>;
 if(value.CleanResult===false)return "infected";
 if(value.CleanResult===true&&(value.FoundViruses===null||
   Array.isArray(value.FoundViruses)&&value.FoundViruses.length===0))return "clean";
 return "indeterminate";
}
async function readBounded(response:Response):Promise<unknown>{
 if(!response.body)throw new Error("empty_body");
 const reader=response.body.getReader();const parts:Uint8Array[]=[];
 let length=0;
 try {
  while(true){
   const {done,value}=await reader.read();if(done)break;
   length+=value.byteLength;
   if(length>8192)throw new Error("oversize_vendor_reply");
   parts.push(value);
  }
 }catch(e){await reader.cancel().catch(()=>{});throw e}
 finally{reader.releaseLock()}
 if(length===0)throw new Error("empty_vendor_reply");
 const out=new Uint8Array(length);let at=0;
 for(const part of parts){out.set(part,at);at+=part.length}
 return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(out));
}
Deno.serve(async(req:Request)=>{
 if(!ALLOW_PROBE)return reply(503,{error:"synthetic_vendor_probe_locked"});
 if(req.method!=="POST")return reply(405,{error:"method_not_allowed"});
 const master=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!master||req.headers.get("authorization")!==`Bearer ${master}`)
   return reply(403,{error:"forbidden"});
 // No dynamic payload accepted, even by a service-role caller.
 if(req.headers.get("content-length") && Number(req.headers.get("content-length"))>0)
   return reply(400,{error:"body_not_accepted"});
 const key=Deno.env.get("CLOUDMERSIVE_API_KEY")||"";
 if(!key)return reply(503,{error:"vendor_secret_not_configured"});
 const form=new FormData();
 const fake=new Blob(["Synthetic file for You Paid malware-scanner connectivity testing. No real people or payroll data.\n"],
  {type:"text/plain"});
 form.append("inputFile",fake,"synthetic-you-paid-scan-test.txt");
 try{
  const result=await fetch(ENDPOINT,{method:"POST",headers:{"Apikey":key},
   body:form,redirect:"error",signal:AbortSignal.timeout(15000)});
  if(!result.ok)return reply(502,{status:"vendor_error",http_status:result.status});
  const outcome=classify(await readBounded(result));
  return reply(200,{status:"synthetic_only",scan_result:outcome,member_data_scanned:false});
 }catch{return reply(502,{status:"vendor_unavailable"})}
});
