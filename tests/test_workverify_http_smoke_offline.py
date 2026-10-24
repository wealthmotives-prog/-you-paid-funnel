"""Offline regression tests for WorkVerify HTTP smoke runner; no network or secrets."""
import contextlib
import importlib.util
import io
import pathlib
import sys
import unittest
from unittest.mock import patch

SCRIPT=pathlib.Path(__file__).with_name("workverify_http_security_smoke.py")
spec=importlib.util.spec_from_file_location("workverify_smoke",SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
HOST="https://xknfxcyezchtypaisieu.supabase.co/functions/v1/"

class SmokeRunnerTests(unittest.TestCase):
 def invoke(self,args,responses):
  sent=[]
  def fake_send(url,body=None,jwt=None):
   sent.append((url,body,jwt))
   return responses[len(sent)-1]
  with patch.object(module,"send",side_effect=fake_send):
   with patch.object(sys,"argv",["smoke"]+args):
    with contextlib.redirect_stdout(io.StringIO()):
     module.main()
  return sent

 def test_closed_staging_all_probes(self):
  response=(503,'{"error":"employer_confirmation_not_live"}',
            {"cache-control":"no-store","x-content-type-options":"nosniff"})
  sent=self.invoke(["--url",HOST+"employer-confirmation-staging","--jwt","fictional"],[response]*3)
  self.assertEqual(len(sent),3)

 def test_concurrent_one_accept_one_reject(self):
  responses=[
   (202,'{"result":"synthetic_accepted","employment_verified":false}',{"cache-control":"no-store"}),
   (409,'{"result":"synthetic_unavailable","employment_verified":false}',{"Cache-Control":"no-store"})
  ]
  sent=self.invoke(["--url",HOST+"workverify-concurrency-lab","--mode","concurrent","--jwt","fictional","--token","a"*64,"--synthetic-allow"],responses)
  self.assertEqual(len(sent),2)

 def test_double_acceptance_must_fail(self):
  response=(202,'{"result":"synthetic_accepted","employment_verified":false}',{"Cache-Control":"no-store"})
  with self.assertRaises(AssertionError):
   self.invoke(["--url",HOST+"workverify-concurrency-lab","--mode","concurrent","--jwt","fictional","--token","a"*64,"--synthetic-allow"],[response,response])

 def test_redirects_never_forward_test_credentials(self):
  import urllib.error
  request=__import__("urllib.request",fromlist=["Request"]).Request(
      HOST+"workverify-concurrency-lab",
      headers={"Authorization":"Bearer fictional"})
  response=__import__("email.message",fromlist=["Message"]).Message()
  blocked=module.NoRedirect().redirect_request(
      request,None,302,"Found",response,"https://evil.example/receive")
  self.assertIsNone(blocked)

 def test_deceptive_destination_rejected(self):
  candidates=[
   "https://evil.example/functions/v1/workverify-concurrency-lab",
   "https://xknfxcyezchtypaisieu.supabase.co.evil.example/functions/v1/workverify-concurrency-lab",
   HOST+"workverify-concurrency-lab?redirect=https://evil.example",
   HOST+"employer-confirmation-staging/extra",
  ]
  for url in candidates:
   with self.subTest(url=url):
    with self.assertRaises(SystemExit):
     self.invoke(["--url",url],[])

if __name__=="__main__":
 unittest.main()
