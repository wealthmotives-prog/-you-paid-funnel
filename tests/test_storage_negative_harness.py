"""Static safeguards: synthetic-only authenticated Storage denial harness."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"tests/workverify_storage_negative_http.py"

class StorageNegativeHarnessChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text=SOURCE.read_text(encoding="utf-8")
    def test_explicit_opt_in_and_no_service_role(self):
        for marker in ("--i-understand","YP_TEST_MEMBER_A_JWT","YP_TEST_MEMBER_B_JWT",
                       "YP_TEST_ANON_KEY","synthetic-rls-denial-probe-"):
            self.assertIn(marker,self.text)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY",self.text)
    def test_requires_real_authenticated_separate_identities(self):
        for marker in ('/auth/v1/user', 'if a == b:', 'if token_a == token_b:', 'is_anonymous'):
            self.assertIn(marker,self.text)
    def test_read_requires_existing_synthetic_sentinel(self):
        for marker in ("YP_TEST_EXISTING_OBJECT_PATH", "safe_sentinel(",
                       "synthetic-rls-sentinel-", "404 does not prove denial",
                       "DENIED = {401, 403}"):
            self.assertIn(marker,self.text)
        self.assertNotIn("status not in (401,403,404)",self.text)
    def test_upload_is_synthetic_and_randomized(self):
        for marker in ("uuid.uuid4().hex","FAKE_PDF","--mode","choices=(\"upload\", \"read\")"):
            self.assertIn(marker,self.text)
        self.assertNotIn("deleteObject(",self.text)
if __name__=="__main__":
    unittest.main()
