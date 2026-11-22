# You Paid — Scanner v2 Hardening and Verification (2026-11-21)

## Release state
- Supabase project: `xknfxcyezchtypaisieu`
- Function slug: `evidence-cloudmersive-scanner`
- Verified runtime version: **2**; deployment status: **ACTIVE**; gateway `verify_jwt=true`.
- Read back deployed `index.ts` and verified `ENGINEERING_RELEASE_APPROVED = false`.
- The function remains **inoperable for scanning** by design: neither a browser request nor changing the environment enable flag alone can bypass the hard-coded safety gate. A separate reviewed source/deployment change is required.
- Added `boundedJson(response, 16384)` to enforce a 16 KiB vendor-response cap while reading bytes, instead of trusting Content-Length or buffering unbounded text.
- Existing response handling requires explicit vendor `CleanResult=true` plus an empty/null `FoundViruses` response to record a scanner-clean *signal*; it does **not** authorize release.
- No member uploads, real documents, API-key validation, or live malware scan conducted.

## Cloudmersive reference
Basic Scan a File, `POST /virus/scan/file`, multipart `inputFile`, header `Apikey`. Official API docs: https://api.cloudmersive.com/docs/virus.asp
A successful HTTP response is not the same as `CleanResult=true`.

## Verification performed
- Compared deployed function source to latest GitHub source for the hard lock and bounded parser markers.
- Github test `tests/test_cloudmersive_worker_contract.py` now checks for bounded streaming and absence of unbounded response reads.
- **Automated test pass has not been verified** from Actions. Vercel status is not Edge Function QA.

## Remaining blocks for first real upload
1. Execute isolated synthetic-only API-key/scan tests. Create a dedicated authenticated service-to-service test route or test service and authorize test calls without enabling member uploads; no private volunteer documents.
2. Conduct two-member authentication/ownership negative tests; ensure direct evidence bucket reads and writes remain restricted.
3. Implement consent-backed member intake, quotas, object/job transaction, dedicated scanner claim/lease, and hardening against race conditions.
4. Build independently authenticated reviewer approval and revoke/retention path.
5. Complete vendor data-handling, DPA and security/privacy review; test full simulated approval/failure paths.
6. Only then approve and deliberately lift the safety release gate.

**Pilot remains NO-GO.** Do not request the volunteer's paystubs, IDs, bank details or employer contact information.
