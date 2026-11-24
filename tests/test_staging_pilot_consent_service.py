"""Guardrails for the staging-only pilot consent service (no network, no Supabase access)."""
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FN = ROOT / "supabase/functions/staging-pilot-consent/index.ts"
POLICY = ROOT / "supabase/functions/_shared/pilot_consent_policy.ts"


class StagingConsentServiceTests(unittest.TestCase):
    def test_policy_behaviour_suite_passes(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node unavailable")
        r = subprocess.run([node, "--experimental-strip-types", "--no-warnings", "--test",
                            str(ROOT / "tests/pilot_consent_policy.test.ts")],
                           capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_function_is_staging_gated_and_default_off(self):
        s = FN.read_text()
        self.assertIn("environmentIsStaging(url)", s)
        self.assertIn('Deno.env.get("YOU_PAID_STAGING_CONSENT_ENABLED") !== "true"', s)
        self.assertNotIn("xknfxcyezchtypaisieu", s)

    def test_identity_comes_only_from_verified_session(self):
        s = FN.read_text()
        self.assertIn("admin.auth.getUser(jwt)", s)
        self.assertIn("jwt === serviceKey", s)
        self.assertNotIn("body.user_id", s)
        self.assertGreaterEqual(s.count('.eq("user_id", userId)'), 2)

    def test_service_never_touches_storage_scanner_or_review_ledger(self):
        s = FN.read_text()
        for forbidden in ("storage.from", "evidence_artifacts", "evidence_inspection_jobs",
                          "pilot_evidence_review_events", ".delete(", "cloudmersive"):
            self.assertNotIn(forbidden, s)

    def test_no_direct_member_grants_reintroduced(self):
        sql = (ROOT / "supabase/staging_migrations/20261124_pilot_evidence_consent_review_ledger.sql").read_text()
        self.assertIn("revoke all on public.pilot_evidence_consents from public, anon, authenticated", sql)
        self.assertNotIn("to authenticated", sql.replace("from public, anon, authenticated", ""))

    def test_engineering_locks_untouched(self):
        scanner = (ROOT / "supabase/functions/evidence-cloudmersive-scanner/index.ts").read_text()
        probe = (ROOT / "supabase/functions/cloudmersive-synthetic-probe/index.ts").read_text()
        self.assertIn("const ENGINEERING_RELEASE_APPROVED = false;", scanner)
        self.assertIn("const ALLOW_PROBE = false;", probe)

    def test_grant_enforces_identity_gate_and_records_text_hash(self):
        s = FN.read_text()
        self.assertIn("identityAllowsScopes(user, v.scope)", s)
        self.assertIn("consent_text_sha256: v.text_sha256", s)
        self.assertIn("consent_text: doc.text", s)
        # Revocation must never be blocked by the identity gate.
        revoke = s.split('case "revoke"')[1].split("default:")[0]
        self.assertNotIn("identityAllowsScopes", revoke)

    def test_revocation_fails_closed_on_any_value(self):
        p = POLICY.read_text()
        self.assertIn("if (r.revoked_at !== null && r.revoked_at !== undefined) { lastReason = \"consent_revoked\"; continue; }", p)
        self.assertNotIn("revoked <= now", p)

    def test_text_hash_migration_is_additive_and_staging_only(self):
        sql = (ROOT / "supabase/staging_migrations/20261124b_pilot_consent_text_hash.sql").read_text()
        self.assertIn("STAGING ONLY", sql)
        self.assertIn("add column if not exists consent_text_sha256", sql)
        for forbidden in ("drop table", "truncate", "delete from", "grant "):
            self.assertNotIn(forbidden, sql.lower().split("-- rollback")[0])

    def test_policy_pins_both_refs_distinctly(self):
        p = POLICY.read_text()
        self.assertIn('STAGING_PROJECT_REF = "rzeodkcvljukaaczeibe"', p)
        self.assertIn('PRODUCTION_PROJECT_REF = "xknfxcyezchtypaisieu"', p)


if __name__ == "__main__":
    unittest.main()
