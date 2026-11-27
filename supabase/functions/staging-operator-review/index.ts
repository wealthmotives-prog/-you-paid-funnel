// You Paid staging operator review service. STAGING ONLY (rzeodkcvljukaaczeibe). Default OFF.
// Server-side operator authorization (server-set app_metadata.yp_staging_operator + yp_synthetic_test).
// Decisions are written ONLY through yp_staging_record_review_decision(), which enforces, under a row lock:
//   no self-review, synthetic v0 evidence only, clean scan + verified SHA-256, owner's active operator_review
//   consent, no decision after a final one, review_started first. Ledger rows are append-only.
// Accepting evidence NEVER releases the file, issues a URL, or exposes it to anyone.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type ConsentRow, CONSENT_PURPOSE, environmentIsStaging, evaluateConsent } from "../_shared/pilot_consent_policy.ts";
import { isUuid } from "../_shared/evidence_upload_policy.ts";
import { FC, isStagingOperator, validateDecision } from "../_shared/inspection_policy.ts";
import { jsonReply, preflight, readSmallJson } from "../_shared/staging_http.ts";

// Artifacts in these review statuses have a final decision and are never offered for review again.
const TERMINAL_REVIEW_STATUSES = ["accepted_for_pilot_review", "rejected"];

const RPC_ERRORS: Record<string, number> = {
  operator_not_authorized: 403,
  artifact_not_found: 404, self_review_forbidden: 403, not_eligible_synthetic_evidence: 403,
  inspection_job_missing: 409, scan_not_clean_or_hash_unverified: 409, owner_review_consent_missing: 409,
  decision_already_final: 409, review_not_started: 409,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  const reply = (s: number, p: Record<string, unknown>) => jsonReply(req, s, p);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const body = await readSmallJson(req, 8192);
  if (!environmentIsStaging(url) || Deno.env.get("YOU_PAID_STAGING_REVIEW_ENABLED") !== "true" || !serviceKey)
    return reply(503, { error: "staging_review_not_enabled" });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const bearer = req.headers.get("authorization") || "";
  const jwt = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!jwt || jwt === serviceKey) return reply(401, { error: "operator_session_required" });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth?.user?.id) return reply(401, { error: "invalid_session" });
  const operator = auth.user;
  if (!isStagingOperator(operator.app_metadata)) return reply(403, { error: "staging_operator_required" });
  if (!body) return reply(400, { error: "invalid_json" });

  const eligibleForReview = async (artifactId: string): Promise<string> => {
    const { data: a, error } = await admin.from("evidence_artifacts").select("id,user_id,metadata").eq("id", artifactId).maybeSingle();
    if (error) throw new Error("artifact_read_failed");
    if (!a) return "not_found";
    if (a.user_id === operator.id) return "self_review_forbidden";
    if (a.metadata?.intake !== "staging-evidence-upload-v0" || a.metadata?.synthetic !== true) return "not_eligible_synthetic_evidence";
    const { data: owner, error: oErr } = await admin.auth.admin.getUserById(a.user_id);
    if (oErr) throw new Error("owner_read_failed");
    if (owner?.user?.app_metadata?.["yp_synthetic_test"] !== true) return "not_eligible_synthetic_evidence";
    return "ok";
  };

  try {
    if (body.action === "queue") {
      // Metadata only: no file bytes, no storage paths, no URLs. Excludes the operator's own evidence.
      const { data: jobs, error } = await admin.from("evidence_inspection_jobs")
        .select("id,artifact_id,failure_code,attempts,scanned_at,actual_sha256")
        .eq("state", "quarantined").in("failure_code", [FC.AWAITING_REVIEW]).order("scanned_at", { ascending: true }).limit(50);
      if (error) throw new Error("queue_read_failed");
      const ids = (jobs ?? []).map((j) => j.artifact_id);
      const { data: arts, error: aErr } = ids.length
        ? await admin.from("evidence_artifacts").select("id,user_id,employment_id,content_hash,review_status,received_at,metadata").in("id", ids)
        : { data: [], error: null };
      if (aErr) throw new Error("artifact_read_failed");
      const byId = new Map((arts ?? []).map((a) => [a.id, a]));
      // CR-3: an item is listed only if it is synthetic v0 evidence, not the operator's own, not already decided, and its
      // owner is STILL a server-marked synthetic test account holding an active operator_review consent right now.
      const candidates = (jobs ?? []).map((j) => ({ j, a: byId.get(j.artifact_id) })).filter(({ a }) =>
        !!a && a.user_id !== operator.id && a.metadata?.intake === "staging-evidence-upload-v0" && a.metadata?.synthetic === true &&
        !TERMINAL_REVIEW_STATUSES.includes(a.review_status));
      const owners = [...new Set(candidates.map(({ a }) => a!.user_id as string))];
      const eligibleOwners = new Set<string>();
      if (owners.length) {
        const { data: crow, error: cqErr } = await admin.from("pilot_evidence_consents")
          .select("id,user_id,purpose,consent_version,scope,granted_at,revoked_at,expires_at,consent_text_sha256")
          .in("user_id", owners).eq("purpose", CONSENT_PURPOSE).order("granted_at", { ascending: false }).limit(500);
        if (cqErr) throw new Error("consent_read_failed");
        const now = new Date();
        for (const uid of owners) {
          const own = ((crow ?? []) as ConsentRow[]).filter((r) => r.user_id === uid);
          if (!evaluateConsent(own, uid, "operator_review", now).allowed) continue;
          const { data: owner, error: oErr } = await admin.auth.admin.getUserById(uid);
          if (oErr) throw new Error("owner_read_failed");
          if (owner?.user?.app_metadata?.["yp_synthetic_test"] === true) eligibleOwners.add(uid);
        }
      }
      const items = candidates.filter(({ a }) => eligibleOwners.has(a!.user_id)).map(({ j, a }) => ({
        artifact_id: a!.id, job_id: j.id, review_status: a!.review_status, received_at: a!.received_at,
        size_bytes: a!.metadata?.size_bytes ?? null, sha256: a!.content_hash, sha256_verified: j.actual_sha256 === a!.content_hash,
        scan: j.failure_code, scanned_at: j.scanned_at }));
      return reply(200, { items, withheld: (jobs ?? []).length - items.length });
    }

    if (body.action === "history") {
      if (!isUuid(body.artifact_id)) return reply(400, { error: "artifact_id_required" });
      // Authorize the RECORD before returning any events: synthetic v0 intake, owner is a server-marked test
      // account, and not the operator's own evidence. Unknown -> 404; anything else -> 403.
      const elig = await eligibleForReview(body.artifact_id);
      if (elig === "not_found") return reply(404, { error: "artifact_not_found" });
      if (elig !== "ok") return reply(403, { error: elig });
      const { data, error } = await admin.from("pilot_evidence_review_events")
        .select("id,event_type,reason_code,rationale,operator_id,recorded_at").eq("artifact_id", body.artifact_id)
        .order("recorded_at", { ascending: true });
      if (error) throw new Error("history_read_failed");
      return reply(200, { artifact_id: body.artifact_id, events: data ?? [] });
    }

    if (body.action !== "decide") return reply(400, { error: "unknown_action" });
    const { action: _a, ...decision } = body;
    const v = validateDecision(decision);
    if (!v.ok) return reply(422, { error: v.reason });
    const elig = await eligibleForReview(v.artifact_id);
    if (elig === "not_found") return reply(404, { error: "artifact_not_found" });
    if (elig !== "ok") return reply(403, { error: elig });
    const { data: art, error: artErr } = await admin.from("evidence_artifacts").select("id,user_id").eq("id", v.artifact_id).maybeSingle();
    if (artErr) throw new Error("artifact_read_failed");
    if (!art) return reply(404, { error: "artifact_not_found" });
    const { data: rows, error: cErr } = await admin.from("pilot_evidence_consents")
      .select("id,user_id,purpose,consent_version,scope,granted_at,revoked_at,expires_at,consent_text_sha256")
      .eq("user_id", art.user_id).eq("purpose", CONSENT_PURPOSE).order("granted_at", { ascending: false }).limit(20);
    if (cErr) throw new Error("consent_read_failed");
    const consent = evaluateConsent((rows ?? []) as ConsentRow[], art.user_id, "operator_review", new Date());
    if (!consent.allowed) return reply(409, { error: "owner_review_consent_missing", reason: consent.reason });
    const { data, error } = await admin.rpc("yp_staging_record_review_decision", {
      p_artifact_id: v.artifact_id, p_operator_id: operator.id, p_event_type: v.event_type,
      p_reason_code: v.reason_code, p_rationale: v.rationale, p_consent_id: consent.consent_id,
    });
    if (error) {
      const key = Object.keys(RPC_ERRORS).find((k) => (error.message || "").includes(k));
      if (key) return reply(RPC_ERRORS[key], { error: key });
      throw new Error("decision_rpc_failed");
    }
    return reply(201, { ...data, artifact_id: v.artifact_id, event_type: v.event_type, released: false, member_access: false });
  } catch (err) {
    console.error("staging-operator-review failure", err instanceof Error ? err.message : "unknown");
    return reply(500, { error: "review_service_failed" });
  }
});
