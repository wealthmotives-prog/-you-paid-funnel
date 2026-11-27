// Shared HTTP helpers for You Paid STAGING functions. Pure apart from Request/Response.

// Only the you-paid Vercel preview deployments (SSO-protected, team-only) may call staging functions from a browser.
const ALLOWED_ORIGIN = /^https:\/\/you-paid-[a-z0-9-]+-wealthmotives-6336\.vercel\.app$/;

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGIN.test(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-employment-id, x-client-info",
    "Access-Control-Max-Age": "600",
  };
}

export function originAllowed(origin: string | null): boolean {
  return !!origin && ALLOWED_ORIGIN.test(origin);
}

export function jsonReply(req: Request, status: number, payload: Record<string, unknown>): Response {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...corsHeaders(req.headers.get("origin")) },
  });
}

/** Preflight: answered only for allow-listed origins; everything else gets a bare 403. */
export function preflight(req: Request): Response {
  const h = corsHeaders(req.headers.get("origin"));
  return new Response(null, { status: Object.keys(h).length ? 204 : 403, headers: h });
}

/** Read a small JSON body with a hard byte cap. Returns null on any problem. */
export async function readSmallJson(req: Request, max = 4096): Promise<Record<string, unknown> | null> {
  try {
    const raw = await req.text();
    if (raw.length > max) return null;
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
  } catch { return null; }
}
