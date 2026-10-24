"""Prelaunch advertising landing-page guardrails; does not test live user journeys."""
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class PrelaunchAdvertisingChecks(unittest.TestCase):
 def test_landing_page_prelaunch_status(self):
  page=(ROOT/"index.html").read_text(encoding="utf-8").lower()
  self.assertIn("credit bureau furnishing is not active",page)
  self.assertIn("no credit-score outcome is guaranteed",page)
 def test_reachable_policy_documents_in_repo(self):
  page=(ROOT/"index.html").read_text(encoding="utf-8")
  for name in ("privacy.html","terms.html","product-disclosure.html","transparency.html"):
   self.assertTrue((ROOT/name).is_file(),name)
   self.assertIn('/'+name,page,name)
 def test_member_copy_does_not_automatically_certify(self):
  member=(ROOT/"app.html").read_text(encoding="utf-8")
  self.assertIn('Organize your work history and distinguish self-declared records from independently verified information.',member)
  self.assertIn('Work History Ledger',member)

if __name__=="__main__":
 unittest.main()
