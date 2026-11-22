"""Offline contract tests for staged Cloudmersive Edge Function (no API calls).
Executes the TypeScript verdict function via Node VM against fictional vendor responses.
"""
from pathlib import Path
import json
import re
import shutil
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"supabase/functions/evidence-cloudmersive-scanner/index.ts"

class CloudmersiveWorkerChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=SOURCE.read_text()
    def test_worker_is_fail_closed_and_never_approves(self):
        s=self.source
        for marker in ('YOU_PAID_CLOUDMERSIVE_SCANNER_ENABLED','CLOUDMERSIVE_API_KEY',
                       'SUPABASE_SERVICE_ROLE_KEY','awaiting_human_review',
                       'state:"quarantined"','approved:false','member_access:false',
                       'digest!==artifact.content_hash','AbortSignal.timeout(20000)',
                       'https://api.cloudmersive.com/virus/scan/file'):
            self.assertIn(marker,s)
        self.assertIn('const ENGINEERING_RELEASE_APPROVED = false;',s)
        self.assertIn('if(!ENGINEERING_RELEASE_APPROVED ||',s)
        self.assertNotIn('createSignedUrl(',s)
        self.assertNotIn('upload(',s)
    @unittest.skipUnless(shutil.which("node"),"Requires node")
    def test_verdict_contract_mock_responses(self):
        source=self.source
        match=re.search(r'function outcome\(payload:unknown\):.*?\n}\n',source,re.S)
        self.assertIsNotNone(match)
        # TS annotation removal applies only to isolated function and runs in a VM.
        body=match.group(0).replace('payload:unknown','payload').replace(':"clean"|"infected"|"indeterminate"','').replace(' as Record<string,unknown>','')
        script=body+'''
const cases=[
 [{CleanResult:true,FoundViruses:null},"clean"],
 [{CleanResult:true,FoundViruses:[]},"clean"],
 [{CleanResult:false,FoundViruses:[{VirusName:"synthetic"}]},"infected"],
 [{CleanResult:true,FoundViruses:[{VirusName:"synthetic"}]},"indeterminate"],
 [{CleanResult:true},"indeterminate"],
 [{CleanResult:"true",FoundViruses:null},"indeterminate"],
 [{FoundViruses:[]},"indeterminate"],
 [null,"indeterminate"],
 [{CleanResult:false},"infected"]
];
for(const [payload,expected] of cases)if(outcome(payload)!==expected)process.exit(3);
'''
        r=subprocess.run(["node","-e",script],text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr)
if __name__=="__main__":
    unittest.main()
