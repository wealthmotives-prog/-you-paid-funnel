"""Safety regression checks for local interactive synthetic Auth test launcher."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
SRC=(ROOT/"tests/workverify_storage_interactive_test.py").read_text(encoding="utf-8")
class InteractiveStorageRunnerChecks(unittest.TestCase):
    def test_no_unprompted_network_or_real_data(self):
        for marker in ("--i-understand","getpass.getpass(","YP_TEST_ANON_KEY",
                       "grant_type=password","run_upload_checks","run_read_checks",
                       "YP_TEST_EXISTING_OBJECT_PATH","if __name__==\"__main__\":"):
            self.assertIn(marker,SRC)
    def test_no_hardcoded_credentials(self):
        for marker in ("SUPABASE_SERVICE_ROLE_KEY","password123","k_yungg@yahoo.com",
                       "wealthyconsumer@protonmail.com","print(token_a)",
                       "print(token_b)","print(password_a)"):
            self.assertNotIn(marker,SRC)
    def test_requires_two_sessions(self):
        self.assertIn("if id_a==id_b:",SRC)
        self.assertIn("identity(token_a,public_key)",SRC)
        self.assertIn("identity(token_b,public_key)",SRC)
if __name__=="__main__":
    unittest.main()
