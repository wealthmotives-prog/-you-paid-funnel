// You Paid pilot evidence consent policy. STAGING ONLY. Pure logic, no I/O.
// Every function fails closed: any ambiguity returns a denial, never an allowance.

export const STAGING_PROJECT_REF = "rzeodkcvljukaaczeibe";
export const PRODUCTION_PROJECT_REF = "xknfxcyezchtypaisieu";
export const CONSENT_PURPOSE = "pilot_work_evidence_review";
export const CURRENT_CONSENT_VERSION = "staging-pilot-evidence-consent-v1";
export const ALLOWED_SCOPES = ["upload_synthetic_evidence", "operator_review"] as const;
export const MAX_CONSENT_DAYS = 90;

export type ConsentRow = {
  id: string;
  user_id: string;
  purpose: string;
  consent_version: string;
  scope: string[];
  granted_at: string;
  revoked_at: string | null;
  expires_at: string | null;
};

export type Decision =
  | { allowed: true; consent_id: string }
  | { allowed: false; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The function must only ever run against the staging project. */
export function environmentIsStaging(supabaseUrl: string): boolean {
  let host: string;
  try { host = new URL(supabaseUrl).hostname; } catch { return false; }
  if (host.includes(PRODUCTION_PROJECT_REF)) return false;
  return host === `${STAGING_PROJECT_REF}.supabase.co`;
}

/** Validate a grant request body. Scope list must be non-empty, known, and de-duplicated. */
export function validateGrantRequest(body: unknown):
  { ok: true; scope: string[]; version: string } | { ok: false; reason: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, reason: "invalid_body" };
  const b = body as Record<string, unknown>;
  if (b.affirmative !== true) return { ok: false, reason: "affirmative_consent_required" };
  if (b.purpose !== CONSENT_PURPOSE) return { ok: false, reason: "purpose_mismatch" };
  if (b.consent_version !== CURRENT_CONSENT_VERSION) return { ok: false, reason: "consent_version_mismatch" };
  if (!Array.isArray(b.scope) || b.scope.length === 0) return { ok: false, reason: "scope_required" };
  const scope = [...new Set(b.scope)];
  if (scope.some((s) => typeof s !== "string" || !(ALLOWED_SCOPES as readonly string[]).includes(s)))
    return { ok: false, reason: "scope_not_allowed" };
  if ("user_id" in b) return { ok: false, reason: "user_id_must_come_from_session" };
  return { ok: true, scope: scope as string[], version: CURRENT_CONSENT_VERSION };
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
    const granted = Date.parse(r.granted_at);
    if (Number.isNaN(granted) || granted > now.getTime()) { lastReason = "grant_time_invalid"; continue; }
    if (r.revoked_at !== null) {
      const revoked = Date.parse(r.revoked_at);
      // Unparseable revocation is treated as revoked.
      if (Number.isNaN(revoked) || revoked <= now.getTime()) { lastReason = "consent_revoked"; continue; }
    }
    if (r.expires_at === null) { lastReason = "expiry_required"; continue; }
    const expires = Date.parse(r.expires_at);
    if (Number.isNaN(expires) || expires <= now.getTime()) { lastReason = "consent_expired"; continue; }
    if (!Array.isArray(r.scope) || !r.scope.includes(requiredScope)) { lastReason = "scope_not_granted"; continue; }
    return { allowed: true, consent_id: r.id };
  }
  return { allowed: false, reason: lastReason };
}
