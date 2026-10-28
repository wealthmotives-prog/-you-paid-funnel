"""Static guardrails for the currently applied evidence upload freeze."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class EvidenceUploadPauseTests(unittest.TestCase):
 def test_restrictive_bucket_policy_committed(self):
  sql=(ROOT/"supabase/migrations/20261028_evidence_upload_hard_pause.sql").read_text()
  for needle in ("AS RESTRICTIVE","FOR INSERT","TO authenticated","bucket_id <> 'you-paid-work-evidence'"):
   self.assertIn(needle,sql)
 def test_policy_does_not_broadly_block_other_buckets(self):
  sql=(ROOT/"supabase/migrations/20261028_evidence_upload_hard_pause.sql").read_text()
  self.assertNotIn("DROP POLICY",sql.upper())
  self.assertIn("bucket_id <> 'you-paid-work-evidence'",sql)
if __name__=="__main__":
 unittest.main()
