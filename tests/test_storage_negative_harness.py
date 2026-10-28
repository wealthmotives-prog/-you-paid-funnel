"""Guardrails for synthetic-only credentialed Storage HTTP negative testing."""
import pathlib
import unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class StorageNegativeHarnessChecks(unittest.TestCase):
 def test_opt_in_and_no_hardcoded_credentials(self):
  s=(ROOT/"tests/workverify_storage_negative_http.py").read_text()
  for x in ("--i-understand","YP_TEST_MEMBER_A_JWT","YP_TEST_MEMBER_B_JWT","YP_TEST_ANON_KEY","synthetic-rls-denial-probe"):
   self.assertIn(x,s)
  self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY",s)
  self.assertNotIn("deleteObject(",s)
 def test_denials_expected(self):
  s=(ROOT/"tests/workverify_storage_negative_http.py").read_text()
  self.assertIn("(401,403,404)",s)
  self.assertIn("A own upload",s)
  self.assertIn("B cross-member read",s)
if __name__=="__main__":
 unittest.main()
