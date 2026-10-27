"""Experimental You Paid WorkScore prototype. Fictional/offline research only.
Never use this grade as payment status, a tradeline, or a creditworthiness score.
"""
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

WEIGHTS = {
    "provenance": Decimal("0.30"),
    "obligation_definition": Decimal("0.20"),
    "fulfillment": Decimal("0.30"),
    "integrity": Decimal("0.10"),
    "freshness": Decimal("0.10"),
}
BANDS = ((90, "A"), (80, "B"), (70, "C"), (60, "D"), (0, "E"))

@dataclass(frozen=True)
class EvidenceWindow:
    expected_units: Decimal
    completed_verified_units: Decimal
    excused_units: Decimal = Decimal("0")
    provenance: Optional[Decimal] = None
    obligation_definition: Optional[Decimal] = None
    integrity: Optional[Decimal] = None
    freshness: Optional[Decimal] = None
    independently_verified: bool = False
    disputed: bool = False

def grade(window: EvidenceWindow) -> dict:
    """Compute experimental internal score; no financial ledger mutation."""
    quantities = (window.expected_units, window.completed_verified_units, window.excused_units)
    if any(not q.is_finite() or q < 0 for q in quantities):
        raise ValueError("Performance units must be finite and nonnegative")
    if window.excused_units > window.expected_units:
        raise ValueError("Excused units cannot exceed expected units")
    due = window.expected_units - window.excused_units
    if due == 0:
        return {"status": "not_gradable", "grade": None, "confidence": "insufficient", "reason": "no eligible units due"}
    if window.completed_verified_units > due:
        raise ValueError("Verified completed units exceed eligible units due; reconcile source")
    components = {
        "provenance": window.provenance,
        "obligation_definition": window.obligation_definition,
        "fulfillment": window.completed_verified_units / due * Decimal("100"),
        "integrity": window.integrity,
        "freshness": window.freshness,
    }
    if any(v is not None and (not v.is_finite() or not 0 <= v <= 100) for v in components.values()):
        raise ValueError("All supplied evidence factors must be in [0, 100]")
    if window.disputed:
        return {"status": "manual_review", "grade": None, "confidence": "insufficient", "reason": "contested evidence"}
    if any(v is None for v in components.values()):
        return {"status": "insufficient_evidence", "grade": None, "confidence": "insufficient", "reason": "missing scored dimension"}
    raw = sum((components[k] * WEIGHTS[k] for k in WEIGHTS), Decimal("0"))
    score = raw.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    band = next(b for floor, b in BANDS if raw >= floor)
    confidence = "high" if window.independently_verified and window.provenance >= 80 else ("medium" if window.independently_verified else "low")
    return {"status": "graded", "grade": band, "score": str(score), "confidence": confidence,
            "eligible_units": str(due), "formula_version": "research-0.1",
            "furnishing_status": "blocked"}
