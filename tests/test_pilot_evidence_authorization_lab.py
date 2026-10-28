"""Fictional pilot authorization scenarios exercising ownership, consent and scan clearance."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"research"))
from pilot_evidence_authorization_lab import PilotConsent,PilotRequest,decide
from evidence_quarantine_lab import EvidenceState,transition

OWNER="fictional-A"
PURPOSE="pilot_work_evidence_review"

def consent(**changes):
    data=dict(owner_id=OWNER,purpose=PURPOSE,version="v1-consent",active=True,revoked=False)
    data.update(changes)
    return PilotConsent(**data)
def request(**changes):
    data=dict(principal_id=OWNER,owner_id=OWNER,purpose=PURPOSE,action="read_approved")
    data.update(changes)
    return PilotRequest(**data)
def cleared():
    obj=EvidenceState("fictional-document",OWNER,True)
    scanned=transition(obj,"scan_pass",actor="scanner",scanner_name="fictional-independent-scanner",scan_digest="f"*64)
    return transition(scanned,"review_approve",actor="reviewer:fictional")
class PilotAccessTests(unittest.TestCase):
    def test_approved_requires_all_gates(self):
        self.assertTrue(decide(request(),consent(),cleared()).allowed)
    def test_upload_never_approved_by_research_gate(self):
        self.assertFalse(decide(request(action="upload"),consent(),cleared()).allowed)
    def test_missing_identity(self):
        self.assertFalse(decide(request(principal_id=None),consent(),cleared()).allowed)
    def test_cross_member_attempt(self):
        self.assertFalse(decide(request(principal_id="fictional-B"),consent(),cleared()).allowed)
    def test_missing_consent(self):
        self.assertFalse(decide(request(),None,cleared()).allowed)
    def test_revoked_consent(self):
        self.assertFalse(decide(request(),consent(revoked=True),cleared()).allowed)
    def test_wrong_purpose(self):
        self.assertFalse(decide(request(purpose="marketing"),consent(),cleared()).allowed)
    def test_wrong_consent_scope(self):
        self.assertFalse(decide(request(),consent(purpose="marketing"),cleared()).allowed)
    def test_blank_consent_version(self):
        self.assertFalse(decide(request(),consent(version=""),cleared()).allowed)
    def test_missing_evidence(self):
        self.assertFalse(decide(request(),consent(),None).allowed)
    def test_quarantined_document(self):
        self.assertFalse(decide(request(),consent(),EvidenceState("fictional-document",OWNER,True)).allowed)
    def test_independent_scan_without_review(self):
        obj=EvidenceState("fictional-document",OWNER,True)
        scanned=transition(obj,"scan_pass",actor="scanner",scanner_name="fictional-independent-scanner",scan_digest="f"*64)
        self.assertFalse(decide(request(),consent(),scanned).allowed)
    def test_revoked_object(self):
        obj=transition(cleared(),"revoke",actor="member")
        self.assertFalse(decide(request(),consent(),obj).allowed)
if __name__=="__main__":
    unittest.main()
