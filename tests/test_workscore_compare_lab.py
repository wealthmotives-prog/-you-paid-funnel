"""Research-only formula comparison page checks."""
from pathlib import Path
import json
import unittest
ROOT=Path(__file__).resolve().parents[1]
class PolicyComparisonChecks(unittest.TestCase):
    def test_fictional_shared_fixture(self):
        page=(ROOT/"workscore-compare-lab.html").read_text()
        data=json.loads((ROOT/"research/workscore_fixtures_v0.1.json").read_text())
        self.assertIn("/research/workscore_fixtures_v0.1.json",page)
        self.assertEqual(data["schema"],"you-paid-workscore-fixtures-v0.1")
        self.assertIn("research-0.2",page)
        self.assertIn("noindex,nofollow",page)
        self.assertIn("Neither grade reflects creditworthiness",page)
    def test_no_real_backend(self):
        page=(ROOT/"workscore-compare-lab.html").read_text().lower()
        for forbidden in ("supabase-js","stripe","localstorage","sessionstorage","metro 2 report","bureau submission"):
            self.assertNotIn(forbidden,page)
if __name__=="__main__":
    unittest.main()
