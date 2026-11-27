// You Paid staging inspection policy. STAGING ONLY. Pure logic, no I/O. Fails closed.
// Nothing in this module can approve, release, or expose evidence. A "clean" vendor verdict only
// advances a job to awaiting_human_review; the file stays quarantined.

export const MAX_SCAN_ATTEMPTS = 3;
export const CLAIM_TTL_MS = 5 * 60_000;
export const VENDOR_TIMEOUT_MS = 20_000;
export const MAX_VENDOR_RESPONSE_BYTES = 16_384;
export const SCANNER_NAME = "cloudmersive-basic-v1:staging-processor-v0";

export const FC = {
  AWAITING_SCAN: "awaiting_antivirus_scan",
  IN_PROGRESS: "scan_in_progress",
  AWAITING_REVIEW: "awaiting_human_review",
  MALWARE: "malware_detected",
  INDETERMINATE: "scan_indeterminate",
  RETRY_EXHAUSTED: "scan_retry_exhausted",
  INTEGRITY: "integrity_mismatch",
  PREFLIGHT: "preflight_mismatch",
  CONSENT: "consent_withdrawn",
  OBJECT_MISSING: "quarantined_object_missing",
  NOT_ELIGIBLE: "not_eligible_synthetic_evidence",
} as const;

export type Job = {
  id: string;
  artifact_id: string;
  state: string;
  failure_code: string | null;
  attempts: number;
  updated_at: string;
  scanner_name?: string | null;
  actual_sha256?: string | null;
};
export type Artifact = { id: string; review_status: string; content_hash: string };

/** Can this job be claimed by the processor right now? */
export function claimable(job: Job | null | undefined, now: Date): { ok: true } | { ok: false; reason: string } {
  if (!job) return { ok: false, reason: "job_missing" };
  if (!Number.isInteger(job.attempts) || job.attempts < 0) return { ok: false, reason: "attempts_invalid" };
  if (job.attempts >= MAX_SCAN_ATTEMPTS) return { ok: false, reason: "retry_budget_exhausted" };
  if (job.state === "queued" && job.failure_code === null) return { ok: true };
  if (job.state !== "quarantined") return { ok: false, reason: "state_not_claimable" };
  if (job.failure_code === FC.AWAITING_SCAN || job.failure_code === FC.INDETERMINATE) return { ok: true };
  if (job.failure_code === FC.IN_PROGRESS) {
    const t = Date.parse(job.updated_at);
    if (Number.isNaN(t)) return { ok: false, reason: "claim_time_invalid" };
    return now.getTime() - t > CLAIM_TTL_MS ? { ok: true } : { ok: false, reason: "claimed_by_another_worker" };
  }
  return { ok: false, reason: "terminal_or_unknown_state" };
}

export type Verdict = { outcome: "clean" | "infected" | "indeterminate"; retryable: boolean; detail: string };

/** Interpret the vendor result. HTTP 200 is never by itself "clean". */
export function vendorVerdict(httpStatus: number | null, payload: unknown, transportError?: string): Verdict {
  if (transportError) return { outcome: "indeterminate", retryable: true, detail: "transport:" + transportError.slice(0, 40) };
  if (httpStatus === null) return { outcome: "indeterminate", retryable: true, detail: "no_status" };
  if (httpStatus === 429 || httpStatus >= 500) return { outcome: "indeterminate", retryable: true, detail: "http_" + httpStatus };
  if (httpStatus !== 200) return { outcome: "indeterminate", retryable: false, detail: "http_" + httpStatus };
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { outcome: "indeterminate", retryable: true, detail: "malformed_payload" };
  const p = payload as Record<string, unknown>;
  if (typeof p.CleanResult !== "boolean") return { outcome: "indeterminate", retryable: true, detail: "clean_result_missing" };
  if (p.CleanResult === false) return { outcome: "infected", retryable: false, detail: "vendor_infected" };
  // CleanResult === true is only "clean" when FoundViruses is EXPLICITLY present and empty (null or []).
  if (!Object.prototype.hasOwnProperty.call(p, "FoundViruses"))
    return { outcome: "indeterminate", retryable: true, detail: "found_viruses_missing" };
  const viruses = p.FoundViruses;
  if (viruses === null || (Array.isArray(viruses) && viruses.length === 0))
    return { outcome: "clean", retryable: false, detail: "vendor_clean" };
  return { outcome: "indeterminate", retryable: true, detail: "ambiguous_payload" };
}

/** Failure code to record after a scan attempt. `attempts` is the count INCLUDING this attempt. */
export function failureCodeAfterScan(v: Verdict, attempts: number): string {
  if (v.outcome === "clean") return FC.AWAITING_REVIEW;
  if (v.outcome === "infected") return FC.MALWARE;
  if (!v.retryable) return FC.RETRY_EXHAUSTED;
  return attempts >= MAX_SCAN_ATTEMPTS ? FC.RETRY_EXHAUSTED : FC.INDETERMINATE;
}

// Job conditions under which a repeated upload of the same bytes may be reported as an accepted intake.
const HEALTHY_FAILURE_CODES: (string | null)[] = [null, FC.AWAITING_SCAN, FC.IN_PROGRESS, FC.AWAITING_REVIEW];

export type DuplicateDecision =
  | { status: 200; job_state: string; failure_code: string | null }
  | { status: 409; error: string; job_state: string; failure_code: string | null };

/**
 * Decide the response for a re-upload of bytes that already have an intake.
 * Only an artifact still in `received` with a present, healthy job may answer 200; anything missing,
 * failed, rejected, flagged, retrying, exhausted or unknown answers 409.
 */
export function duplicateDecision(artifact: Artifact | null | undefined, job: Job | null | undefined): DuplicateDecision {
  const js = job?.state ?? "missing";
  const fc = job?.failure_code ?? null;
  if (!artifact) return { status: 409, error: "prior_intake_unavailable", job_state: js, failure_code: fc };
  if (artifact.review_status === "reconciliation_required" || !job)
    return { status: 409, error: "reconciliation_required", job_state: js, failure_code: fc };
  if (artifact.review_status !== "received")
    return { status: 409, error: "prior_intake_not_in_good_standing", job_state: js, failure_code: fc };
  if (job.state !== "queued" && job.state !== "quarantined")
    return { status: 409, error: "prior_intake_not_in_good_standing", job_state: js, failure_code: fc };
  if (job.state === "queued" && fc !== null)
    return { status: 409, error: "prior_intake_not_in_good_standing", job_state: js, failure_code: fc };
  if (!HEALTHY_FAILURE_CODES.includes(fc))
    return { status: 409, error: "prior_intake_not_in_good_standing", job_state: js, failure_code: fc };
  return { status: 200, job_state: js, failure_code: fc };
}

// ---- Operator review --------------------------------------------------------------------------
export const OPERATOR_MARKER = "yp_staging_operator";
export const REVIEW_EVENT_TYPES = ["review_started", "needs_more_information", "rejected", "accepted_for_pilot_review"] as const;
export const REASON_CODES: Record<string, readonly string[]> = {
  review_started: ["operator_opened_review"],
  needs_more_information: ["document_illegible", "employer_not_identifiable", "dates_not_identifiable", "other_more_info"],
  rejected: ["not_work_evidence", "fictional_marker_missing", "integrity_concern", "duplicate_submission", "other_rejection"],
  accepted_for_pilot_review: ["evidence_consistent_with_record"],
};
export const TERMINAL_EVENTS = ["rejected", "accepted_for_pilot_review"];

export function isStagingOperator(appMetadata: Record<string, unknown> | null | undefined): boolean {
  return appMetadata?.[OPERATOR_MARKER] === true && appMetadata?.["yp_synthetic_test"] === true;
}

export function validateDecision(b: unknown):
  { ok: true; event_type: string; reason_code: string; rationale: string | null; artifact_id: string } | { ok: false; reason: string } {
  if (!b || typeof b !== "object" || Array.isArray(b)) return { ok: false, reason: "invalid_body" };
  const x = b as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof x.artifact_id !== "string" || !uuid.test(x.artifact_id)) return { ok: false, reason: "artifact_id_required" };
  if (typeof x.event_type !== "string" || !(REVIEW_EVENT_TYPES as readonly string[]).includes(x.event_type))
    return { ok: false, reason: "event_type_not_allowed" };
  const codes = REASON_CODES[x.event_type];
  if (typeof x.reason_code !== "string" || !codes.includes(x.reason_code)) return { ok: false, reason: "reason_code_not_allowed" };
  const rationale = typeof x.rationale === "string" ? x.rationale.trim() : "";
  if (rationale.length > 2000) return { ok: false, reason: "rationale_too_long" };
  if (x.event_type !== "review_started" && rationale.length < 10) return { ok: false, reason: "rationale_required" };
  if ("operator_id" in x) return { ok: false, reason: "operator_id_must_come_from_session" };
  return { ok: true, event_type: x.event_type, reason_code: x.reason_code, rationale: rationale || null, artifact_id: x.artifact_id };
}
