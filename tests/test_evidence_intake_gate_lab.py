"""Fictional-only acceptance tests for fail-closed preflight behavior."""
import hashlib
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"research"))
from evidence_intake_gate_lab import inspect_bytes, MAX_BYTES

PDF=b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"
PNG=b"\x89PNG\r\n\x1a\n"+b"fictional"
JPG=b"\xff\xd8\xff"+b"fictional"

def check(name,mime,payload,**kw):
    return inspect_bytes(filename=name, declared_mime=mime,data=payload,
      expected_sha256=hashlib.sha256(payload).hexdigest(),**kw)

class EvidenceIntakeLabTests(unittest.TestCase):
    def test_disabled_default_blocks_without_hash(self):
        r=check("sample.pdf","application/pdf",PDF)
        self.assertEqual((r.state,r.sha256_hex),("blocked",None))
    def test_pdf_valid_still_quarantined(self):
        self.assertEqual(check("sample.pdf","application/pdf",PDF,intake_enabled=True).state,"quarantined")
    def test_png_valid_still_quarantined(self):
        self.assertEqual(check("sample.png","image/png",PNG,intake_enabled=True).state,"quarantined")
    def test_jpg_valid_still_quarantined(self):
        self.assertEqual(check("sample.jpg","image/jpeg",JPG,intake_enabled=True).state,"quarantined")
    def test_mismatched_signature(self):
        self.assertEqual(check("sample.pdf","application/pdf",PNG,intake_enabled=True).reason,"signature_mismatch")
    def test_wrong_declared_mime(self):
        self.assertEqual(check("sample.pdf","image/png",PDF,intake_enabled=True).reason,"unsupported_type")
    def test_malicious_path(self):
        self.assertEqual(check("../sample.pdf","application/pdf",PDF,intake_enabled=True).reason,"unsafe_filename")
    def test_empty(self):
        self.assertEqual(check("sample.pdf","application/pdf",b"",intake_enabled=True).reason,"invalid_size")
    def test_oversized(self):
        self.assertEqual(check("sample.pdf","application/pdf",PDF+b" "*(MAX_BYTES+1),intake_enabled=True).reason,"invalid_size")
    def test_bad_hash(self):
        r=inspect_bytes(filename="sample.pdf",declared_mime="application/pdf",data=PDF,expected_sha256="0"*64,intake_enabled=True)
        self.assertEqual(r.reason,"hash_mismatch")
    def test_bare_text_rejected(self):
        self.assertEqual(check("sample.pdf","application/pdf",b"fictional",intake_enabled=True).reason,"signature_mismatch")
if __name__=="__main__":
    unittest.main()
