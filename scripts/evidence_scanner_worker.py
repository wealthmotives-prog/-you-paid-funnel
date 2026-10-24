#!/usr/bin/env python3
"""WorkVerify quarantined evidence scanner. NOT ENABLED until deployment and staging gates pass.

Requirements: Python 3.11+, ClamAV clamscan with current definitions; service-role Supabase
key only in trusted backend environment. Run as isolated worker without public ingress.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MAX_BYTES = int(os.environ.get("YP_SCAN_MAX_BYTES", str(12 * 1024 * 1024)))
LIMIT = min(max(int(os.environ.get("YP_SCAN_BATCH", "1")), 1), 5)
SCANNER = os.environ.get("YP_CLAMSCAN_BIN", "clamscan")
TIMEOUT = 90


def api(path, *, method="GET", data=None, content_type="application/json", return_rows=False):
    headers = {"apikey": KEY, "Authorization": "Bearer " + KEY}
    if return_rows:
        headers["Prefer"] = "return=representation"
    body = None if data is None else json.dumps(data).encode()
    if body is not None:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as res:
        content = res.read()
        return json.loads(content) if content else None


def verdict(job_id, state, *, lease_token, digest=None, code=None):
    """Only acknowledge a verdict if one still-scanning job was updated."""
    if not lease_token:\n        raise ValueError("Inspection lease token required")\n    if state not in ("clean", "rejected", "failed"):
        raise ValueError("Unsupported terminal inspection state")
    patch = {"state": state}
    if state == "clean":
        if not digest or len(digest) != 64:
            raise ValueError("Clean verdict requires SHA256")
        patch.update({"actual_sha256": digest, "scanner_name": "clamav-clamscan",
                      "scanned_at": __import__("datetime").datetime.now(
                          __import__("datetime").timezone.utc).isoformat()})
    else:
        patch["failure_code"] = code or "inspection_error"
    response = api("/rest/v1/evidence_inspection_jobs?id=eq." +
                   urllib.parse.quote(job_id, safe="") + "&state=eq.scanning&lease_token=eq." +\n                   urllib.parse.quote(lease_token, safe="") + "&lease_expires_at=gt." +\n                   urllib.parse.quote(__import__("datetime").datetime.now(\n                       __import__("datetime").timezone.utc).isoformat(), safe=""),
                   method="PATCH", data=patch, return_rows=True)
    if not isinstance(response, list) or len(response) != 1 or response[0].get("state") != state:
        raise RuntimeError("Inspection verdict was not persisted against a scanning job")


def inspect(job):
    job_id = job["id"]\n    token = job.get("lease_token")
    try:
        if not token or not job.get("lease_expires_at"):\n            raise ValueError("Claimed job has no lease")\n        if job.get("state") != "scanning":
            raise ValueError("Unexpected unclaimed job state")
        bucket = job["bucket_id"]
        path = job["object_path"]
        if not bucket or not path or path.startswith("/") or ".." in path.split("/"):
            raise ValueError("Invalid quarantined object path")
        if MAX_BYTES < 1 or MAX_BYTES > 50 * 1024 * 1024:
            raise ValueError("Unacceptable configured scan limit")
        url = (BASE + "/storage/v1/object/" + urllib.parse.quote(bucket, safe="")
               + "/" + urllib.parse.quote(path, safe="/"))
        req = urllib.request.Request(url, headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
        sha = hashlib.sha256()
        total = 0
        with tempfile.TemporaryDirectory(prefix="yp-inspect-") as directory:
            local_path = os.path.join(directory, "quarantine")
            with urllib.request.urlopen(req, timeout=30) as response, open(local_path, "wb") as out:
                while True:
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise ValueError("File exceeds scanning limit")
                    sha.update(chunk)
                    out.write(chunk)
            if total == 0:
                raise ValueError("Empty evidence file")
            scan = subprocess.run([SCANNER, "--no-summary", local_path],
                                  capture_output=True, text=True, timeout=TIMEOUT, check=False)
            if scan.returncode == 1:
                verdict(job_id, "rejected", lease_token=token, code="malware_detected")
            elif scan.returncode == 0:
                verdict(job_id, "clean", lease_token=token, digest=sha.hexdigest())
            else:
                verdict(job_id, "failed", lease_token=token, code="scanner_error")
    except (Exception) as error:
        # Never mark clean on scanner errors or database/store failures.
        print("Job " + job_id + " failed: " + type(error).__name__, file=sys.stderr)
        try:
            verdict(job_id, "failed", code="inspection_error")
        except Exception:
            print("Unable to persist failure status; operator recovery required", file=sys.stderr)


def main():
    if not BASE.startswith("https://") or not KEY:
        sys.exit("Missing secure SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    try:
        probe = subprocess.run([SCANNER, "--version"], capture_output=True, timeout=8)
        if probe.returncode != 0:
            raise RuntimeError("ClamAV unavailable")
    except Exception:
        sys.exit("Scanner unavailable; refusing to claim inspection jobs")
    # Recover expired leases before claiming available jobs. Recovery is service-role only.
    recovered = api("/rest/v1/rpc/recover_expired_evidence_inspections",
                    method="POST", data={"p_limit": 20, "p_max_attempts": 3}) or []
    print("Recovered or exhausted inspection leases: " + str(len(recovered)))
    jobs = api("/rest/v1/rpc/claim_evidence_inspection_jobs", method="POST", data={"p_limit": LIMIT}) or []
    for job in jobs:
        inspect(job)


if __name__ == "__main__":
    main()
