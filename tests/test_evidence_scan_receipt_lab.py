"""Fictional scanner receipt adversarial tests. No scanner or network involved."""
import sys
import unittest
from dataclasses import replace
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"research"))
from evidence_scan_receipt_lab import sign_receipt,verify_receipt

KEY=b"fictional-test-key-only-32-bytes-long"
DIGEST="a"*64
def signed(**kw):
    defaults=dict(job_id="synthetic-job-001",artifact_sha256=DIGEST,scanner_id="fictional-scanner",
                  verdict="clean",expires_at=2500000000,secret=KEY)
    defaults.update(kw)
    return sign_receipt(**defaults)
def accepted(r,**kw):
    defaults=dict(receipt=r,expected_job_id="synthetic-job-001",expected_digest=DIGEST,
                  trusted_scanner="fictional-scanner",secret=KEY,now=2000000000)
    defaults.update(kw)
    return verify_receipt(**defaults)

class ScannerReceiptTests(unittest.TestCase):
    def test_valid_fictional_receipt(self):self.assertTrue(accepted(signed()))
    def test_untrusted_signer(self):self.assertFalse(accepted(signed(),secret=b"another-fictional-signing-key-32" ))
    def test_infected_verdict(self):self.assertFalse(accepted(signed(verdict="infected")))
    def test_error_verdict(self):self.assertFalse(accepted(signed(verdict="error")))
    def test_wrong_job(self):self.assertFalse(accepted(signed(),expected_job_id="different"))
    def test_wrong_object_digest(self):self.assertFalse(accepted(signed(),expected_digest="b"*64))
    def test_wrong_scanner(self):self.assertFalse(accepted(signed(),trusted_scanner="unknown"))
    def test_expired(self):self.assertFalse(accepted(signed(),now=2500000000))
    def test_forged_verdict(self):self.assertFalse(accepted(replace(signed(verdict="infected"),verdict="clean")))
    def test_bad_signature(self):self.assertFalse(accepted(replace(signed(),signature="0"*64)))
    def test_missing_secret_length(self):
        with self.assertRaises(ValueError):signed(secret=b"too-short")
if __name__=="__main__":unittest.main()
