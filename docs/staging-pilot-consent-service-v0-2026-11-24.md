# Milestone: staging pilot consent service v0 — 2026-11-24

- **Date/agent/session:** 2026-11-24, Claude (Opus 5.5), Claude Code session `session_013NTyFKsbEV3gm3ZftoLffv`
- **Status:** COMMITTED (local branch only). Not pushed, not deployed, not tested against live staging.

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
| Live staging HTTP: 401 no session, 401 service key as bearer, 422 bad grant, A cannot see B | — | not run (no staging access) | INCONCLUSIVE |

## Rollback
Unreleased: delete the branch. If deployed to staging: `supabase functions delete staging-pilot-consent --project-ref rzeodkcvljukaaczeibe`, or unset `YOU_PAID_STAGING_CONSENT_ENABLED` (the function fails closed with 503). No schema changes need reverting.

## Unresolved blockers
1. No GitHub push or API access: the GitHub account isn't linked to this Claude session.
2. No Supabase connector, so live staging and production state can't be re-verified.
3. No Vercel connector, so deployments and domains can't be re-verified, and it's unknown whether a staging site exists.
4. Deployed functions named in the master context (`capture-funnel`, `create-founder-checkout`, `stripe-founder-webhook`, `workverify-concurrency-lab`, `employer-confirmation-staging`, `evidence-staging-fixture`) have **no source in the repo**. The repo only has `employer-confirmation`. Stripe webhook source is not version-controlled here.

## Required owner decision
Connect GitHub, Supabase and Vercel to this session. Then authorize deploying this function to **staging only** and setting `YOU_PAID_STAGING_CONSENT_ENABLED=true` there.

## Next safe engineering task
Build a staging-only member page (`staging/member.html`, pinned to the staging ref with the staging publishable key) that signs in a synthetic user and calls this service. After that, build the server-mediated upload function that calls `evaluateConsent(..., "upload_synthetic_evidence")` before any storage write.
