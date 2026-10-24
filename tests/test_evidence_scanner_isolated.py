"""Offline, synthetic scanner integration-path tests; no service secrets or network."""
import io
import importlib.util
from pathlib import Path
from unittest import TestCase
from unittest.mock import MagicMock, patch

path=Path(__file__).resolve().parents[1]/"scripts"/"evidence_scanner_worker.py"
spec=importlib.util.spec_from_file_location("yp_scanner_isolated",path)
worker=importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class Response(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self,*args): self.close()

class IsolatedInspectionTests(TestCase):
    JOB={"id":"test-job","state":"scanning","lease_token":"synthetic-lease",
         "lease_expires_at":"2099-01-01T00:00:00Z",
         "bucket_id":"test-quarantine","object_path":"fixtures/document.txt"}

    def scan_case(self,blob,scanner_exit,max_bytes=1024):
        with patch.object(worker,"BASE","https://example.test"),\
             patch.object(worker,"KEY","synthetic-key"),\
             patch.object(worker,"MAX_BYTES",max_bytes),\
             patch.object(worker.urllib.request,"urlopen",return_value=Response(blob)),\
             patch.object(worker.subprocess,"run",return_value=MagicMock(returncode=scanner_exit)),\
             patch.object(worker,"verdict") as verdict:
            worker.inspect(dict(self.JOB))
            return verdict.call_args

    def test_clean_fixture_calls_clean_with_actual_hash(self):
        import hashlib
        blob=b"synthetic clean timesheet"
        result=self.scan_case(blob,0)
        self.assertEqual(result.args,("test-job","clean"))
        self.assertEqual(result.kwargs["digest"],hashlib.sha256(blob).hexdigest())
        self.assertEqual(result.kwargs["lease_token"],"synthetic-lease")

    def test_antivirus_detection_is_rejected(self):
        # Scanner result is simulated; no real malware is used or executed.
        result=self.scan_case(b"synthetic antivirus trigger",1)
        self.assertEqual(result.args,("test-job","rejected"))
        self.assertEqual(result.kwargs["code"],"malware_detected")

    def test_scan_error_fails_closed(self):
        result=self.scan_case(b"sample",2)
        self.assertEqual(result.args,("test-job","failed"))
        self.assertEqual(result.kwargs["code"],"scanner_error")

    def test_size_limit_fails_closed(self):
        result=self.scan_case(b"more than permitted",0,max_bytes=4)
        self.assertEqual(result.args,("test-job","failed"))
        self.assertEqual(result.kwargs["code"],"inspection_error")

    def test_empty_file_fails_closed(self):
        result=self.scan_case(b"",0)
        self.assertEqual(result.args,("test-job","failed"))

    def test_missing_lease_fails_closed(self):
        bad=dict(self.JOB,lease_token=None)
        with patch.object(worker,"verdict") as verdict:
            worker.inspect(bad)
            verdict.assert_called_once()
            self.assertEqual(verdict.call_args.args[1],"failed")
            self.assertIsNone(verdict.call_args.kwargs["lease_token"])

    def test_no_credentials_does_not_claim(self):
        with patch.object(worker,"BASE",""),patch.object(worker,"KEY",""),\
             patch.object(worker,"api") as api:
            with self.assertRaises(SystemExit):
                worker.main()
            api.assert_not_called()

    def test_scanner_unavailable_does_not_claim(self):
        with patch.object(worker,"BASE","https://example.test"),patch.object(worker,"KEY","synthetic"),\
             patch.object(worker.subprocess,"run",side_effect=FileNotFoundError),\
             patch.object(worker,"api") as api:
            with self.assertRaises(SystemExit):
                worker.main()
            api.assert_not_called()
