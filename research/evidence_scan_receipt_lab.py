"""Offline scanner-attestation prototype. DOES NOT scan files.
A trusted scanning service would sign a result bound to a particular object digest,
verdict, expiry, and unique job ID. Real service orchestration is NOT deployed.
"""
from dataclasses import dataclass
from hashlib import sha256
import hmac
import json
import re
import time

HEX64=re.compile(r"^[0-9a-f]{64}$")

@dataclass(frozen=True)
class ScanReceipt:
    job_id: str
    artifact_sha256: str
    scanner_id: str
    verdict: str
    expires_at: int
    signature: str

def _payload(job_id,artifact_sha256,scanner_id,verdict,expires_at):
    return json.dumps(dict(job_id=job_id,artifact_sha256=artifact_sha256,
        scanner_id=scanner_id,verdict=verdict,expires_at=expires_at),
        sort_keys=True,separators=(",",":")).encode()

def sign_receipt(*,job_id:str,artifact_sha256:str,scanner_id:str,verdict:str,
                 expires_at:int,secret:bytes) -> ScanReceipt:
    if not job_id or not scanner_id or verdict not in ("clean","infected","error"):
        raise ValueError("Invalid scan identification or verdict")
    if not isinstance(artifact_sha256,str) or not HEX64.fullmatch(artifact_sha256):
        raise ValueError("Digest must be lowercase SHA256")
    if not isinstance(secret,bytes) or len(secret)<32:
        raise ValueError("Signing secret must contain at least 32 bytes")
    if not isinstance(expires_at,int) or expires_at<1:
        raise ValueError("Invalid expiry")
    body=_payload(job_id,artifact_sha256,scanner_id,verdict,expires_at)
    signature=hmac.new(secret,body,sha256).hexdigest()
    return ScanReceipt(job_id,artifact_sha256,scanner_id,verdict,expires_at,signature)

def verify_receipt(*,receipt:ScanReceipt,expected_job_id:str,expected_digest:str,
                   trusted_scanner:str,secret:bytes,now:int|None=None)->bool:
    if not isinstance(secret,bytes) or len(secret)<32:return False
    if receipt.verdict!="clean" or not HEX64.fullmatch(receipt.artifact_sha256):return False
    if receipt.job_id!=expected_job_id or receipt.artifact_sha256!=expected_digest or receipt.scanner_id!=trusted_scanner:
        return False
    if now is None:now=int(time.time())
    if receipt.expires_at<=now:return False
    if not HEX64.fullmatch(receipt.signature):return False
    expected=hmac.new(secret,_payload(receipt.job_id,receipt.artifact_sha256,
        receipt.scanner_id,receipt.verdict,receipt.expires_at),sha256).hexdigest()
    return hmac.compare_digest(receipt.signature,expected)
