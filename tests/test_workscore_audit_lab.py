"""Research-only append-only ledger fixtures; no sensitive or real member data."""
import sys
import unittest
from pathlib import Path
from decimal import Decimal as D

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "research"))
from workscore_lab import EvidenceWindow
from workscore_audit_lab import ResearchLedger, digest


def sample(**overrides):
    fields = dict(expected_units=D("20"), completed_verified_units=D("18"), excused_units=D("0"),
                  provenance=D("90"), obligation_definition=D("100"), integrity=D("100"),
                  freshness=D("80"), independently_verified=True, disputed=False)
    fields.update(overrides)
    return EvidenceWindow(**fields)


class AuditLedgerTests(unittest.TestCase):
    def test_chain_verifies(self):
        ledger=ResearchLedger()
        ledger.evaluate("fictional-001",sample())
        ledger.evaluate("fictional-002",sample(completed_verified_units=D("10")))
        self.assertTrue(ledger.verify_chain())
        self.assertNotEqual(ledger.events[0].event_hash, ledger.events[1].event_hash)

    def test_correction_preserves_old(self):
        ledger=ResearchLedger()
        before=ledger.evaluate("fictional-001",sample())
        after=ledger.evaluate("fictional-001",sample(completed_verified_units=D("20")),kind="evidence_corrected")
        self.assertEqual(len(ledger.history("fictional-001")),2)
        self.assertEqual(ledger.history("fictional-001")[0],before)
        self.assertNotEqual(before.result.get("score"),after.result.get("score"))
        self.assertTrue(ledger.verify_chain())

    def test_deterministic_replay(self):
        a=ResearchLedger().evaluate("fictional-001",sample())
        b=ResearchLedger().evaluate("fictional-001",sample())
        self.assertEqual(a.event_hash,b.event_hash)

    def test_no_furnishing(self):
        event=ResearchLedger().evaluate("fictional-001",sample())
        self.assertEqual(event.result["furnishing_status"],"blocked")
        self.assertNotIn("payment_status",event.result)

    def test_dispute_no_grade(self):
        event=ResearchLedger().evaluate("fictional-001",sample(disputed=True))
        self.assertEqual(event.result["status"],"manual_review")
        self.assertIsNone(event.result["grade"])

    def test_no_fake_policy_version(self):
        with self.assertRaises(ValueError):
            ResearchLedger().evaluate("fictional-001",sample(),version="research-0.2")

    def test_no_external_mutable_events(self):
        ledger=ResearchLedger()
        ledger.evaluate("fictional-001",sample())
        self.assertIsInstance(ledger.events,tuple)

if __name__=="__main__":
    unittest.main()
