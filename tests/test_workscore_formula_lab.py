"""Synthetic edge cases for research-only WorkScore; zero real member data."""
import unittest
from decimal import Decimal as D
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "research"))
from workscore_lab import EvidenceWindow, grade

class FormulaLabTests(unittest.TestCase):
    def w(self, **kwargs):
        base = dict(expected_units=D("20"), completed_verified_units=D("20"),
                    provenance=D("100"), obligation_definition=D("100"),
                    integrity=D("100"), freshness=D("100"), independently_verified=True)
        base.update(kwargs)
        return EvidenceWindow(**base)

    def test_fully_documented_window(self):
        got = grade(self.w())
        self.assertEqual((got["status"], got["grade"], got["confidence"]), ("graded", "A", "high"))
        self.assertEqual(got["furnishing_status"], "blocked")

    def test_protected_or_excused_time_neutral(self):
        got = grade(self.w(excused_units=D("8"), completed_verified_units=D("12")))
        self.assertEqual(got["score"], "100.00")
        self.assertEqual(got["eligible_units"], "12")

    def test_zero_due_never_assumes_perfect(self):
        self.assertEqual(grade(self.w(excused_units=D("20"), completed_verified_units=D("0")))["status"], "not_gradable")

    def test_self_report_never_high_confidence(self):
        self.assertEqual(grade(self.w(independently_verified=False, provenance=D("10")))["confidence"], "low")

    def test_missing_source_never_silently_perfect(self):
        self.assertEqual(grade(self.w(provenance=None))["status"], "insufficient_evidence")

    def test_dispute_requires_review_not_penalty(self):
        self.assertEqual(grade(self.w(disputed=True))["status"], "manual_review")

    def test_overreporting_rejected(self):
        with self.assertRaises(ValueError):
            grade(self.w(completed_verified_units=D("21")))

    def test_excused_over_expected_rejected(self):
        with self.assertRaises(ValueError):
            grade(self.w(excused_units=D("21")))

    def test_negative_evidence_factor_rejected(self):
        with self.assertRaises(ValueError):
            grade(self.w(integrity=D("-1")))

if __name__ == "__main__":
    unittest.main()
