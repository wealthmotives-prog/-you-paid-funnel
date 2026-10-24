#!/usr/bin/env python3
"""WorkVerify HTTP security smoke tests. Standard-library only.

Default mode: verify staging is closed. Explicit concurrency testing requires
a separate synthetic TEST endpoint and invitation token; never use real employers.
"""
import argparse, concurrent.futures, json, os, urllib.request, urllib.error
from urllib.parse import urlparse

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

HTTP=urllib.request.build_opener(NoRedirect)

def send(url, body=None, jwt=None):
    raw = None if body is None else json.dumps(body).encode()
    headers={"Content-Type":"application/json","Accept":"application/json"}
    if jwt: headers["Authorization"]="Bearer "+jwt
    req=urllib.request.Request(url, data=raw, headers=headers, method="POST")
    try:
        with HTTP.open(req, timeout=12) as res:
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
    parsed_url=urlparse(args.url)
    project_host="xknfxcyezchtypaisieu.supabase.co"
    if parsed_url.scheme!="https" or parsed_url.netloc!=project_host or parsed_url.username or parsed_url.password or parsed_url.query or parsed_url.fragment:
        p.error("Only the known HTTPS Supabase project host, without credentials/query/fragment, is accepted")
    if args.mode=="closed":
        if parsed_url.path!="/functions/v1/employer-confirmation-staging":
            p.error("Closed-mode test requires employer-confirmation-staging endpoint")
        probes=[
            ("ordinary",{"test":"synthetic"}),
            ("invalid_enum",{"token":"0"*64,"employment":"perhaps","dates":"yes","schedule":"yes","role":"Synthetic Tester"}),
            ("oversize",{"synthetic":"Z"*4096}),
        ]
        for label,body_in in probes:
            status,body,headers=send(args.url,body_in,args.jwt)
            assert status in (401,403,503), f"{label}: unexpected status {status}"
            if args.jwt and status in (401,403):
                raise AssertionError(f"{label}: test JWT refused; cannot verify disabled handler")
            if status==503:
                assert "employer_confirmation_not_live" in body, f"{label}: wrong closed response"
                normalized={k.lower():v for k,v in headers.items()}
                assert "no-store" in normalized.get("cache-control",""), f"{label}: missing no-store"
                assert normalized.get("x-content-type-options")=="nosniff", f"{label}: missing nosniff"
            print("PASS: closed staging probe", label, status)
    else:
        # Protect against accidental production submissions.
        if not args.synthetic_allow or not args.token or not args.jwt:
            p.error("Concurrent test needs --synthetic-allow, test JWT, synthetic token")
        if len(args.token)!=64 or any(c not in "0123456789abcdef" for c in args.token):
            p.error("Token must be a 64-character lowercase hex synthetic token")
        if parsed_url.path!="/functions/v1/workverify-concurrency-lab":
            p.error("Concurrent mode requires isolated workverify-concurrency-lab")
        payload={"token":args.token}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:send(args.url,payload,args.jwt),range(2)))
        statuses=sorted([r[0] for r in results])
        assert statuses==[202,409], f"Expected one acceptance and one duplicate refusal; got {statuses}"
        for status,body,headers in results:
            normalized={k.lower():v for k,v in headers.items()}
            assert "no-store" in normalized.get("cache-control","")
            if status==202:
                response=json.loads(body)
                assert response.get("employment_verified") is False
                assert response.get("result")=="synthetic_accepted"
        print("PASS: exactly one synthetic response accepted, second rejected",statuses)
if __name__=="__main__": main()
