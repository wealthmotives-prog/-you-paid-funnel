// You Paid pilot evidence consent policy. STAGING ONLY. Pure logic, no I/O.
// Every function fails closed: any ambiguity returns a denial, never an allowance.

export const STAGING_PROJECT_REF = "rzeodkcvljukaaczeibe";
export const PRODUCTION_PROJECT_REF = "xknfxcyezchtypaisieu";
export const CONSENT_PURPOSE = "pilot_work_evidence_review";
export const CURRENT_CONSENT_VERSION = "staging-pilot-evidence-consent-v2";
export const ALLOWED_SCOPES = ["upload_synthetic_evidence", "operator_review"] as const;
// Scopes an isolated synthetic test account may use. Any future real-document scope must NOT be listed here,
// so anonymous / synthetic identities are refused for it automatically.
export const SYNTHETIC_ONLY_SCOPES: readonly string[] = ["upload_synthetic_evidence", "operator_review"];
export const MAX_CONSENT_DAYS = 90;
// Server-controlled marker (auth app_metadata cannot be written by the user) for isolated synthetic test accounts.
export const SYNTHETIC_TEST_MARKER = "yp_synthetic_test";
export const CONSENT_SOURCE_MEMBER = "staging_member_portal";
export const CONSENT_SOURCE_SYNTHETIC = "staging_synthetic_test_account";

// Exact consent language per version. The member UI must display `text` verbatim and send back `sha256`.
// Editing the text requires a new version string; the regression test pins the hash.
export const CONSENT_DOCUMENTS: Record<string, { text: string; sha256: string }> = {
  "staging-pilot-evidence-consent-v2": {
    text:
      "You Paid staging consent v2 (synthetic testing only).\n" +
      "By selecting \"I agree\" you confirm and agree that:\n" +
      "1. You are using a test account and will upload only fictional documents that contain no real person's information.\n" +
      "2. You Paid may store each file you upload in a private, quarantined location, compute its SHA-256 fingerprint, and send it to its malware-scanning provider (Cloudmersive) for inspection.\n" +
      "3. An authorized You Paid operator may review the file and record a reason-coded decision in an append-only audit log.\n" +
      "4. This review is a work-evidence check only. It is not a credit report, a credit score, or a report to any credit bureau.\n" +
      "5. This consent expires 90 days after you give it. You may withdraw it at any time; after withdrawal no new uploads or reviews proceed under it. Records already created remain in the audit log.\n",
    sha256: "61009cfa547da4fd893e8df9095440727250546c980e3dabeb3f5c404ddc0e51",
  },
};

export type ConsentRow = {
  id: string;
  user_id: string;
  purpose: string;
  consent_version: string;
  scope: string[];
  granted_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  consent_text_sha256?: string | null;
};

export type Identity = {
  id: string;
  is_anonymous?: boolean | null;
  app_metadata?: Record<string, unknown> | null;
};

export type Decision =
  | { allowed: true; consent_id: string }
  | { allowed: false; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64 = /^[a-f0-9]{64}$/;

/** The function must only ever run against the staging project. */
export function environmentIsStaging(supabaseUrl: string): boolean {
  let host: string;
  try { host = new URL(supabaseUrl).hostname; } catch { return false; }
  if (host.includes(PRODUCTION_PROJECT_REF)) return false;
  return host === `${STAGING_PROJECT_REF}.supabase.co`;
}

/** True only for an anonymous session explicitly marked by the server as an isolated synthetic test account. */
export function isSyntheticTestIdentity(user: Identity): boolean {
  return user.is_anonymous === true && user.app_metadata?.[SYNTHETIC_TEST_MARKER] === true;
}

/**
 * Identity gate for granting consent or uploading evidence.
 * - Synthetic-only scopes (everything that exists today) require the server-set test marker on the account,
 *   whether the session is anonymous or a verified email account. An ordinary staging sign-up can do nothing.
 * - Any future non-synthetic (real-document) scope requires a verified, non-anonymous identity.
 * - An unknown anonymity state is refused.
 */
export function identityAllowsScopes(user: Identity, scopes: readonly string[]):
  { ok: true; synthetic: boolean } | { ok: false; reason: string } {
  if (!user || !UUID.test(user.id)) return { ok: false, reason: "invalid_user" };
  if (typeof user.is_anonymous !== "boolean") return { ok: false, reason: "identity_state_unknown" };
  if (scopes.length === 0) return { ok: false, reason: "scope_required" };
  const marked = user.app_metadata?.[SYNTHETIC_TEST_MARKER] === true;
  const syntheticOnly = scopes.every((s) => SYNTHETIC_ONLY_SCOPES.includes(s));
  if (syntheticOnly) {
    if (marked) return { ok: true, synthetic: true };
    return { ok: false, reason: user.is_anonymous ? "anonymous_session_not_permitted" : "synthetic_test_marker_required" };
  }
  if (user.is_anonymous) return { ok: false, reason: "scope_requires_verified_identity" };
  return { ok: true, synthetic: false };
}

/** Validate a grant request body. Scope list must be non-empty, known, and de-duplicated. */
export function validateGrantRequest(body: unknown):
  { ok: true; scope: string[]; version: string; text_sha256: string } | { ok: false; reason: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, reason: "invalid_body" };
  const b = body as Record<string, unknown>;
  if (b.affirmative !== true) return { ok: false, reason: "affirmative_consent_required" };
  if (b.purpose !== CONSENT_PURPOSE) return { ok: false, reason: "purpose_mismatch" };
  if (b.consent_version !== CURRENT_CONSENT_VERSION) return { ok: false, reason: "consent_version_mismatch" };
  const doc = CONSENT_DOCUMENTS[CURRENT_CONSENT_VERSION];
  if (!doc || b.consent_text_sha256 !== doc.sha256) return { ok: false, reason: "consent_text_mismatch" };
  if (!Array.isArray(b.scope) || b.scope.length === 0) return { ok: false, reason: "scope_required" };
  const scope = [...new Set(b.scope)];
  if (scope.some((s) => typeof s !== "string" || !(ALLOWED_SCOPES as readonly string[]).includes(s)))
    return { ok: false, reason: "scope_not_allowed" };
  if ("user_id" in b) return { ok: false, reason: "user_id_must_come_from_session" };
  return { ok: true, scope: scope as string[], version: CURRENT_CONSENT_VERSION, text_sha256: doc.sha256 };
}

export function expiryFor(now: Date): string {
  return new Date(now.getTime() + MAX_CONSENT_DAYS * 86_400_000).toISOString();
}

/**
 * Decide whether the member's consent currently authorizes `requiredScope`.
 * `rows` must be the caller's own rows (filtered server-side by verified JWT subject),
 * but ownership is re-checked here as defense in depth.
 */
export function evaluateConsent(
  rows: ConsentRow[] | null | undefined,
  userId: string,
  requiredScope: string,
  now: Date,
): Decision {
  if (!UUID.test(userId)) return { allowed: false, reason: "invalid_user" };
  if (!(ALLOWED_SCOPES as readonly string[]).includes(requiredScope)) return { allowed: false, reason: "unknown_scope" };
  if (!Array.isArray(rows) || rows.length === 0) return { allowed: false, reason: "consent_absent" };
  if (Number.isNaN(now.getTime())) return { allowed: false, reason: "clock_invalid" };
  let lastReason = "consent_absent";
  const sorted = [...rows].sort((a, b) => Date.parse(b.granted_at) - Date.parse(a.granted_at));
  for (const r of sorted) {
    if (r.user_id !== userId) { lastReason = "ownership_mismatch"; continue; }
    if (r.purpose !== CONSENT_PURPOSE) { lastReason = "purpose_mismatch"; continue; }
    if (r.consent_version !== CURRENT_CONSENT_VERSION) { lastReason = "consent_version_outdated"; continue; }
    // Fail closed: ANY recorded revocation ends the consent, whatever its timestamp (future, past, or unparseable).
    if (r.revoked_at !== null && r.revoked_at !== undefined) { lastReason = "consent_revoked"; continue; }
    const doc = CONSENT_DOCUMENTS[r.consent_version];
    if (!doc || typeof r.consent_text_sha256 !== "string" || !HEX64.test(r.consent_text_sha256) ||
        r.consent_text_sha256 !== doc.sha256) { lastReason = "consent_text_unverified"; continue; }
    const granted = Date.parse(r.granted_at);
    if (Number.isNaN(granted) || granted > now.getTime()) { lastReason = "grant_time_invalid"; continue; }
    if (r.expires_at === null) { lastReason = "expiry_required"; continue; }
    const expires = Date.parse(r.expires_at);
    if (Number.isNaN(expires) || expires <= now.getTime()) { lastReason = "consent_expired"; continue; }
    if (!Array.isArray(r.scope) || !r.scope.includes(requiredScope)) { lastReason = "scope_not_granted"; continue; }
    return { allowed: true, consent_id: r.id };
  }
  return { allowed: false, reason: lastReason };
}
