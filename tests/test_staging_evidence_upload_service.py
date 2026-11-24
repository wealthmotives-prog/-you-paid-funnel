"""Guardrails for the staging-only server-mediated evidence upload service (offline, static + node suite)."""
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FN = ROOT / "supabase/functions/staging-evidence-upload/index.ts"
POLICY = ROOT / "supabase/functions/_shared/evidence_upload_policy.ts"


class StagingEvidenceUploadTests(unittest.TestCase):
    def test_upload_policy_behaviour_suite_passes(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node unavailable")
        r = subprocess.run([node, "--experimental-strip-types", "--no-warnings", "--test",
                            str(ROOT / "tests/evidence_upload_policy.test.ts")],
                           capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_staging_gate_and_default_off(self):
        s = FN.read_text()
        self.assertIn("environmentIsStaging(url)", s)
        self.assertIn('Deno.env.get("YOU_PAID_STAGING_UPLOAD_ENABLED") !== "true"', s)
        self.assertNotIn("xknfxcyezchtypaisieu", s)

    def test_identity_and_consent_checked_before_and_after_body(self):
        s = FN.read_text()
        self.assertIn("identityAllowsScopes(user, [UPLOAD_SCOPE])", s)
        self.assertLess(s.index("const pre = await consentFor()"), s.index("readBounded(req.body"))
        self.assertLess(s.index("readBounded(req.body"), s.index("const live = await consentFor()"))
        self.assertLess(s.index("const live = await consentFor()"), s.index(".upload(objectPath"))

    def test_server_owned_path_no_overwrite_and_ownership(self):
        s = FN.read_text()
        self.assertIn("objectPathFor(userId, artifactId)", s)
        self.assertIn("upsert: false", s)
        self.assertIn('.eq("id", employmentId!).eq("user_id", userId)', s)
        self.assertNotIn("body.path", s)
        self.assertNotIn('get("x-object-path")', s)

    def test_never_scans_approves_or_releases(self):
        s = FN.read_text()
        for forbidden in ("cloudmersive", "createSignedUrl", "getPublicUrl", "pilot_evidence_review_events",
                          'review_status: "approved"', "approved: true", 'state: "quarantined"'):
            self.assertNotIn(forbidden, s)
        self.assertIn("approved: false", s)
        self.assertIn('state: "queued"', s)

    def test_partial_failure_never_reports_success(self):
        s = FN.read_text()
        self.assertIn('error: "inspection_job_failed"', s)
        self.assertIn("reconciliation_required: true", s)
        self.assertIn('error: "artifact_record_failed", recorded: false', s)
        self.assertIn('error: "quarantine_write_failed", recorded: false', s)

    def test_dedupe_migration_partial_and_additive(self):
        sql = (ROOT / "supabase/staging_migrations/20261124c_evidence_upload_dedupe_index.sql").read_text()
        self.assertIn("STAGING ONLY", sql)
        self.assertIn("where (metadata->>'intake') = 'staging-evidence-upload-v0'", sql)
        for forbidden in ("drop table", "delete from", "truncate", "update "):
            self.assertNotIn(forbidden, sql.lower().split("-- rollback")[0])

    def test_cleanup_runbook_is_scoped_and_guarded(self):
        rb = (ROOT / "docs/staging-synthetic-upload-cleanup-runbook.md").read_text()
        self.assertIn("rzeodkcvljukaaczeibe", rb)
        self.assertIn("Never run any step against production", rb)
        self.assertGreaterEqual(rb.count("metadata->>'intake' = 'staging-evidence-upload-v0'"), 3)
        self.assertIn("(u.raw_app_meta_data->>'yp_synthetic_test') = 'true'", rb)
        self.assertIn("not exists (select 1 from public.pilot_evidence_review_events", rb)
        self.assertIn("never with `delete from storage.objects`", rb)

    def test_production_locks_and_pauses_untouched(self):
        scanner = (ROOT / "supabase/functions/evidence-cloudmersive-scanner/index.ts").read_text()
        self.assertIn("const ENGINEERING_RELEASE_APPROVED = false;", scanner)
        for m in ("20261028_evidence_upload_hard_pause.sql", "20261028_evidence_read_hard_pause.sql"):
            self.assertIn("AS RESTRICTIVE", (ROOT / "supabase/migrations" / m).read_text())


if __name__ == "__main__":
    unittest.main()
