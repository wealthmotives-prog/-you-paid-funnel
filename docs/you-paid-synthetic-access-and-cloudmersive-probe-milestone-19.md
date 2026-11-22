# You Paid — Synthetic access testing & Cloudmersive probe, milestone 19
Date: November 21, 2026

## User-provided readiness
- Cloudmersive API key added to Supabase Secrets (user-confirmed; key value not read or validated).
- Two controlled email addresses are available (user-confirmed). **This does not establish that two Auth users or valid test JWTs have been created.**

## Completed engineering
1. Revised `tests/workverify_storage_negative_http.py`:
   - Requires explicit opt-in, environment-only test JWTs/public key, and two distinct identities confirmed against Supabase Auth `/auth/v1/user`.
   - Uses a fresh random synthetic object path in Member A's bucket folder to test owner and cross-owner uploads; stops on any response other than explicit 401/403.
   - Distinguishes read tests from upload tests. Read checks require an independently verified, preexisting synthetic sentinel object. A 404 on a nonexistent object is **not** a passed RLS read test.
   - Does not delete unexpected writes automatically; operator investigates and cleans up any accidentally created synthetic object.
2. Updated `tests/test_storage_negative_harness.py` to check the new safety controls.
3. Added separate `supabase/functions/cloudmersive-synthetic-probe/index.ts`. It has no user-controlled file inputs, no database/storage access, and uses fictional text as the only possible scan input. Service-role bearer + JWT verification are required.
4. Deployed probe to Supabase project `xknfxcyezchtypaisieu`, version 1, status ACTIVE, verify_jwt=true. Read back deployed source and verified `const ALLOW_PROBE = false` remains in place.
5. Added `tests/test_cloudmersive_synthetic_probe.py` and registered offline checks in CI.
6. Read-only verified both restrictive `storage.objects` INSERT and SELECT hard-pause policies remain present.

## Execution not yet completed
- **No Cloudmersive request was made**, no proof the secret is valid. The isolated probe remains code-locked.
- No two-member authenticated storage HTTP negative tests were run: test Auth users and their session credentials have not been established through the tools.
- No seeded test storage object exists in this workstream; a read-denial test must not return PASS based on an absent object.
- No real document upload, scanning, consent approval or member release was enabled.
- The new offline tests are committed; GitHub Actions pass not independently confirmed.

## Operator's next safe step
In Supabase Authentication -> Users, create or register two separately controlled **synthetic test identities**, with verified access to both mailboxes. Ensure both users belong to the project's test cohort and are not real pilot participants. Do not send passwords, JWT access tokens, API keys, UUIDs, or screenshots with credentials in chat. The engineer can then arrange a secure way to run the opt-in synthetic denial harness. Never seed a synthetic sentinel through unguarded member uploads.

## Strict no-go items
Keep direct member Storage INSERT/SELECT restrictions, scanner `ENGINEERING_RELEASE_APPROVED = false`, synthetic probe `ALLOW_PROBE = false`, and employer intake disabled. Production sensitive uploads remain closed until true vendor scan validation, service-scoped consent, private quarantine, lease-protected scan jobs, signed access, and end-to-end security tests have passed.

## Vendor setup documentation
https://supabase.com/docs/guides/functions/secrets
