// WorkVerify Employer Response Edge Function — DEVELOPMENT SOURCE ONLY.
// This file is not deployed. Do not expose as a public endpoint without completed
// abuse/rate controls, verification-flow integration, synthetic tests and consent checks.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async (req: Request) => {
  // Fail closed until audited launch authorization and rate limiting are configured.
  // Never place service-role credentials in client-side HTML.
  return new Response(JSON.stringify({
    error: "employer_confirmation_not_live",
    message: "Employer confirmation is not accepting responses yet."
  }), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    }
  });
});
