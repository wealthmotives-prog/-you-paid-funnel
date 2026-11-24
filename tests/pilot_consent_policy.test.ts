// Run: node --experimental-strip-types --test tests/pilot_consent_policy.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  CONSENT_DOCUMENTS, CONSENT_PURPOSE as P, CURRENT_CONSENT_VERSION as V, type ConsentRow,
  environmentIsStaging, evaluateConsent, expiryFor, identityAllowsScopes, isSyntheticTestIdentity,
  validateGrantRequest,
} from "../supabase/functions/_shared/pilot_consent_policy.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-11-24T12:00:00Z");
const DOC = CONSENT_DOCUMENTS[V];
const row = (o: Partial<ConsentRow> = {}): ConsentRow => ({
  id: "c1", user_id: A, purpose: P, consent_version: V, scope: ["upload_synthetic_evidence"],
  granted_at: "2026-11-24T10:00:00Z", revoked_at: null, expires_at: "2026-12-24T10:00:00Z",
  consent_text_sha256: DOC.sha256, ...o,
});
const deny = (rows: ConsentRow[] | null, reason: string, scope = "upload_synthetic_evidence", user = A) =>
  assert.deepEqual(evaluateConsent(rows, user, scope, NOW), { allowed: false, reason });

test("CON-01 environment gate accepts only staging", () => {
  assert.equal(environmentIsStaging("https://rzeodkcvljukaaczeibe.supabase.co"), true);
  assert.equal(environmentIsStaging("https://xknfxcyezchtypaisieu.supabase.co"), false);
  assert.equal(environmentIsStaging("https://rzeodkcvljukaaczeibe.supabase.co.evil.example"), false);
  assert.equal(environmentIsStaging("https://xknfxcyezchtypaisieu.rzeodkcvljukaaczeibe.supabase.co"), false);
  assert.equal(environmentIsStaging(""), false);
  assert.equal(environmentIsStaging("not a url"), false);
});
test("CON-02 valid active consent allows", () =>
  assert.deepEqual(evaluateConsent([row()], A, "upload_synthetic_evidence", NOW), { allowed: true, consent_id: "c1" }));
test("CON-03 absent consent denies", () => { deny([], "consent_absent"); deny(null, "consent_absent"); });
test("CON-04 revoked consent denies", () => deny([row({ revoked_at: "2026-11-24T11:00:00Z" })], "consent_revoked"));
test("CON-05 unparseable revocation treated as revoked", () => deny([row({ revoked_at: "garbage" })], "consent_revoked"));
test("CON-06 expired consent denies", () => deny([row({ expires_at: "2026-11-24T11:59:59Z" })], "consent_expired"));
test("CON-07 missing expiry denies", () => deny([row({ expires_at: null })], "expiry_required"));
test("CON-08 outdated version denies", () => deny([row({ consent_version: "staging-pilot-evidence-consent-v1" })], "consent_version_outdated"));
test("CON-09 wrong purpose denies", () => deny([row({ purpose: "marketing" })], "purpose_mismatch"));
test("CON-10 cross-member row never authorizes", () => deny([row({ user_id: B })], "ownership_mismatch"));
test("CON-11 scope not granted denies", () => deny([row()], "scope_not_granted", "operator_review"));
test("CON-12 unknown scope denies", () => deny([row()], "unknown_scope", "release_to_bureau"));
test("CON-13 invalid user id denies", () => deny([row()], "invalid_user", "upload_synthetic_evidence", "x"));
test("CON-14 future-dated grant denies", () => deny([row({ granted_at: "2026-11-25T00:00:00Z" })], "grant_time_invalid"));
test("CON-15 newer revoked + older active: older active still evaluated", () => {
  const r = evaluateConsent([row({ id: "new", granted_at: "2026-11-24T11:00:00Z", revoked_at: "2026-11-24T11:30:00Z" }),
    row({ id: "old" })], A, "upload_synthetic_evidence", NOW);
  assert.deepEqual(r, { allowed: true, consent_id: "old" });
});
test("CON-16 grant validation", () => {
  const ok = { affirmative: true, purpose: P, consent_version: V, consent_text_sha256: DOC.sha256,
    scope: ["upload_synthetic_evidence", "upload_synthetic_evidence"] };
  assert.deepEqual(validateGrantRequest(ok), { ok: true, scope: ["upload_synthetic_evidence"], version: V, text_sha256: DOC.sha256 });
  assert.deepEqual(validateGrantRequest({ ...ok, affirmative: "yes" }), { ok: false, reason: "affirmative_consent_required" });
  assert.deepEqual(validateGrantRequest({ ...ok, purpose: "x" }), { ok: false, reason: "purpose_mismatch" });
  assert.deepEqual(validateGrantRequest({ ...ok, consent_version: "v0" }), { ok: false, reason: "consent_version_mismatch" });
  assert.deepEqual(validateGrantRequest({ ...ok, scope: [] }), { ok: false, reason: "scope_required" });
  assert.deepEqual(validateGrantRequest({ ...ok, scope: ["release"] }), { ok: false, reason: "scope_not_allowed" });
  assert.deepEqual(validateGrantRequest({ ...ok, user_id: B }), { ok: false, reason: "user_id_must_come_from_session" });
  assert.deepEqual(validateGrantRequest([]), { ok: false, reason: "invalid_body" });
});
test("CON-17 expiry is bounded to 90 days", () =>
  assert.equal(expiryFor(NOW), "2027-02-22T12:00:00.000Z"));

// --- Review item 2: fail-closed revocation regression -------------------------------------------
test("CON-18 FUTURE-dated revoked_at denies (regression)", () =>
  deny([row({ revoked_at: "2099-01-01T00:00:00Z" })], "consent_revoked"));
test("CON-19 revoked_at one ms in the future denies (regression)", () =>
  deny([row({ revoked_at: new Date(NOW.getTime() + 1).toISOString() })], "consent_revoked"));
test("CON-20 revoked_at exactly now denies", () => deny([row({ revoked_at: NOW.toISOString() })], "consent_revoked"));
test("CON-21 empty-string revoked_at denies", () => deny([row({ revoked_at: "" })], "consent_revoked"));

// --- Review item 3: versioned consent text evidence -----------------------------------------------
test("CON-22 pinned hash equals SHA-256 of the exact consent text", () =>
  assert.equal(createHash("sha256").update(DOC.text, "utf8").digest("hex"), DOC.sha256));
test("CON-23 consent text is synthetic-only and makes no credit-reporting claim", () => {
  assert.match(DOC.text, /fictional documents/);
  assert.match(DOC.text, /not a credit report, a credit score, or a report to any credit bureau/);
});
test("CON-24 grant with wrong or missing text hash is rejected", () => {
  const base = { affirmative: true, purpose: P, consent_version: V, scope: ["upload_synthetic_evidence"] };
  assert.deepEqual(validateGrantRequest({ ...base, consent_text_sha256: "0".repeat(64) }), { ok: false, reason: "consent_text_mismatch" });
  assert.deepEqual(validateGrantRequest(base), { ok: false, reason: "consent_text_mismatch" });
});
test("CON-25 row without recorded text hash denies", () => {
  deny([row({ consent_text_sha256: null })], "consent_text_unverified");
  deny([row({ consent_text_sha256: undefined })], "consent_text_unverified");
  deny([row({ consent_text_sha256: "f".repeat(64) })], "consent_text_unverified");
});

// --- Review item 1: anonymous identity gate -------------------------------------------------------
const SYN = ["upload_synthetic_evidence"];
test("CON-26 verified (non-anonymous) account passes", () =>
  assert.deepEqual(identityAllowsScopes({ id: A, is_anonymous: false }, SYN), { ok: true, synthetic: false }));
test("CON-27 plain anonymous session is rejected", () =>
  assert.deepEqual(identityAllowsScopes({ id: A, is_anonymous: true, app_metadata: {} }, SYN),
    { ok: false, reason: "anonymous_session_not_permitted" }));
test("CON-28 anonymous with marker in the wrong place or wrong type is rejected", () => {
  for (const app_metadata of [null, { yp_synthetic_test: "true" }, { yp_synthetic_test: 1 }]) {
    assert.deepEqual(identityAllowsScopes({ id: A, is_anonymous: true, app_metadata }, SYN),
      { ok: false, reason: "anonymous_session_not_permitted" });
  }
});
test("CON-29 server-marked synthetic test account passes for synthetic-only scopes", () => {
  const u = { id: A, is_anonymous: true, app_metadata: { yp_synthetic_test: true } };
  assert.equal(isSyntheticTestIdentity(u), true);
  assert.deepEqual(identityAllowsScopes(u, SYN), { ok: true, synthetic: true });
});
test("CON-30 synthetic test account is refused any non-synthetic scope", () =>
  assert.deepEqual(identityAllowsScopes({ id: A, is_anonymous: true, app_metadata: { yp_synthetic_test: true } },
    ["upload_real_evidence"]), { ok: false, reason: "scope_requires_verified_identity" }));
test("CON-31 unknown anonymity state is refused", () =>
  assert.deepEqual(identityAllowsScopes({ id: A }, SYN), { ok: false, reason: "identity_state_unknown" }));
test("CON-32 marker on a verified account does not change anything", () =>
  assert.equal(isSyntheticTestIdentity({ id: A, is_anonymous: false, app_metadata: { yp_synthetic_test: true } }), false));
