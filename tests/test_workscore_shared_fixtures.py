"""Replay canonical fictional fixture cases in the Python grading and audit engines."""
import json
import sys
import unittest
from decimal import Decimal
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"research"))
from workscore_lab import EvidenceWindow, grade
from workscore_audit_lab import ResearchLedger

def window(record):
    return EvidenceWindow(
        expected_units=Decimal(record["expected"]),
        completed_verified_units=Decimal(record["completed"]),
        excused_units=Decimal(record["excused"]),
        provenance=Decimal(record["provenance"]),
        obligation_definition=Decimal(record["obligation_definition"]),
        integrity=Decimal(record["integrity"]),
        freshness=Decimal(record["freshness"]),
        independently_verified=record["independently_verified"],
        disputed=record["disputed"],
    )

class SharedFixtureReplay(unittest.TestCase):
    def test_fixture_replay(self):
        data=json.loads((ROOT/"research/workscore_fixtures_v0.1.json").read_text())
        self.assertEqual(data["schema"],"you-paid-workscore-fixtures-v0.1")
        ledger=ResearchLedger()
        for case in data["cases"]:
            for record in case["events"]:
                result=grade(window(record))
                event=ledger.evaluate(case["id"],window(record),kind=record["kind"])
                self.assertEqual(result,event.result)
                if result["status"]=="graded":
                    self.assertEqual(result["furnishing_status"],"blocked")
        self.assertTrue(ledger.verify_chain())
        self.assertEqual(len(ledger.history("SHIFT-001")),2)
        self.assertEqual(ledger.history("LEAVE-002")[-1].result["score"],"100.00")
        self.assertEqual(ledger.history("REVIEW-003")[-1].result["status"],"manual_review")

if __name__=="__main__":
    unittest.main()
