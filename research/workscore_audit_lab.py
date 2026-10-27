"""Synthetic append-only WorkScore audit ledger — local research, no actual accounts.
Only fictional evidence inputs. Never a credit payment or bureau record.
"""
from dataclasses import asdict, dataclass
from decimal import Decimal
import hashlib
import json
from typing import Any

from workscore_lab import EvidenceWindow, grade


def canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(obj: Any) -> str:
    return hashlib.sha256(canonical(obj).encode("utf-8")).hexdigest()


def normalize(window: EvidenceWindow) -> dict:
    return {key: str(value) if isinstance(value, Decimal) else value
            for key, value in asdict(window).items()}


@dataclass(frozen=True)
class LedgerEvent:
    sequence: int
    kind: str
    window_id: str
    version: str
    evidence_hash: str
    result: dict
    previous_hash: str
    event_hash: str


class ResearchLedger:
    """Append-only event chain with deterministic hashes for reproducible lab replays."""
    def __init__(self):
        self._events: list[LedgerEvent] = []

    @property
    def events(self) -> tuple[LedgerEvent, ...]:
        return tuple(self._events)

    def evaluate(self, window_id: str, window: EvidenceWindow, *, kind="graded",
                 version="research-0.1") -> LedgerEvent:
        if not window_id or not isinstance(window_id, str):
            raise ValueError("Synthetic window ID is required")
        if kind not in {"graded", "evidence_corrected", "regraded"}:
            raise ValueError("Unsupported audit event")
        if version != "research-0.1":
            raise ValueError("No approved alternative formula implementation")
        inputs = normalize(window)
        result = grade(window)
        fingerprint = digest({"inputs": inputs, "version": version})
        previous = self._events[-1].event_hash if self._events else "GENESIS"
        payload = {"sequence": len(self._events)+1, "kind": kind,
                   "window_id": window_id, "version": version,
                   "evidence_hash": fingerprint, "result": result,
                   "previous_hash": previous}
        event = LedgerEvent(**payload, event_hash=digest(payload))
        self._events.append(event)
        return event

    def verify_chain(self) -> bool:
        previous = "GENESIS"
        for number, event in enumerate(self._events, 1):
            obj = asdict(event)
            signature = obj.pop("event_hash")
            if (obj["sequence"] != number or obj["previous_hash"] != previous
                    or digest(obj) != signature):
                return False
            previous = signature
        return True

    def history(self, window_id: str) -> tuple[LedgerEvent, ...]:
        return tuple(event for event in self._events if event.window_id == window_id)
