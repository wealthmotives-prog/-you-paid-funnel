"""Offline research-only evidence intake gate.
No file reads, uploads, storage writes, network, or personal data.
NOT malware scanning and NOT authorization for live submissions.
"""
from dataclasses import dataclass
from hashlib import sha256
from typing import Optional

MAX_BYTES = 10 * 1024 * 1024
MIMES = {"pdf":"application/pdf","png":"image/png","jpg":"image/jpeg"}

@dataclass(frozen=True)
class PreflightDecision:
    admitted: bool
    state: str
    reason: str
    sha256_hex: Optional[str]

def sniff(data: bytes) -> Optional[str]:
    if data.startswith(b"%PDF-"): return "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"): return "png"
    if data.startswith(b"\xff\xd8\xff"): return "jpg"
    return None

def inspect_bytes(*, filename: str, declared_mime: str, data: bytes,
                  expected_sha256: str, intake_enabled: bool = False) -> PreflightDecision:
    # Fail closed before touching any evidence when the pilot is not approved.
    if not intake_enabled:
        return PreflightDecision(False,"blocked","intake_disabled",None)
    if not isinstance(data, bytes):
        return PreflightDecision(False,"rejected","invalid_bytes",None)
    if not isinstance(filename,str) or not filename or filename.startswith(".") or "/" in filename or "\\" in filename:
        return PreflightDecision(False,"rejected","unsafe_filename",None)
    ext=filename.rsplit(".",1)[-1].lower() if "." in filename else ""
    if ext not in MIMES or declared_mime!=MIMES[ext]:
        return PreflightDecision(False,"rejected","unsupported_type",None)
    if not (0<len(data)<=MAX_BYTES):
        return PreflightDecision(False,"rejected","invalid_size",None)
    if sniff(data)!=ext:
        return PreflightDecision(False,"rejected","signature_mismatch",None)
    digest=sha256(data).hexdigest()
    if not isinstance(expected_sha256,str) or digest!=expected_sha256.lower():
        return PreflightDecision(False,"rejected","hash_mismatch",None)
    # Even a passing preflight cannot pronounce the document clean.
    return PreflightDecision(True,"quarantined","awaiting_independent_antivirus_scan",digest)
