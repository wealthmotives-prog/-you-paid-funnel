// You Paid staging inspection-job processor. STAGING ONLY (rzeodkcvljukaaczeibe). Default OFF.
// Invoked by a server-marked staging operator. Synthetic evidence only.
//   action "process":   claim job (compare-and-set) -> eligibility -> owner consent -> download exact quarantined
//                       object -> recompute SHA-256 == artifact == job path -> PDF re-validation -> Cloudmersive
//                       (bounded, timed) -> record verdict. The file ALWAYS stays quarantined; nothing is approved.
//   action "reconcile": independently re-hash a reconciliation_required artifact's object and repair it through
//                       the atomic, audited yp_staging_reconcile_artifact() (never deletes anything).
// The existing evidence-cloudmersive-scanner and its engineering lock are NOT used or changed.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type ConsentRow, CONSENT_PURPOSE, environmentIsStaging, evaluateConsent } from "../_shared/pilot_consent_policy.ts";
import { checkPdfBytes, EVIDENCE_BUCKET, isUuid, sha256Hex } from "../_shared/evidence_upload_policy.ts";
import {
  claimable, FC, failureCodeAfterScan, isStagingOperator, type Job, MAX_VENDOR_RESPONSE_BYTES, SCANNER_NAME,
  VENDOR_TIMEOUT_MS, vendorVerdict,
} from "../_shared/inspection_policy.ts";
import { jsonReply, preflight, readSmallJson } from "../_shared/staging_http.ts";

const INTAKE = "staging-evidence-upload-v0";
const ENDPOINT = "https://api.cloudmersive.com/virus/scan/file";

async function boundedJson(res: Response, max: number): Promise<unknown> {
  if (!res.body) throw new Error("missing_body");
  const reader = res.body.getReader();
  const parts: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) { await reader.cancel().catch(() => {}); throw new Error("response_too_large"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const buf = new Uint8Array(total); let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buf));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  const reply = (s: number, p: Record<string, unknown>) => jsonReply(req, s, p);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const body = await readSmallJson(req); // always consume the (small) body first
  if (!environmentIsStaging(url) || Deno.env.get("YOU_PAID_STAGING_SCAN_ENABLED") !== "true" || !serviceKey)
    return reply(503, { error: "staging_scan_not_enabled" });
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

  // Shared: load an artifact and confirm it is synthetic v0 evidence owned by a server-marked test account.
  const eligibleArtifact = async (artifactId: string) => {
    const { data: a, error } = await admin.from("evidence_artifacts")
      .select("id,user_id,content_hash,storage_reference,review_status,metadata").eq("id", artifactId).maybeSingle();
    if (error) throw new Error("artifact_read_failed");
    if (!a) return null;
    const { data: owner, error: oErr } = await admin.auth.admin.getUserById(a.user_id);
    if (oErr) throw new Error("owner_read_failed");
    const ok = a.metadata?.intake === INTAKE && a.metadata?.synthetic === true &&
      owner?.user?.app_metadata?.["yp_synthetic_test"] === true;
    return { a, ok };
  };
  const download = async (path: string) => {
    const { data: file, error } = await admin.storage.from(EVIDENCE_BUCKET).download(path);
    if (error || !file) return null;
    return new Uint8Array(await file.arrayBuffer());
  };

  try {
    if (body.action === "reconcile") {
      const artifactId = body.artifact_id;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!isUuid(artifactId)) return reply(400, { error: "artifact_id_required" });
      if (reason.length < 10) return reply(400, { error: "reason_required" });
      const e = await eligibleArtifact(artifactId);
      if (!e) return reply(404, { error: "artifact_not_found" });
      if (!e.ok) return reply(403, { error: FC.NOT_ELIGIBLE });
      const path = String(e.a.storage_reference).replace(EVIDENCE_BUCKET + "/", "");
      const bytes = await download(path);
      const verified = bytes ? await sha256Hex(bytes) : null;
      const { data, error } = await admin.rpc("yp_staging_reconcile_artifact", {
        p_artifact_id: artifactId, p_actor_id: operator.id, p_reason: reason, p_verified_sha256: verified,
      });
      if (error) throw new Error("reconcile_rpc_failed");
      return reply(data?.reconciled ? 200 : 409, { ...data, object_present: !!bytes, verified_sha256: verified,
        hash_matches: verified !== null && verified === e.a.content_hash });
    }

    if (body.action !== "process") return reply(400, { error: "unknown_action" });
    const jobId = body.job_id;
    if (!isUuid(jobId)) return reply(400, { error: "job_id_required" });
    const { data: job, error: jobErr } = await admin.from("evidence_inspection_jobs")
      .select("id,artifact_id,bucket_id,object_path,state,failure_code,attempts,updated_at,scanner_name,actual_sha256")
      .eq("id", jobId).maybeSingle();
    if (jobErr) throw new Error("job_read_failed");
    if (!job) return reply(404, { error: "job_not_found" });
    const now = new Date();
    const c = claimable(job as Job, now);
    if (!c.ok) return reply(409, { error: "job_not_claimable", reason: c.reason, failure_code: job.failure_code, attempts: job.attempts });
    // Configuration check BEFORE claiming, so a missing vendor key never consumes a retry.
    const vendorKey = Deno.env.get("CLOUDMERSIVE_API_KEY") || "";
    if (!vendorKey) return reply(503, { error: "scanner_not_configured" });

    // Compare-and-set claim: only succeeds if nobody changed the job since we read it.
    const attempt = job.attempts + 1;
    const { data: claimed, error: claimErr } = await admin.from("evidence_inspection_jobs")
      .update({ state: "quarantined", failure_code: FC.IN_PROGRESS, attempts: attempt, updated_at: now.toISOString() })
      .eq("id", jobId).eq("attempts", job.attempts).eq("updated_at", job.updated_at)
      .select("id").maybeSingle();
    if (claimErr) throw new Error("claim_failed");
    if (!claimed) return reply(409, { error: "claim_lost_to_concurrent_worker" });

    // From here on every exit must record a terminal or retryable code under OUR claim.
    const finish = async (code: string, extra: Record<string, unknown>, sha: string | null, scanned: boolean) => {
      const patch: Record<string, unknown> = { failure_code: code, updated_at: new Date().toISOString(), state: "quarantined" };
      if (sha) patch.actual_sha256 = sha;
      if (scanned) { patch.scanner_name = SCANNER_NAME; patch.scanned_at = new Date().toISOString(); }
      const { data: done, error } = await admin.from("evidence_inspection_jobs").update(patch)
        .eq("id", jobId).eq("failure_code", FC.IN_PROGRESS).eq("attempts", attempt).select("id").maybeSingle();
      if (error || !done) return reply(409, { error: "claim_record_conflict", attempted_code: code });
      return reply(200, { job_id: jobId, attempt, failure_code: code, state: "quarantined", approved: false,
        released: false, member_access: false, ...extra });
    };

    const e = await eligibleArtifact(job.artifact_id);
    if (!e || !e.ok) return await finish(FC.NOT_ELIGIBLE, {}, null, false);
    const a = e.a;
    if (job.bucket_id !== EVIDENCE_BUCKET || a.storage_reference !== `${EVIDENCE_BUCKET}/${job.object_path}` ||
        !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(job.object_path))
      return await finish(FC.INTEGRITY, { detail: "linkage_mismatch" }, null, false);

    // Consent: the owner must still hold an active upload consent (withdrawal stops processing).
    const { data: rows, error: cErr } = await admin.from("pilot_evidence_consents")
      .select("id,user_id,purpose,consent_version,scope,granted_at,revoked_at,expires_at,consent_text_sha256")
      .eq("user_id", a.user_id).eq("purpose", CONSENT_PURPOSE).order("granted_at", { ascending: false }).limit(20);
    if (cErr) throw new Error("consent_read_failed");
    const consent = evaluateConsent((rows ?? []) as ConsentRow[], a.user_id, "upload_synthetic_evidence", new Date());
    if (!consent.allowed) return await finish(FC.CONSENT, { detail: consent.reason }, null, false);

    const bytes = await download(job.object_path);
    if (!bytes) return await finish(FC.OBJECT_MISSING, {}, null, false);
    const digest = await sha256Hex(bytes);
    if (digest !== a.content_hash) return await finish(FC.INTEGRITY, { detail: "sha256_mismatch", actual_sha256: digest }, digest, false);
    const pdf = checkPdfBytes(bytes);
    if (!pdf.ok) return await finish(FC.PREFLIGHT, { detail: pdf.reason }, digest, false);

    let verdict;
    try {
      const form = new FormData();
      form.append("inputFile", new Blob([bytes], { type: "application/pdf" }), "evidence.pdf");
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "Apikey": vendorKey }, body: form,
        signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS), redirect: "error" });
      let payload: unknown = null;
      if (res.status === 200) {
        try { payload = await boundedJson(res, MAX_VENDOR_RESPONSE_BYTES); } catch { payload = null; }
      } else { await res.body?.cancel().catch(() => {}); }
      verdict = vendorVerdict(res.status, payload);
    } catch (err) {
      verdict = vendorVerdict(null, null, err instanceof Error ? err.name : "error");
    }
    const code = failureCodeAfterScan(verdict, attempt);
    return await finish(code, { verdict: verdict.outcome, detail: verdict.detail, sha256_verified: true }, digest, true);
  } catch (err) {
    console.error("staging-inspection-processor failure", err instanceof Error ? err.message : "unknown");
    return reply(500, { error: "processor_failed" });
  }
});
