# You Paid — Cloudmersive scanner staging deployment verification
Date: November 21, 2026

## Verified
- The user reports adding the Cloudmersive API key as a Supabase Edge Function secret. **The secret's actual value and correctness were not read or checked.**
- `evidence-cloudmersive-scanner` deployed to Supabase project `xknfxcyezchtypaisieu` as Edge Function version 1, `status=ACTIVE`, `verify_jwt=true`.
- Inspected deployed source via `get_edge_function`; contains `const ENGINEERING_RELEASE_APPROVED = false`. The handler requires BOTH code approval and `YOU_PAID_CLOUDMERSIVE_SCANNER_ENABLED=true` before any document processing.
- Source keeps evidence quarantined; never issues document access URLs or approves objects.
- GitHub test `tests/test_cloudmersive_worker_contract.py` now requires explicit engineering lock to stay false.
- No actual Cloudmersive call, credential test, infected-file test, signed-in upload, or real document scan has been executed.

## Next security release gates
1. Confirm configured API key's service is valid via a *synthetic-only* backend test in an isolated scanner environment after reviewing vendor plan, privacy/DPA, rate limits, and file metadata.
2. Provision two isolated test member accounts in Auth, run negative Storage API access tests (deny own/cross-member uploads and reads).
3. Implement per-member and per-purpose consent backend, service-mediated quarantine upload with path ownership and quotas, and record atomically bound inspection jobs.
4. Implement immutable scan-job claims, retries/timeouts and authenticated reviewer approval.
5. Run full synthetic end-to-end tests and obtain security/privacy signoff before enabling any real-person pilot.
6. Keep `ENGINEERING_RELEASE_APPROVED=false` until reviewed code change and controlled rollout. A secret alone never enables upload.

**Do not upload paystubs, bank statements, IDs, or employer contacts yet.** No need to send API keys to ChatGPT.
