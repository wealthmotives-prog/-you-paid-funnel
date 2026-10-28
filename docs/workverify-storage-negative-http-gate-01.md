# WorkVerify Evidence — Synthetic HTTP Authorization Gate 01
**October 28, 2026. Code committed, live HTTP negative tests NOT executed.**

The private evidence bucket's restrictive INSERT and SELECT policies were checked in the live database previously. They remain separate from any service-role endpoints, signed links or independently authorized reviewer access.

## Operator-only test plan
Script: `tests/workverify_storage_negative_http.py`. It requires a deliberate `--i-understand` and two **isolated synthetic Auth account** JWTs, synthetic account A UUID and a project public API key supplied only through local environment variables. These tokens must NEVER be committed to GitHub or pasted in ChatGPT. No employee, identity, bank, payroll or employer data belongs in the test.

The script sends four synthetic-only Storage API probes: A's own upload attempt, B's cross-account upload attempt, A's own read attempt and B's cross-account read attempt. It expects denial on each. It stops on any unexpected success; **a misconfigured policy could permit creation of a harmless synthetic object**, in which case quarantine that object and remediate immediately using authorized operator procedures. Do not use real customer accounts.

These are intended *live negative tests*, not currently passed tests. Do not run before the operator is ready to inspect and clean up any unexpected synthetic artifact.

## Beyond the negative tests
- Authenticated object existence concealment and uniform status codes are implementation-specific; inspect logs rather than relying on response codes alone.
- Confirm anonymous upload/download failure and service-auth authorization separately.
- Test expiring signed URLs and access revocation separately; ordinary Storage RLS may not govern an already issued bearer-style signed URL in the same way.
- Secure malware scanner, file quarantine, private object isolation and consent must be in place before real pilot evidence.
- Once tested, add a permissioned, server-mediated release workflow; never open the original member-folder INSERT/SELECT path without a complete security review.

**Release gate stays CLOSED.**
