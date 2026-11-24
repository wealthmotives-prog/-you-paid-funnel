// You Paid staging pilot consent service. STAGING ONLY (rzeodkcvljukaaczeibe).
// Members never write public.pilot_evidence_consents directly; this function is the only path.
// Identity comes exclusively from the verified Supabase session JWT, never from the request body.
// Does NOT enable uploads, scanning, or release. Fails closed on every error.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ALLOWED_SCOPES, CONSENT_PURPOSE, CURRENT_CONSENT_VERSION, type ConsentRow,
  environmentIsStaging, evaluateConsent, expiryFor, validateGrantRequest,
} from "../_shared/pilot_consent_policy.ts";

const MAX_BODY = 4096;
const reply = (status: number, payload: Record<string, unknown>) =>
  Response.json(payload, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

Deno.serve(async (req: Request) => {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  // Hard environment gate: refuses to run anywhere except the staging project.
  if (!environmentIsStaging(url) || Deno.env.get("YOU_PAID_STAGING_CONSENT_ENABLED") !== "true" || !serviceKey)
    return reply(503, { error: "staging_consent_not_enabled" });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const bearer = req.headers.get("authorization") || "";
  const jwt = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  // The service-role key is not a member identity.
  if (!jwt || jwt === serviceKey) return reply(401, { error: "member_session_required" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth?.user?.id) return reply(401, { error: "invalid_session" });
  const userId = auth.user.id;

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return reply(413, { error: "body_too_large" });
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("shape");
  } catch {
    return reply(400, { error: "invalid_json" });
  }

  const now = new Date();
  const loadOwn = async (): Promise<ConsentRow[]> => {
    const { data, error } = await admin.from("pilot_evidence_consents")
      .select("id,user_id,purpose,consent_version,scope,granted_at,revoked_at,expires_at")
      .eq("user_id", userId).eq("purpose", CONSENT_PURPOSE)
      .order("granted_at", { ascending: false }).limit(20);
    if (error) throw new Error("consent_read_failed");
    return (data ?? []) as ConsentRow[];
  };

  try {
    switch (body.action) {
      case "status": {
        const rows = await loadOwn();
        const scopes = Object.fromEntries(
          ALLOWED_SCOPES.map((s) => [s, evaluateConsent(rows, userId, s, now)]),
        );
        return reply(200, { purpose: CONSENT_PURPOSE, current_version: CURRENT_CONSENT_VERSION, scopes });
      }
      case "grant": {
        const { action: _a, ...grantBody } = body;
        const v = validateGrantRequest(grantBody);
        if (!v.ok) return reply(422, { error: v.reason });
        const rows = await loadOwn();
        // Idempotent: an active consent covering every requested scope is returned, not duplicated.
        const covering = v.scope.map((s) => evaluateConsent(rows, userId, s, now));
        const ids = new Set(covering.map((d) => d.allowed ? d.consent_id : null));
        if (covering.every((d) => d.allowed) && ids.size === 1)
          return reply(200, { consent_id: [...ids][0], created: false });
        const { data, error } = await admin.from("pilot_evidence_consents").insert({
          user_id: userId, purpose: CONSENT_PURPOSE, consent_version: v.version, scope: v.scope,
          granted_at: now.toISOString(), expires_at: expiryFor(now), consent_source: "staging_member_portal",
        }).select("id,expires_at").single();
        if (error || !data) throw new Error("consent_write_failed");
        return reply(201, { consent_id: data.id, expires_at: data.expires_at, created: true });
      }
      case "revoke": {
        // Revokes every active consent for this member; scoped strictly to the verified user.
        const { data, error } = await admin.from("pilot_evidence_consents")
          .update({ revoked_at: now.toISOString() })
          .eq("user_id", userId).eq("purpose", CONSENT_PURPOSE).is("revoked_at", null)
          .select("id");
        if (error) throw new Error("consent_revoke_failed");
        return reply(200, { revoked: (data ?? []).map((r: { id: string }) => r.id) });
      }
      default:
        return reply(400, { error: "unknown_action" });
    }
  } catch (err) {
    console.error("staging-pilot-consent failure", err instanceof Error ? err.message : "unknown");
    return reply(500, { error: "consent_service_failed" });
  }
});
