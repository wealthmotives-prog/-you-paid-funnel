#!/usr/bin/env python3
"""Synthetic-only negative HTTP tests of You Paid work-evidence Storage RLS.
Requires two TEST-ONLY Auth JWTs from environment. Never use real member data.
This script does not run on CI and cannot be run without explicit confirmation.
"""
import argparse
import json
import os
import urllib.error
import urllib.request
from urllib.parse import quote

HOST="https://xknfxcyezchtypaisieu.supabase.co"
BUCKET="you-paid-work-evidence"
FIXTURE=b"%PDF-1.7\n%you-paid-synthetic-rls-probe\n%%EOF\n"

def request(path, *, method, jwt, apikey, body=None):
    headers={"apikey":apikey,"Authorization":"Bearer "+jwt,
             "Content-Type":"application/pdf" if body is not None else "application/json",
             "x-upsert":"false"}
    req=urllib.request.Request(HOST+path,data=body,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=12) as res:
            return res.status,res.read(1024).decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        return e.code,e.read(1024).decode("utf-8","replace")

def main():
    p=argparse.ArgumentParser(description="Explicit opt-in synthetic Storage denial test")
    p.add_argument("--i-understand",action="store_true",
                   help="Opt into HTTP probes only after isolation and access approval")
    args=p.parse_args()
    if not args.i_understand:
        p.error("Not executed. Explicit --i-understand is required.")
    key=os.environ.get("YP_TEST_ANON_KEY","")
    token_a=os.environ.get("YP_TEST_MEMBER_A_JWT","")
    token_b=os.environ.get("YP_TEST_MEMBER_B_JWT","")
    user_a=os.environ.get("YP_TEST_MEMBER_A_UUID","")
    if not key or not token_a or not token_b or not user_a:
        p.error("Supply isolated test-only anon key, two Auth JWTs, and test member A UUID using environment variables.")
    import uuid
    try: uuid.UUID(user_a)
    except ValueError: p.error("Invalid synthetic user UUID")
    if token_a==token_b: p.error("Different synthetic test member JWTs required")
    # Only a harmless fake PDF is attempted. In a secure configuration, POST is denied.
    # WARNING: If the policy regressed this may create a synthetic object; stop and remediate.
    path=quote(user_a+"/synthetic-rls-denial-probe.pdf",safe="/")
    upload="/storage/v1/object/"+BUCKET+"/"+path
    statuses=[]
    for who,jwt,method,endpoint,body in [
        ("A own upload",token_a,"POST",upload,FIXTURE),
        ("B cross-member upload",token_b,"POST",upload,FIXTURE),
        ("A own read",token_a,"GET",upload,None),
        ("B cross-member read",token_b,"GET",upload,None),
    ]:
        code,_=request(endpoint,method=method,jwt=jwt,apikey=key,body=body)
        statuses.append((who,code))
        print(who,code)
        if code in (200,201,204):
            raise SystemExit("FAIL: an access route unexpectedly succeeded. Freeze pilot; investigate potential synthetic object and security posture.")
        if code not in (401,403,404):
            raise SystemExit("INCONCLUSIVE: unexpected response. Check credentials, rate limits, and service logs; no security PASS granted.")
    print("PASS: all four isolated synthetic requests denied. Verify server-side logs and cleanup independently.")

if __name__=="__main__": main()
