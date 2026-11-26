"""Guardrails for staging inspection processor, operator review service, reconciliation and pages (offline)."""
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "supabase/functions/staging-inspection-processor/index.ts"
REV = ROOT / "supabase/functions/staging-operator-review/index.ts"
UPL = ROOT / "supabase/functions/staging-evidence-upload/index.ts"
MIG = ROOT / "supabase/staging_migrations/20261126_inspection_reconciliation_review.sql"
HTTP = ROOT / "supabase/functions/_shared/staging_http.ts"
PAGES = [ROOT / "staging/member.html", ROOT / "staging/operator.html"]


class InspectionReviewGuards(unittest.TestCase):
    def test_policy_suite_passes(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node unavailable")
        r = subprocess.run([node, "--experimental-strip-types", "--no-warnings", "--test",
                            str(ROOT / "tests/inspection_policy.test.ts")], capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_new_functions_staging_gated_default_off_operator_only(self):
        for f, gate in ((PROC, "YOU_PAID_STAGING_SCAN_ENABLED"), (REV, "YOU_PAID_STAGING_REVIEW_ENABLED")):
            s = f.read_text()
            self.assertIn("environmentIsStaging(url)", s)
            self.assertIn(f'Deno.env.get("{gate}") !== "true"', s)
            self.assertIn("isStagingOperator(operator.app_metadata)", s)
            self.assertIn("jwt === serviceKey", s)
            self.assertNotIn("xknfxcyezchtypaisieu", s)

    def test_processor_never_approves_releases_or_signs(self):
        s = PROC.read_text()
        for forbidden in ("createSignedUrl", "getPublicUrl", "pilot_evidence_review_events", "review_status:",
                          'state: "approved"', "approved: true", ".remove(", ".delete("):
            self.assertNotIn(forbidden, s)
        self.assertIn('approved: false', s)
        self.assertEqual(set(re.findall(r'state: "(\w+)"', s)), {"quarantined"})

    def test_processor_claim_is_compare_and_set_and_rehashes(self):
        s = PROC.read_text()
        self.assertIn('.eq("attempts", job.attempts).eq("updated_at", job.updated_at)', s)
        self.assertIn('.eq("failure_code", FC.IN_PROGRESS).eq("attempts", attempt)', s)
        self.assertIn("const digest = await sha256Hex(bytes);", s)
        self.assertIn("if (digest !== a.content_hash)", s)
        self.assertLess(s.index("if (digest !== a.content_hash)"), s.index("await fetch(ENDPOINT"))
        self.assertLess(s.index("if (!consent.allowed)"), s.index("await fetch(ENDPOINT"))
        self.assertIn("signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS)", s)
        self.assertIn('redirect: "error"', s)
        self.assertLess(s.index('return reply(503, { error: "scanner_not_configured" })'), s.index("// Compare-and-set claim"))

    def test_existing_scanner_and_locks_untouched(self):
        scanner = (ROOT / "supabase/functions/evidence-cloudmersive-scanner/index.ts").read_text()
        self.assertIn("const ENGINEERING_RELEASE_APPROVED = false;", scanner)
        probe = (ROOT / "supabase/functions/cloudmersive-synthetic-probe/index.ts").read_text()
        self.assertIn("const ALLOW_PROBE = false;", probe)
        for m in ("20261028_evidence_upload_hard_pause.sql", "20261028_evidence_read_hard_pause.sql"):
            self.assertIn("AS RESTRICTIVE", (ROOT / "supabase/migrations" / m).read_text())

    def test_review_writes_only_via_atomic_rpc(self):
        s = REV.read_text()
        self.assertIn('admin.rpc("yp_staging_record_review_decision"', s)
        self.assertNotIn('.from("pilot_evidence_review_events").insert', s)
        self.assertNotIn("createSignedUrl", s)
        self.assertNotIn("storage.from", s)
        self.assertIn("a.user_id === operator.id", s)  # own evidence excluded from queue

    def test_migration_rules(self):
        sql = MIG.read_text()
        self.assertIn("STAGING ONLY", sql)
        self.assertIn("if a.user_id = p_operator_id then raise exception 'self_review_forbidden'", sql)
        self.assertIn("if v_last in ('rejected', 'accepted_for_pilot_review') then raise exception 'decision_already_final'", sql)
        self.assertIn("j.actual_sha256 is distinct from a.content_hash", sql)
        self.assertIn("'operator_review' = any(c.scope)", sql)
        self.assertIn("exists(select 1 from public.pilot_evidence_review_events e where e.artifact_id = a.id)", sql)
        self.assertIn("before update or delete on public.evidence_reconciliation_events", sql)
        self.assertEqual(sql.count("for update;"), 2)
        body = sql.split("-- Rollback")[0].lower()
        for forbidden in ("delete from", "truncate", "drop table", "grant select, insert on public.evidence_reconciliation_events to authenticated"):
            self.assertNotIn(forbidden, body)
        self.assertGreaterEqual(body.count("from public, anon, authenticated"), 4)

    def test_upload_duplicates_use_decision_function(self):
        s = UPL.read_text()
        self.assertIn("duplicateDecision(", s)
        dup = s.split("if (dup) {", 1)[1].split("// 6)", 1)[0]
        self.assertLess(dup.index("reply(409"), dup.index("reply(200"))

    def test_cors_allowlist_is_preview_only(self):
        s = HTTP.read_text()
        self.assertIn(r"/^https:\/\/you-paid-[a-z0-9-]+-wealthmotives-6336\.vercel\.app$/", s)
        self.assertNotIn('"*"', s)
        self.assertNotIn("joinyoupaid.com", s)

    def test_pages_pinned_to_staging(self):
        for p in PAGES:
            s = p.read_text()
            self.assertIn("rzeodkcvljukaaczeibe", s, p.name)
            self.assertNotIn("xknfxcyezchtypaisieu", s, p.name)
            self.assertIn("noindex", s, p.name)
            self.assertIn("STAGING", s, p.name)
            self.assertNotRegex(s, r"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZW9ka2N2bGp1a2FhY3plaWJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZ")
            self.assertNotIn("service_role", s, p.name)
        member = PAGES[0].read_text()
        self.assertIn("consent_text", member)
        self.assertIn('type="checkbox" id="agree"', member)
        self.assertNotIn("checked", member.split('id="agree"')[1].split(">")[0])


if __name__ == "__main__":
    unittest.main()
