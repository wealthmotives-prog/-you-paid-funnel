# Milestone: staging pilot consent service v0 — 2026-11-24

- **Date/agent/session:** 2026-11-24, Claude (Opus 5.5), Claude Code session `session_013NTyFKsbEV3gm3ZftoLffv`
- **Status:** COMMITTED + PUSHED (PR #1, draft) · CI PASS · DEPLOYED to staging only (`staging-pilot-consent` v1, verify_jwt=true) · fail-closed gate TESTED live · consent paths NOT yet tested live (gate intentionally off).

## Objective and initial-state evidence
Supply the first missing dependency in the member chain (member → **versioned consent** → upload → scan → operator review): a server-mediated path for members to grant, check and revoke consent in `public.pilot_evidence_consents`, which has no member grants by design.

Initial state, inspected directly from a public clone of `wealthmotives-prog/-you-paid-funnel` at `main` @ `5722dbbb9c33da9eaa1708f994b818be60fc17cf`:
- Staging migration `20261124_pilot_evidence_consent_review_ledger.sql` is present; it revokes all access from `anon`/`authenticated` and grants `service_role` only.
- No Edge Function in the repo reads or writes `pilot_evidence_consents`.
- `app.html` and `operator.html` are both hard-wired to **production** (`xknfxcyezchtypaisieu`), so no staging member/operator UI exists in source.
- Engineering locks are present: `ENGINEERING_RELEASE_APPROVED = false` (scanner), `ALLOW_PROBE = false` (probe).
- Offline suite on `main`: 108 passed, **1 failed** (`test_workscore_audit_dashboard`), so the CI offline workflow is likely red on main. I could not confirm this because the Actions API isn't reachable from this session.

## Environment and branch
Local branch `staging/pilot-consent-service-v0`, based on `main` @ `5722dbb`. No access to Supabase (prod or staging) or Vercel from this session.

## Files touched (all additive, except one test fix and a CI addition)
- `supabase/functions/_shared/pilot_consent_policy.ts` (new): pure fail-closed consent logic plus the staging-host gate.
- `supabase/functions/staging-pilot-consent/index.ts` (new): Edge Function with `status` / `grant` / `revoke` actions.
- `tests/pilot_consent_policy.test.ts` (new): 17 behavioural cases, CON-01 to CON-17.
- `tests/test_staging_pilot_consent_service.py` (new): 7 static guardrail tests that also run the Node suite.
- `tests/test_workscore_audit_dashboard.py`: the `evidence_corrected` assertion now checks the fixture JSON the dashboard loads, where that case moved.
- `.github/workflows/workverify-http-offline-tests.yml`: adds setup-node 22, the new paths and the new test step.
- No migrations. No changes to production files, Stripe, the scanner or the probe.

## Design / security properties
- Refuses to run (503) unless `SUPABASE_URL` host is exactly `rzeodkcvljukaaczeibe.supabase.co` **and** `YOU_PAID_STAGING_CONSENT_ENABLED=true`. It is off by default, and a production ref is rejected even when used as a subdomain.
- Member identity comes only from `auth.getUser(jwt)`. A body `user_id` is rejected, and the service-role key is not accepted as a member bearer.
- Every query is filtered by the verified `userId`, and ownership is re-checked inside the policy.
- Consent requires `affirmative: true`, the exact purpose, the current version string and allow-listed scopes. Expiry is mandatory, at most 90 days.
- Revoked, expired, unparseable, future-dated, outdated-version and cross-member rows all deny.
- Grant is idempotent: an existing covering consent is returned without creating a duplicate.
- The function does not touch storage, artifacts, jobs, the review ledger or Cloudmersive.

## Tests run
| ID | Expected | Observed | Result |
|---|---|---|---|
| CON-01…17 (node --test) | all deny/allow cases as specified | 17/17 pass | PASS (local) |
| Static guardrails (7) | gates, identity, isolation, locks intact | 7/7 pass | PASS (local) |
| Full offline suite | no regressions | 116 passed, 0 failed | PASS (local) |
| GitHub Actions on branch | offline suite green | run 45470776283 success | PASS |
| LIVE-01 no auth header | 401 | 401 UNAUTHORIZED_NO_AUTH_HEADER | PASS |
| LIVE-02 malformed bearer | 401 | 401 UNAUTHORIZED_INVALID_JWT_FORMAT | PASS |
| LIVE-03 anon JWT grant, gate unset | 503, no write | 503 staging_consent_not_enabled | PASS |
| LIVE-04 anon JWT GET, gate unset | 503 | 503 staging_consent_not_enabled | PASS |
| Post-test consent rows | 0 | 0 | PASS |
| Live grant/status/revoke, member A vs B isolation, service key rejected | — | blocked: gate secret unset; no synthetic member sessions | INCONCLUSIVE |

## Rollback
Unreleased: delete the branch. If deployed to staging: `supabase functions delete staging-pilot-consent --project-ref rzeodkcvljukaaczeibe`, or unset `YOU_PAID_STAGING_CONSENT_ENABLED` (the function fails closed with 503). No schema changes need reverting.

## Live infrastructure audit (2026-11-24, read-only)
- Both projects ACTIVE_HEALTHY. Production `xknfxcyezchtypaisieu` (us-west-2), staging `rzeodkcvljukaaczeibe` (us-west-1).
- Production Storage: `yp_evidence_upload_hard_pause` (RESTRICTIVE INSERT) and `yp_evidence_read_hard_pause` (RESTRICTIVE SELECT) present. Permissive owner policies also exist and are overridden by the restrictive ones. Bucket private, 10 MiB. Staging-only tables absent. No public table with RLS off.
- Production functions (8) match the master context. `capture-funnel` and `stripe-founder-webhook` have verify_jwt=false, as expected for their role. The production scanner build hash equals staging's (`3eaa56ab…`), and the staging scanner source shows `ENGINEERING_RELEASE_APPROVED = false`.
- Staging: same two hard pauses present. 4 synthetic objects in the evidence bucket; 4 auth users; 0 consent rows; 0 review events. `yp_staging_review_append_only` trigger enabled. `evidence-staging-fixture` v7 returns 410.
- Staging advisors: 4× INFO "RLS enabled, no policy" (intended deny-by-default) and 1× WARN leaked-password protection disabled (dashboard setting; recommended on).
- GitHub CI: every `main` run since 2026-10-28 has failed at "Verify deterministic offline security assertions". This branch's fix turns it green.

## Unresolved blockers
1. Staging secret `YOU_PAID_STAGING_CONSENT_ENABLED=true` must be set by the owner. Claude's attempt to request it was blocked by session policy.
2. Two synthetic member sessions are needed for live isolation tests. Creating test accounts or signing in requires owner approval or owner-run sign-in.
3. Vercel not yet inspected.
4. Deployed functions named in the master context (`capture-funnel`, `create-founder-checkout`, `stripe-founder-webhook`, `workverify-concurrency-lab`, `employer-confirmation-staging`, `evidence-staging-fixture`) have **no source in the repo**. The repo only has `employer-confirmation`. Stripe webhook source is not version-controlled here.

## Required owner decision
Set `YOU_PAID_STAGING_CONSENT_ENABLED=true` on staging only. Approve creating two synthetic staging test accounts. Decide whether the six undocumented production function sources should be exported to version control. The repo is **public**, so a private repo may be preferable.

## Next safe engineering task
Build a staging-only member page (`staging/member.html`, pinned to the staging ref with the staging publishable key) that signs in a synthetic user and calls this service. After that, build the server-mediated upload function that calls `evaluateConsent(..., "upload_synthetic_evidence")` before any storage write.
