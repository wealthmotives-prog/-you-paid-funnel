#!/usr/bin/env python3
"""Interactive operator-only synthetic Storage access-denial launcher.

Never paste test passwords, JWTs, or API keys into chat, issues or screenshots.
This local-only script asks for passwords with getpass and holds JWTs in process
memory for the duration of the check. It performs NO testing unless explicitly
opted into by an operator. Do not run against actual customer accounts.
"""
import argparse
import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from workverify_storage_negative_http import (
    HOST, identity, run_upload_checks, run_read_checks,
)

def login(email: str, password: str, public_key: str) -> str:
    body=json.dumps({"email":email,"password":password}).encode("utf-8")
    req=urllib.request.Request(
        HOST + "/auth/v1/token?grant_type=password",
        data=body,method="POST",
        headers={"apikey":public_key,"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req,timeout=15) as response:
            payload=json.loads(response.read(65536))
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError):
        raise RuntimeError("Test login failed; check test account access and settings") from None
    token=payload.get("access_token")
    if not isinstance(token,str) or not token:
        raise RuntimeError("No authenticated test session returned")
    return token

def main() -> None:
    p=argparse.ArgumentParser(description="Opt-in isolated You Paid Storage denial tests")
    p.add_argument("--i-understand",action="store_true")
    p.add_argument("--mode",choices=("upload","read"),default="upload")
    args=p.parse_args()
    if not args.i_understand:
        p.error("No requests made; use --i-understand only with two dedicated test accounts.")
    public_key=os.environ.get("YP_TEST_ANON_KEY","")
    if not public_key:
        p.error("Set YP_TEST_ANON_KEY locally; never paste it or any access token in chat.")
    print("Use two dedicated Auth users, with no customer/volunteer data.")
    user_a=input("Test account A email: ").strip()
    password_a=getpass.getpass("Test account A password (hidden): ")
    user_b=input("Test account B email: ").strip()
    password_b=getpass.getpass("Test account B password (hidden): ")
    if not user_a or not user_b or user_a.lower()==user_b.lower():
        p.error("Two distinct test email addresses are required.")
    try:
        token_a=login(user_a,password_a,public_key)
        token_b=login(user_b,password_b,public_key)
        id_a=identity(token_a,public_key)
        id_b=identity(token_b,public_key)
    except RuntimeError as error:
        p.error(str(error))
    finally:
        password_a=password_b=""
    if id_a==id_b:
        p.error("Both logins resolved to one identity.")
    print("Two separate authenticated sessions verified. Tokens not displayed.")
    if args.mode=="upload":
        success=run_upload_checks(public_key,token_a,token_b,id_a)
    else:
        sentinel=os.environ.get("YP_TEST_EXISTING_OBJECT_PATH","")
        if not sentinel:
            p.error("Read test needs an independently verified, existing synthetic sentinel path.")
        try:
            success=run_read_checks(public_key,token_a,token_b,id_a,sentinel)
        except ValueError as err:
            p.error(str(err))
    if not success:
        sys.exit(1)
    print("PASS: observed explicit HTTP access denials. This is not production approval.")

if __name__=="__main__":
    main()
