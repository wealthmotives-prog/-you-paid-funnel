"""Static guardrails for the staging audit-ledger, consent and evidence-integrity hardening migrations (offline)."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGS = ROOT / "supabase/staging_migrations"
TRUNC = MIGS / "20261127_ledger_truncate_hardening.sql"
HARD = MIGS / "20261127_consent_integrity_operator_hardening.sql"
BASE = MIGS / "20261126_inspection_reconciliation_review.sql"


def body(sql: str, name: str) -> str:
    m = re.search(r"create or replace function public\." + name + r"\(.*?\nend \$\$;\n", sql, re.S)
    assert m, name
    return m.group(0)


class LedgerHardening(unittest.TestCase):
    def test_both_ledgers_block_truncate_and_service_role_mutation(self):
        s = TRUNC.read_text()
        for t in ("pilot_evidence_review_events", "evidence_reconciliation_events"):
            self.assertIn(f"revoke update, delete, truncate, references, trigger on public.{t} from service_role", s)
            self.assertRegex(s, rf"before truncate on public\.{t}\s+for each statement")

    def test_staging_only_and_non_destructive(self):
        for f in (TRUNC, HARD):
            s = f.read_text()
            self.assertIn("STAGING ONLY", s.splitlines()[0])
            code = "\n".join(l for l in s.splitlines() if not l.lstrip().startswith("--"))
            self.assertNotRegex(code, r"(?i)\bdelete\s+from\b|\btruncate\s+(table\s+)?public\.|\bdrop\s+(table|function)\b")
            self.assertNotIn("xknfxcyezchtypaisieu", s)

    def test_consent_records_only_allow_recording_a_revocation(self):
        s = HARD.read_text()
        g = body(s, "yp_staging_consent_guard")
        self.assertIn("if tg_op = 'DELETE' then raise exception", g)
        self.assertIn("if old.revoked_at is not null then raise exception", g)
        self.assertIn("if new.revoked_at is null then raise exception", g)
        self.assertIn("(to_jsonb(new) - 'revoked_at') is distinct from (to_jsonb(old) - 'revoked_at')", g)
        self.assertRegex(s, r"before update or delete on public\.pilot_evidence_consents")
        self.assertRegex(s, r"before truncate on public\.pilot_evidence_consents")
        self.assertIn("revoke delete, truncate, references, trigger on public.pilot_evidence_consents from service_role", s)

    def test_integrity_anchors_immutable_and_attempts_monotonic(self):
        s = HARD.read_text()
        a = body(s, "yp_staging_artifact_anchor_guard")
        for col in ("user_id", "employment_id", "content_hash", "storage_reference", "received_at", "artifact_type"):
            self.assertIn(f"new.{col} is distinct from old.{col}", a)
        j = body(s, "yp_staging_job_anchor_guard")
        for col in ("artifact_id", "bucket_id", "object_path"):
            self.assertIn(f"new.{col} is distinct from old.{col}", j)
        self.assertIn("new.attempts < old.attempts", j)
        for t in ("evidence_artifacts", "evidence_inspection_jobs"):
            self.assertIn(f"revoke delete, truncate, references, trigger on public.{t} from service_role", s)

    def test_rpcs_verify_server_markers_and_otherwise_match_reviewed_bodies(self):
        s, base = HARD.read_text(), BASE.read_text()
        helper = body_sql = re.search(r"create or replace function public\.yp_staging_user_has_markers.*?\$\$;", s, re.S).group(0)
        self.assertIn("security definer set search_path = ''", helper)
        self.assertIn("grant execute on function public.yp_staging_user_has_markers(uuid, boolean) to service_role", s)
        self.assertIn("revoke all on function public.yp_staging_user_has_markers(uuid, boolean) from public, anon, authenticated", s)
        for name, checks in (("yp_staging_reconcile_artifact", ["yp_staging_user_has_markers(p_actor_id, true)"]),
                             ("yp_staging_record_review_decision", ["yp_staging_user_has_markers(p_operator_id, true)",
                                                                    "yp_staging_user_has_markers(a.user_id, false)"])):
            new, old = body(s, name), body(base, name)
            for c in checks:
                self.assertIn(c, new)
            # Removing the added lines must reproduce the reviewed body exactly.
            stripped = "\n".join(l for l in new.splitlines() if "yp_staging_user_has_markers" not in l
                                 and "Defense in depth" not in l) + "\n"
            self.assertEqual(stripped, old)
            self.assertNotIn("security definer", new.split("as $$")[0])


if __name__ == "__main__":
    unittest.main()
