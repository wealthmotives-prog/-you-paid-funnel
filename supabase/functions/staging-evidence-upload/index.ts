// You Paid staging server-mediated evidence upload. STAGING ONLY (rzeodkcvljukaaczeibe). Default OFF.
// Chain: verified session -> identity gate -> active versioned consent -> owned employment record ->
//        bounded PDF validation -> SHA-256 -> server-owned quarantine path -> artifact + inspection job.
// The file is ONLY quarantined. Nothing here scans, approves, releases, or exposes the file to anyone.
// Members cannot write Storage or these tables directly (RESTRICTIVE hard pause + no grants); this
// function uses the service role and therefore performs every ownership/consent check itself.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type ConsentRow, CONSENT_PURPOSE, environmentIsStaging, evaluateConsent, identityAllowsScopes,
} from "../_shared/pilot_consent_policy.ts";
import {
  checkHeaders, checkPdfBytes, EVIDENCE_BUCKET, MAX_UPLOAD_BYTES, objectPathFor, readBounded,
  sha256Hex, storageReferenceFor, UPLOAD_SCOPE,
} from "../_shared/evidence_upload_policy.ts";

const INTAKE_VERSION = "staging-evidence-upload-v0";
const reply = (status: number, payload: Record<string, unknown>) =>
  Response.json(payload, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

Deno.serve(async (req: Request) => {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!environmentIsStaging(url) || Deno.env.get("YOU_PAID_STAGING_UPLOAD_ENABLED") !== "true" || !serviceKey)
    return reply(503, { error: "staging_upload_not_enabled" });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const bearer = req.headers.get("authorization") || "";
  const jwt = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!jwt || jwt === serviceKey) return reply(401, { error: "member_session_required" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth?.user?.id) return reply(401, { error: "invalid_session" });
  const user = auth.user;
  const userId = user.id;

  const idGate = identityAllowsScopes(user, [UPLOAD_SCOPE]);
  if (!idGate.ok) return reply(403, { error: idGate.reason });

  const employmentId = req.headers.get("x-employment-id");
  const hdr = checkHeaders({
    contentType: req.headers.get("content-type"),
    contentLength: req.headers.get("content-length"),
    employmentId,
  });
  if (!hdr.ok) return reply(hdr.status, { error: hdr.reason });

  const consentFor = async () => {
    const { data, error } = await admin.from("pilot_evidence_consents")
      .select("id,user_id,purpose,consent_version,scope,granted_at,revoked_at,expires_at,consent_text_sha256")
      .eq("user_id", userId).eq("purpose", CONSENT_PURPOSE)
      .order("granted_at", { ascending: false }).limit(20);
    if (error) throw new Error("consent_read_failed");
    const rows = (data ?? []) as ConsentRow[];
    return { decision: evaluateConsent(rows, userId, UPLOAD_SCOPE, new Date()), rows };
  };

  try {
    // 1) Consent before reading the body.
    const pre = await consentFor();
    if (!pre.decision.allowed) return reply(403, { error: pre.decision.reason });

    // 2) The employment record must belong to this member (also enforced by the composite FK).
    const { data: emp, error: empError } = await admin.from("employment_records")
      .select("id").eq("id", employmentId!).eq("user_id", userId).maybeSingle();
    if (empError) throw new Error("employment_read_failed");
    if (!emp) return reply(404, { error: "employment_record_not_found" });

    // 3) Bounded read + real-content validation.
    const bytes = await readBounded(req.body, MAX_UPLOAD_BYTES);
    if (bytes === null) return reply(413, { error: "file_too_large" });
    const pdf = checkPdfBytes(bytes);
    if (!pdf.ok) return reply(pdf.status, { error: pdf.reason });
    const digest = await sha256Hex(bytes);

    // 4) Re-check consent immediately before any write (revocation during upload wins).
    const live = await consentFor();
    if (!live.decision.allowed) return reply(403, { error: live.decision.reason });
    const consentId = live.decision.consent_id;
    const consentRow = live.rows.find((r) => r.id === consentId)!;

    // 5) Idempotent retry: the same bytes for the same member + employment record return the existing intake.
    const { data: dup, error: dupError } = await admin.from("evidence_artifacts")
      .select("id").eq("user_id", userId).eq("employment_id", employmentId!).eq("content_hash", digest)
      .eq("metadata->>intake", INTAKE_VERSION).limit(1).maybeSingle();
    if (dupError) throw new Error("duplicate_check_failed");
    if (dup) {
      const { data: dj } = await admin.from("evidence_inspection_jobs").select("id,state").eq("artifact_id", dup.id).maybeSingle();
      return reply(200, { artifact_id: dup.id, job_id: dj?.id ?? null, job_state: dj?.state ?? "missing",
        sha256: digest, duplicate: true, quarantined: true, scanned: false, approved: false });
    }

    // 6) Server-owned path; never client-chosen; never overwrite.
    const artifactId = crypto.randomUUID();
    const objectPath = objectPathFor(userId, artifactId);
    const { error: upError } = await admin.storage.from(EVIDENCE_BUCKET)
      .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false, cacheControl: "no-store" });
    if (upError) return reply(503, { error: "quarantine_write_failed", recorded: false });

    // 7) Artifact record. If it fails, remove the just-written orphan object (nothing references it yet).
    const { error: artError } = await admin.from("evidence_artifacts").insert({
      id: artifactId, user_id: userId, employment_id: employmentId, artifact_type: "other",
      content_hash: digest, storage_reference: storageReferenceFor(objectPath), evidence_level: 1,
      review_status: "received",
      metadata: {
        intake: INTAKE_VERSION, synthetic: true, size_bytes: bytes.length, content_type: "application/pdf",
        consent_id: consentId, consent_version: consentRow.consent_version,
        consent_text_sha256: consentRow.consent_text_sha256, synthetic_test_account: idGate.synthetic,
      },
    });
    if (artError) {
      const { error: rmError } = await admin.storage.from(EVIDENCE_BUCKET).remove([objectPath]);
      if (artError.code === "23505") {
        // Lost a race with a concurrent identical upload (partial unique index): return that intake instead.
        const { data: winner } = await admin.from("evidence_artifacts").select("id")
          .eq("user_id", userId).eq("employment_id", employmentId!).eq("content_hash", digest)
          .eq("metadata->>intake", INTAKE_VERSION).maybeSingle();
        return reply(409, { error: "concurrent_duplicate", artifact_id: winner?.id ?? null,
          orphan_object_removed: !rmError, recorded: false });
      }
      console.error("upload: artifact insert failed", artError.code ?? "unknown", "orphan_removed", !rmError);
      return reply(500, { error: "artifact_record_failed", recorded: false, orphan_object_removed: !rmError });
    }

    // 8) Inspection job. If it fails, NEVER report success; flag the artifact for reconciliation (no deletion).
    const { data: job, error: jobError } = await admin.from("evidence_inspection_jobs")
      .insert({ artifact_id: artifactId, bucket_id: EVIDENCE_BUCKET, object_path: objectPath, state: "queued" })
      .select("id,state").single();
    if (jobError || !job) {
      await admin.from("evidence_artifacts").update({ review_status: "reconciliation_required" }).eq("id", artifactId);
      console.error("upload: job insert failed", jobError?.code ?? "unknown", artifactId);
      return reply(500, { error: "inspection_job_failed", artifact_id: artifactId, reconciliation_required: true });
    }

    return reply(201, {
      artifact_id: artifactId, job_id: job.id, job_state: job.state, sha256: digest, size_bytes: bytes.length,
      consent_id: consentId, duplicate: false, quarantined: true, scanned: false, approved: false,
    });
  } catch (err) {
    console.error("staging-evidence-upload failure", err instanceof Error ? err.message : "unknown");
    return reply(500, { error: "upload_service_failed" });
  }
});
