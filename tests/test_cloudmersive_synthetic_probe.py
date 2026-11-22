"""Synthetic-only Cloudmersive connectivity probe must never accept member files."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class CloudmersiveProbeChecks(unittest.TestCase):
 def test_probe_is_hard_locked(self):
  s=(ROOT/"supabase/functions/cloudmersive-synthetic-probe/index.ts").read_text()
  for marker in (
   'const ALLOW_PROBE = false;', 'if(!ALLOW_PROBE)',
   'SUPABASE_SERVICE_ROLE_KEY','CLOUDMERSIVE_API_KEY',
   'synthetic-you-paid-scan-test.txt','text/plain',
   'body_not_accepted','member_data_scanned:false','redirect:"error"',
   'AbortSignal.timeout(15000)','length>8192'):
   self.assertIn(marker,s)
 def test_no_member_data_pipeline(self):
  s=(ROOT/"supabase/functions/cloudmersive-synthetic-probe/index.ts").read_text()
  for banned in ('sb.storage','supabase-js','evidence_artifacts','evidence_inspection_jobs',
                 'createSignedUrl(','req.formData(','req.json(','req.text('):
   self.assertNotIn(banned,s)
if __name__=="__main__":
 unittest.main()
