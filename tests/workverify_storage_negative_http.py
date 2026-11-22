#!/usr/bin/env python3
"""Explicit, synthetic-only WorkVerify Storage RLS negative tests.

No credentials are supplied as CLI arguments or printed. No personal documents.
Uploads are attempted with fictional bytes; if RLS has regressed, a synthetic
object could be created and must be investigated/removed by an operator.
For read checks, a *known existing* synthetic sentinel is mandatory; 404 on a
nonexistent object is NOT an authorization test.
"""
import argparse
import json
import os
import sys
import uuid
import urllib.request
import urllib.error
from urllib.parse import quote, urlparse

HOST = "https://xknfxcyezchtypaisieu.supabase.co"
BUCKET = "you-paid-work-evidence"
FAKE_PDF = b"%PDF-1.7\n%Synthetic access-denial fixture; no member records.\n%%EOF\n"
DENIED = {401, 403}
TEST_PREFIX = "synthetic-rls-denial-probe-"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

HTTP = urllib.request.build_opener(NoRedirect)

def send(path, *, method, jwt, apikey, body=None):
    req = urllib.request.Request(
        HOST + path, data=body, method=method,
        headers={"apikey": apikey, "Authorization": "Bearer " + jwt,
                 "Content-Type": "application/pdf" if body is not None else "application/json",
                 "x-upsert": "false"})
    try:
        with HTTP.open(req, timeout=12) as res:
            return res.status, res.read(8192)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(8192)

def identity(jwt, key):
    status, raw = send("/auth/v1/user", method="GET", jwt=jwt, apikey=key)
    if status != 200:
        raise RuntimeError("Authentication check did not succeed (status %s)" % status)
    try:
        data = json.loads(raw)
        sub = str(uuid.UUID(data["id"]))
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise RuntimeError("Invalid Supabase user response") from None
    if data.get("is_anonymous") is True:
        raise RuntimeError("Anonymous Supabase user is not a valid dedicated test identity")
    return sub

def safe_sentinel(value, expected_owner):
    """Require exact owner folder, clearly synthetic basename and PDF suffix."""
    if not value:
        raise ValueError("No known seeded synthetic object specified")
    parts = value.split("/")
    if len(parts) != 2 or parts[0] != expected_owner:
        raise ValueError("Seeded test object path must be under test member A's folder")
    name = parts[1]
    if not name.startswith("synthetic-rls-sentinel-") or not name.endswith(".pdf"):
        raise ValueError("Seeded object must use synthetic-rls-sentinel-*.pdf name")
    if ".." in name or len(name) > 120 or any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789-_."
                                            for ch in name):
        raise ValueError("Invalid sentinel filename")
    return value

def run_upload_checks(key, token_a, token_b, owner):
    # A fresh random path avoids overwriting any prior test fixture.
    new_path = owner + "/" + TEST_PREFIX + uuid.uuid4().hex + ".pdf"
    endpoint = "/storage/v1/object/" + BUCKET + "/" + quote(new_path, safe="/")
    for label, token in (("A own upload", token_a), ("B cross-owner upload", token_b)):
        status, _ = send(endpoint, method="POST", jwt=token, apikey=key, body=FAKE_PDF)
        print(label, "HTTP", status)
        if status not in DENIED:
            print("FAIL/INCONCLUSIVE: Synthetic write attempt was not explicitly forbidden. "
                  "Check for an accidentally created object and investigate. Object:", new_path)
            return False
    return True

def run_read_checks(key, token_a, token_b, owner, sentinel):
    path = safe_sentinel(sentinel, owner)
    endpoint = "/storage/v1/object/" + BUCKET + "/" + quote(path, safe="/")
    for label, token in (("A existing-object read", token_a),
                         ("B cross-owner existing-object read", token_b)):
        status, _ = send(endpoint, method="GET", jwt=token, apikey=key)
        print(label, "HTTP", status)
        if status not in DENIED:
            print("FAIL/INCONCLUSIVE: Read must be explicitly denied. "
                  "404 does not prove denial if the object is absent.")
            return False
    return True

def main():
    parser = argparse.ArgumentParser(description="Manual operator-only synthetic Storage tests")
    parser.add_argument("--i-understand", action="store_true")
    parser.add_argument("--mode", choices=("upload", "read"), default="upload")
    args = parser.parse_args()
    if not args.i_understand:
        parser.error("Explicit --i-understand required; no tests have run.")
    key = os.environ.get("YP_TEST_ANON_KEY", "")
    token_a = os.environ.get("YP_TEST_MEMBER_A_JWT", "")
    token_b = os.environ.get("YP_TEST_MEMBER_B_JWT", "")
    if not key or not token_a or not token_b:
        parser.error("Missing test-only publishable/anon key or isolated member JWTs in environment")
    if token_a == token_b:
        parser.error("Two distinct dedicated member JWTs are required")
    a = identity(token_a, key)
    b = identity(token_b, key)
    if a == b:
        parser.error("Test JWTs resolve to the same user")
    print("Authenticated distinct synthetic identities; identifiers and tokens are not printed.")
    if args.mode == "upload":
        success = run_upload_checks(key, token_a, token_b, a)
    else:
        # Operator must verify this synthetic object exists out-of-band via
        # trusted service access. Never auto-seed or use real customer objects.
        sentinel = os.environ.get("YP_TEST_EXISTING_OBJECT_PATH", "")
        if not sentinel:
            parser.error("Read mode needs a verified existing synthetic sentinel path")
        try:
            success = run_read_checks(key, token_a, token_b, a, sentinel)
        except ValueError as exc:
            parser.error(str(exc))
    if not success:
        sys.exit(1)
    print("PASS: requested synthetic HTTP denial probes returned explicit 401/403.")
    print("This does not authorize production uploads or prove other access routes.")

if __name__ == "__main__":
    main()
