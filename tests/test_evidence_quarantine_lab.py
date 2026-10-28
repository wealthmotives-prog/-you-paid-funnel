"""Offline quarantine release tests with fictional identities and attestations."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"research"))
from evidence_quarantine_lab import EvidenceState,transition,may_release

def fresh():
    return EvidenceState("FAKE-001","FICTIONAL-OWNER",True)
def scan(e):
    return transition(e,"scan_pass",actor="scanner",scan_digest="a"*64,scanner_name="test-scanner")

class QuarantineLabTests(unittest.TestCase):
    def test_initial_is_not_releasable(self):
        self.assertFalse(may_release(fresh(),requesting_owner="FICTIONAL-OWNER",consent_active=True))
    def test_scan_only_is_not_releasable(self):
        self.assertFalse(may_release(scan(fresh()),requesting_owner="FICTIONAL-OWNER",consent_active=True))
    def test_reviewed_scanned_and_consented_is_releasable(self):
        approved=transition(scan(fresh()),"review_approve",actor="reviewer:fictional")
        self.assertTrue(may_release(approved,requesting_owner="FICTIONAL-OWNER",consent_active=True))
        self.assertEqual(approved.revision,2)
    def test_cross_owner_denied(self):
        approved=transition(scan(fresh()),"review_approve",actor="reviewer:fictional")
        self.assertFalse(may_release(approved,requesting_owner="OTHER-OWNER",consent_active=True))
    def test_external_consent_revoked_denied(self):
        approved=transition(scan(fresh()),"review_approve",actor="reviewer:fictional")
        self.assertFalse(may_release(approved,requesting_owner="FICTIONAL-OWNER",consent_active=False))
    def test_revoke_persists(self):
        approved=transition(scan(fresh()),"review_approve",actor="reviewer:fictional")
        revoked=transition(approved,"revoke",actor="member")
        self.assertFalse(may_release(revoked,requesting_owner="FICTIONAL-OWNER",consent_active=True))
        with self.assertRaises(PermissionError):transition(revoked,"review_approve",actor="reviewer:fictional")
    def test_fake_scan_actor_denied(self):
        with self.assertRaises(PermissionError):transition(fresh(),"scan_pass",actor="member",scanner_name="test",scan_digest="a"*64)
    def test_missing_scan_proof_denied(self):
        with self.assertRaises(PermissionError):transition(fresh(),"scan_pass",actor="scanner",scanner_name="test")
    def test_review_without_scan_denied(self):
        with self.assertRaises(PermissionError):transition(fresh(),"review_approve",actor="reviewer:fictional")
    def test_scan_failure_not_releasable(self):
        failed=transition(fresh(),"scan_fail",actor="scanner")
        self.assertFalse(may_release(failed,requesting_owner="FICTIONAL-OWNER",consent_active=True))
        with self.assertRaises(PermissionError):transition(failed,"review_approve",actor="reviewer:fictional")
    def test_nonreviewer_not_authorized(self):
        with self.assertRaises(PermissionError):transition(scan(fresh()),"review_approve",actor="member")
if __name__=="__main__":unittest.main()
