#!/usr/bin/env python3
"""WorkVerify HTTP security smoke tests. Standard-library only.

Default mode: verify staging is closed. Explicit concurrency testing requires
a separate synthetic TEST endpoint and invitation token; never use real employers.
"""
import argparse, concurrent.futures, json, os, urllib.request, urllib.error

def send(url, body=None, jwt=None):
    raw = None if body is None else json.dumps(body).encode()
    headers={"Content-Type":"application/json","Accept":"application/json"}
    if jwt: headers["Authorization"]="Bearer "+jwt
    req=urllib.request.Request(url, data=raw, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            return res.status, res.read(8192).decode(), dict(res.headers)
    except urllib.error.HTTPError as err:
        return err.code,err.read(8192).decode(),dict(err.headers)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--url", default=os.getenv("WORKVERIFY_TEST_URL",""))
    p.add_argument("--mode",choices=["closed","concurrent"],default="closed")
    p.add_argument("--jwt",default=os.getenv("WORKVERIFY_TEST_JWT"))
    p.add_argument("--token",default=os.getenv("WORKVERIFY_SYNTHETIC_TOKEN"))
    p.add_argument("--synthetic-allow",action="store_true")
    args=p.parse_args()
    if not args.url.startswith("https://"): p.error("HTTPS --url required")
    if args.mode=="closed":
        status,body,headers=send(args.url,{"test":"synthetic"},args.jwt)
        assert status in (401,403,503), f"Unexpected status {status}"
        if status==503:
            assert "employer_confirmation_not_live" in body, "Wrong closed response"
            assert "no-store" in headers.get("Cache-Control",""), "No no-store header"
        print("PASS: endpoint closed",status)
    else:
        # Protect against accidental production submissions.
        if not args.synthetic_allow or not args.token or not args.jwt:
            p.error("Concurrent test needs --synthetic-allow, test JWT, synthetic token")
        if len(args.token)!=64 or any(c not in "0123456789abcdef" for c in args.token):
            p.error("Token must be a 64-character lowercase hex synthetic token")
        if "employer-confirmation-staging" not in args.url:
            p.error("Only isolated employer-confirmation-staging endpoints allowed")
        payload={"token":args.token,"employment":"yes","dates":"unknown","schedule":"unknown","role":"Synthetic Tester"}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:send(args.url,payload,args.jwt),range(2)))
        statuses=sorted([r[0] for r in results])
        assert statuses==[202,400], f"Expected one success, one replay rejection; got {statuses}"
        for status,body,headers in results:
            assert "no-store" in headers.get("Cache-Control","")
            if status==202:
                response=json.loads(body)
                assert response.get("employment_verified") is False
                assert response.get("status")=="pending_review"
        print("PASS: exactly one synthetic response accepted, second rejected",statuses)
if __name__=="__main__": main()
