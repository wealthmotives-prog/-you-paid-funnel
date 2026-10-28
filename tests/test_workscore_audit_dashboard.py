"""Static release safeguards for the fictional WorkScore audit dashboard."""
from pathlib import Path
import unittest
import json
ROOT=Path(__file__).resolve().parents[1]
class AuditDashboardChecks(unittest.TestCase):
    def test_dashboard_is_fictional_only(self):
        s=(ROOT/'workscore-audit-lab.html').read_text(encoding='utf-8')
        for marker in ('noindex,nofollow','All accounts and evidence below are fictional','Furnishing blocked','research-0.1','evidence_corrected','manual_review'):
            self.assertIn(marker,s)
    def test_dashboard_has_no_live_integration(self):
        s=(ROOT/'workscore-audit-lab.html').read_text(encoding='utf-8').lower()
        for forbidden in ('supabase-js','stripe','xmlhttprequest','localstorage','sessionstorage'):
            self.assertNotIn(forbidden,s)
    def test_dashboard_uses_single_canonical_fixture(self):
        s=(ROOT/'workscore-audit-lab.html').read_text(encoding='utf-8')
        data=json.loads((ROOT/'research/workscore_fixtures_v0.1.json').read_text(encoding='utf-8'))
        self.assertIn("/research/workscore_fixtures_v0.1.json",s)
        self.assertIn('loadFixtures().then(display)',s)
        self.assertNotIn('const base={expected:',s)
        self.assertEqual(len(data['cases']),3)
        self.assertTrue(all(case['events'] for case in data['cases']))
    def test_inspection_and_chain_verification(self):
        s=(ROOT/'workscore-audit-lab.html').read_text(encoding='utf-8')
        for marker in ("crypto.subtle.digest('SHA-256'","async function build(id)","function renderEvent(e)","prior_digest","Evidence and formula trace"):
            self.assertIn(marker,s)
if __name__=='__main__':
    unittest.main()
