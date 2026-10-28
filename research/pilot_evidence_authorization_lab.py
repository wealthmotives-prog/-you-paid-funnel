"""Volunteer pilot evidence authorization gate — offline reference, fictional data only.
Demonstrates the required sequence before a service may issue any release decision.
It does NOT authenticate JWTs, scan malware, create URLs, or permit live uploads.
"""
from dataclasses import dataclass
from typing import Optional
from evidence_quarantine_lab import EvidenceState, may_release

@dataclass(frozen=True)
class PilotConsent:
    owner_id: str
    purpose: str
    version: str
    active: bool
    revoked: bool = False

@dataclass(frozen=True)
class PilotRequest:
    principal_id: Optional[str]
    owner_id: str
    purpose: str
    action: str

@dataclass(frozen=True)
class Authorization:
    allowed: bool
    reason: str

PERMITTED_PURPOSE = "pilot_work_evidence_review"

def decide(request: PilotRequest, consent: Optional[PilotConsent],
           evidence: Optional[EvidenceState]) -> Authorization:
    """Fail closed; authorize access to approved research evidence, not uploads."""
    if not request.principal_id or not request.owner_id or request.principal_id != request.owner_id:
        return Authorization(False,"identity_or_ownership_denied")
    if request.action != "read_approved":
        return Authorization(False,"action_not_enabled")
    if request.purpose != PERMITTED_PURPOSE:
        return Authorization(False,"invalid_purpose")
    if consent is None or consent.owner_id != request.owner_id or consent.purpose != PERMITTED_PURPOSE:
        return Authorization(False,"consent_missing_or_wrong_scope")
    if not consent.version or not consent.active or consent.revoked:
        return Authorization(False,"consent_inactive")
    if evidence is None or evidence.owner_id != request.owner_id:
        return Authorization(False,"artifact_not_owned")
    if not may_release(evidence,requesting_owner=request.principal_id,consent_active=consent.active and not consent.revoked):
        return Authorization(False,"quarantined_or_unapproved")
    return Authorization(True,"approved_in_offline_lab_only")
