"""Offline regression check for storage access freeze migrations; NOT an auth HTTP test."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class EvidenceStorageFreezeTests(unittest.TestCase):
 def test_authenticated_direct_read_and_write_paused(self):
  for path, action, clause in [
   ("20261028_evidence_upload_hard_pause.sql","FOR INSERT","WITH CHECK"),
   ("20261028_evidence_read_hard_pause.sql","FOR SELECT","USING")
  ]:
   sql=(ROOT/"supabase/migrations"/path).read_text()
   self.assertIn("AS RESTRICTIVE",sql)
   self.assertIn(action,sql)
   self.assertIn("TO authenticated",sql)
   self.assertIn(clause+" (bucket_id <> 'you-paid-work-evidence')",sql)
 def test_scoped_to_one_bucket(self):
  for filename in ("20261028_evidence_upload_hard_pause.sql","20261028_evidence_read_hard_pause.sql"):
   sql=(ROOT/"supabase/migrations"/filename).read_text()
   self.assertNotIn("DROP POLICY",sql.upper())
   self.assertIn("bucket_id <> 'you-paid-work-evidence'",sql)
if __name__=="__main__":
 unittest.main()
