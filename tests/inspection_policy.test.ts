// Run: node --experimental-strip-types --test tests/inspection_policy.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimable, CLAIM_TTL_MS, duplicateDecision, FC, failureCodeAfterScan, isStagingOperator, type Job,
  MAX_SCAN_ATTEMPTS, validateDecision, vendorVerdict,
} from "../supabase/functions/_shared/inspection_policy.ts";

const NOW = new Date("2026-11-26T12:00:00Z");
const job = (o: Partial<Job> = {}): Job => ({ id: "j", artifact_id: "a", state: "queued", failure_code: null, attempts: 0,
  updated_at: "2026-11-26T11:59:00Z", ...o });
const art = (review_status = "received") => ({ id: "a", review_status, content_hash: "f".repeat(64) });

// ---- claiming ----
test("IP-01 fresh queued job is claimable", () => assert.deepEqual(claimable(job(), NOW), { ok: true }));
test("IP-02 awaiting scan / retryable indeterminate are claimable", () => {
  assert.deepEqual(claimable(job({ state: "quarantined", failure_code: FC.AWAITING_SCAN }), NOW), { ok: true });
  assert.deepEqual(claimable(job({ state: "quarantined", failure_code: FC.INDETERMINATE, attempts: 1 }), NOW), { ok: true });
});
test("IP-03 live claim is not stealable; stale claim is", () => {
  assert.deepEqual(claimable(job({ state: "quarantined", failure_code: FC.IN_PROGRESS, attempts: 1, updated_at: "2026-11-26T11:58:00Z" }), NOW),
    { ok: false, reason: "claimed_by_another_worker" });
  const stale = new Date(NOW.getTime() - CLAIM_TTL_MS - 1000).toISOString();
  assert.deepEqual(claimable(job({ state: "quarantined", failure_code: FC.IN_PROGRESS, attempts: 1, updated_at: stale }), NOW), { ok: true });
});
test("IP-04 retry budget is bounded", () =>
  assert.deepEqual(claimable(job({ state: "quarantined", failure_code: FC.INDETERMINATE, attempts: MAX_SCAN_ATTEMPTS }), NOW),
    { ok: false, reason: "retry_budget_exhausted" }));
test("IP-05 terminal states are never re-claimed", () => {
  for (const fc of [FC.AWAITING_REVIEW, FC.MALWARE, FC.RETRY_EXHAUSTED, FC.INTEGRITY, FC.PREFLIGHT, FC.CONSENT, FC.OBJECT_MISSING, FC.NOT_ELIGIBLE, "mystery"])
    assert.equal(claimable(job({ state: "quarantined", failure_code: fc, attempts: 1 }), NOW).ok, false, fc);
});
test("IP-06 missing / malformed jobs are not claimable", () => {
  assert.equal(claimable(null, NOW).ok, false);
  assert.equal(claimable(job({ attempts: -1 }), NOW).ok, false);
  assert.equal(claimable(job({ state: "approved" }), NOW).ok, false);
  assert.equal(claimable(job({ state: "queued", failure_code: FC.MALWARE }), NOW).ok, false);
  assert.equal(claimable(job({ state: "quarantined", failure_code: FC.IN_PROGRESS, attempts: 1, updated_at: "garbage" }), NOW).ok, false);
});

// ---- vendor verdicts: HTTP 200 alone is never clean ----
test("IP-07 explicit clean only", () => {
  assert.equal(vendorVerdict(200, { CleanResult: true, FoundViruses: null }).outcome, "clean");
  assert.equal(vendorVerdict(200, { CleanResult: true, FoundViruses: [] }).outcome, "clean");
});
test("IP-08 infected", () => assert.deepEqual(vendorVerdict(200, { CleanResult: false, FoundViruses: [{ VirusName: "EICAR" }] }),
  { outcome: "infected", retryable: false, detail: "vendor_infected" }));
test("IP-09 ambiguous / malformed 200 payloads are indeterminate", () => {
  for (const p of [null, {}, [], "ok", { CleanResult: "true" }, { CleanResult: true, FoundViruses: [{ VirusName: "x" }] }, { CleanResult: true, FoundViruses: "none" }])
    assert.equal(vendorVerdict(200, p).outcome, "indeterminate", JSON.stringify(p));
});
test("IP-10 transport errors, timeouts, 429 and 5xx are retryable indeterminate", () => {
  assert.deepEqual(vendorVerdict(null, null, "TimeoutError"), { outcome: "indeterminate", retryable: true, detail: "transport:TimeoutError" });
  assert.equal(vendorVerdict(429, null).retryable, true);
  assert.equal(vendorVerdict(503, null).retryable, true);
});
test("IP-11 other 4xx (auth/quota/config) are non-retryable indeterminate", () => {
  for (const s of [400, 401, 403, 404]) assert.deepEqual(vendorVerdict(s, null), { outcome: "indeterminate", retryable: false, detail: "http_" + s });
});
test("IP-12 failure code after scan", () => {
  assert.equal(failureCodeAfterScan({ outcome: "clean", retryable: false, detail: "" }, 1), FC.AWAITING_REVIEW);
  assert.equal(failureCodeAfterScan({ outcome: "infected", retryable: false, detail: "" }, 1), FC.MALWARE);
  assert.equal(failureCodeAfterScan({ outcome: "indeterminate", retryable: true, detail: "" }, 1), FC.INDETERMINATE);
  assert.equal(failureCodeAfterScan({ outcome: "indeterminate", retryable: true, detail: "" }, MAX_SCAN_ATTEMPTS), FC.RETRY_EXHAUSTED);
  assert.equal(failureCodeAfterScan({ outcome: "indeterminate", retryable: false, detail: "" }, 1), FC.RETRY_EXHAUSTED);
});

// ---- Review item 3: duplicate responses never misrepresent bad jobs as success ----
test("DUP-01 healthy prior intakes answer 200", () => {
  for (const j of [job(), job({ state: "quarantined", failure_code: FC.AWAITING_SCAN }), job({ state: "quarantined", failure_code: FC.IN_PROGRESS }),
                   job({ state: "quarantined", failure_code: FC.AWAITING_REVIEW })])
    assert.equal(duplicateDecision(art(), j).status, 200, JSON.stringify(j));
});
test("DUP-02 missing job or flagged artifact answers 409 reconciliation_required", () => {
  assert.deepEqual(duplicateDecision(art(), null), { status: 409, error: "reconciliation_required", job_state: "missing", failure_code: null });
  assert.equal(duplicateDecision(art("reconciliation_required"), job()).status, 409);
});
test("DUP-03 failed / exhausted / retrying / integrity / consent / object-missing / unknown jobs answer 409", () => {
  for (const fc of [FC.MALWARE, FC.RETRY_EXHAUSTED, FC.INDETERMINATE, FC.INTEGRITY, FC.PREFLIGHT, FC.CONSENT, FC.OBJECT_MISSING, FC.NOT_ELIGIBLE, "something_new"]) {
    const d = duplicateDecision(art(), job({ state: "quarantined", failure_code: fc, attempts: 1 }));
    assert.equal(d.status, 409, fc);
    assert.equal((d as { error: string }).error, "prior_intake_not_in_good_standing", fc);
  }
});
test("DUP-04 rejected / under review / accepted / unknown artifact statuses answer 409", () => {
  for (const rs of ["rejected", "under_review", "needs_more_information", "accepted_for_pilot_review", "approved", ""])
    assert.equal(duplicateDecision(art(rs), job()).status, 409, rs);
});
test("DUP-05 impossible job states answer 409", () => {
  assert.equal(duplicateDecision(art(), job({ state: "released" })).status, 409);
  assert.equal(duplicateDecision(art(), job({ state: "queued", failure_code: FC.MALWARE })).status, 409);
  assert.equal(duplicateDecision(null, job()).status, 409);
});

// ---- operator review ----
test("OR-01 operator requires BOTH server markers", () => {
  assert.equal(isStagingOperator({ yp_staging_operator: true, yp_synthetic_test: true }), true);
  for (const m of [null, {}, { yp_staging_operator: true }, { yp_synthetic_test: true }, { yp_staging_operator: "true", yp_synthetic_test: true }])
    assert.equal(isStagingOperator(m as never), false, JSON.stringify(m));
});
const A = "33333333-3333-4333-8333-333333333333";
test("OR-02 decision validation", () => {
  assert.equal(validateDecision({ artifact_id: A, event_type: "review_started", reason_code: "operator_opened_review" }).ok, true);
  assert.deepEqual(validateDecision({ artifact_id: A, event_type: "approved", reason_code: "x" }), { ok: false, reason: "event_type_not_allowed" });
  assert.deepEqual(validateDecision({ artifact_id: A, event_type: "rejected", reason_code: "because" }), { ok: false, reason: "reason_code_not_allowed" });
  assert.deepEqual(validateDecision({ artifact_id: A, event_type: "rejected", reason_code: "not_work_evidence", rationale: "short" }), { ok: false, reason: "rationale_required" });
  assert.deepEqual(validateDecision({ artifact_id: A, event_type: "accepted_for_pilot_review", reason_code: "evidence_consistent_with_record", rationale: "Fictional record matches.", operator_id: A }),
    { ok: false, reason: "operator_id_must_come_from_session" });
  assert.deepEqual(validateDecision({ artifact_id: "x", event_type: "review_started", reason_code: "operator_opened_review" }), { ok: false, reason: "artifact_id_required" });
});
