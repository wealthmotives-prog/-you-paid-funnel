"""Synthetic-only quarantine release state machine for You Paid research.
No network, storage access, documents, or account changes. NOT a real malware scanner.
"""
from dataclasses import dataclass, replace

STATES=("quarantined","scan_rejected","awaiting_review","approved","revoked")

@dataclass(frozen=True)
class EvidenceState:
    artifact_id: str
    owner_id: str
    consent_active: bool
    state: str = "quarantined"
    scan_digest: str | None = None
    scanner_name: str | None = None
    reviewer_id: str | None = None
    revision: int = 0

def transition(e: EvidenceState, action: str, *, actor: str,
               scan_digest: str | None = None, scanner_name: str | None = None) -> EvidenceState:
    """Model-only state transitions. Production must authenticate actors independently."""
    if not e.artifact_id or not e.owner_id or not actor:
        raise ValueError("Required identity missing")
    if e.state not in STATES:
        raise ValueError("Invalid state")
    if action=="revoke":
        if e.state=="revoked": return e
        return replace(e,state="revoked",consent_active=False,revision=e.revision+1)
    if not e.consent_active or e.state=="revoked":
        raise PermissionError("Consent inactive or revoked")
    if action=="scan_pass":
        if e.state!="quarantined" or actor!="scanner" or not scanner_name or not scan_digest or len(scan_digest)!=64 or any(c not in "0123456789abcdef" for c in scan_digest):
            raise PermissionError("Independent scanner attestation required")
        return replace(e,state="awaiting_review",scanner_name=scanner_name,scan_digest=scan_digest,revision=e.revision+1)
    if action=="scan_fail":
        if e.state!="quarantined" or actor!="scanner":
            raise PermissionError("Only scanner may reject quarantined evidence")
        return replace(e,state="scan_rejected",revision=e.revision+1)
    if action=="review_approve":
        if e.state!="awaiting_review" or not actor.startswith("reviewer:") or not e.scanner_name or not e.scan_digest:
            raise PermissionError("Reviewed scanning clearance required")
        return replace(e,state="approved",reviewer_id=actor,revision=e.revision+1)
    raise PermissionError("Transition not permitted")

def may_release(e: EvidenceState, *, requesting_owner: str, consent_active: bool) -> bool:
    return bool(e.state=="approved" and e.consent_active and consent_active
                and requesting_owner==e.owner_id and e.reviewer_id and e.scanner_name)
