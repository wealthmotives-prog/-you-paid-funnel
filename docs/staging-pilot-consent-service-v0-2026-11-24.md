# Milestone: staging pilot consent service v0 — 2026-11-24

- **Date/agent/session:** 2026-11-24, Claude (Opus 5.5), Claude Code session `session_013NTyFKsbEV3gm3ZftoLffv`
- **Status:** COMMITTED + PUSHED (PR #1, draft) · CI PASS · DEPLOYED to staging only (`staging-pilot-consent` v1, verify_jwt=true) · fail-closed gate and full consent lifecycle TESTED live on staging with two synthetic anonymous members (2026-11-24 20:23 UTC). VERIFIED by DB read-back. Not release-approved.

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
| LIVE-05 anon key as member, gate ON | 401 | 401 invalid_session | PASS |
| C-01 A status, no consent | 200 absent | 200 | PASS |
| C-02 grant without affirmative | 422 | 422 affirmative_consent_required | PASS |
| C-03 grant with forged user_id (B's id) | 422 | 422 user_id_must_come_from_session | PASS |
| C-04 outdated consent version | 422 | 422 consent_version_mismatch | PASS |
| C-05 disallowed scope | 422 | 422 scope_not_allowed | PASS |
| C-06 valid grant | 201 created | 201, 90-day expiry | PASS |
| C-07 repeat grant | 200 created:false, same id | 200, same id | PASS |
| C-08 A status after grant | 200 | 200 | PASS |
| C-09 B status (isolation) | 200 absent | 200 | PASS |
| C-10 B revoke cannot affect A | revoked [] | revoked [] | PASS |
| C-11 A status after B revoke | 200 | 200 | PASS |
| C-12 A direct REST SELECT on consent table | denied | 403 (42501) | PASS |
| C-13 A direct REST INSERT on consent table | denied | 403 (42501) | PASS |
| C-14 invalid JSON | 400 | 400 | PASS |
| C-15 5 KB body | 413 | 413 | PASS |
| C-16 unknown action | 400 | 400 | PASS |
| C-17 A revoke | revoked [A's id] | revoked [7f08f1c1…] | PASS |
| C-18 A status after revoke | 200 | 200 | PASS |
| DB read-back | 1 row, owner A, scope upload only, revoked ≥ granted, 0 rows for B | exactly that | PASS |
| Service-role key rejected as member bearer | 401 | not run (key never handled by Claude); covered by static test | INCONCLUSIVE |

Synthetic test identities (staging, anonymous, no PII): member A `f5330ee2-c660-49e6-8aa2-58cf5ec8ea6d`, member B `508fdbc1-6bcf-493a-8d1e-5d0ae79f276d`.
Note: C-08/C-11/C-18 per-scope reasons were truncated in the capture. Scope semantics are covered by CON-11 and the DB scope array.

## Rollback
Unreleased: delete the branch. If deployed to staging: `supabase functions delete staging-pilot-consent --project-ref rzeodkcvljukaaczeibe`, or unset `YOU_PAID_STAGING_CONSENT_ENABLED` (the function fails closed with 503). No schema changes need reverting.

## Live infrastructure audit (2026-11-24, read-only)
- Both projects ACTIVE_HEALTHY. Production `xknfxcyezchtypaisieu` (us-west-2), staging `rzeodkcvljukaaczeibe` (us-west-1).
- Production Storage: `yp_evidence_upload_hard_pause` (RESTRICTIVE INSERT) and `yp_evidence_read_hard_pause` (RESTRICTIVE SELECT) present. Permissive owner policies also exist and are overridden by the restrictive ones. Bucket private, 10 MiB. Staging-only tables absent. No public table with RLS off.
- Production functions (8) match the master context. `capture-funnel` and `stripe-founder-webhook` have verify_jwt=false, as expected for their role. The production scanner build hash equals staging's (`3eaa56ab…`), and the staging scanner source shows `ENGINEERING_RELEASE_APPROVED = false`.
- Staging: same two hard pauses present. 4 synthetic objects in the evidence bucket; 4 auth users; 0 consent rows; 0 review events. `yp_staging_review_append_only` trigger enabled. `evidence-staging-fixture` v7 returns 410.
- Staging advisors: 4× INFO "RLS enabled, no policy" (intended deny-by-default) and 1× WARN leaked-password protection disabled (dashboard setting; recommended on).
- GitHub CI: every `main` run since 2026-10-28 has failed at "Verify deterministic offline security assertions". This branch's fix turns it green.

- Vercel (read-only, 2026-11-24): one project `you-paid` (`prj_twWeqc1SPxX512FHY2WFcEWVkGtG`, team `wealthmotives-6336`). Production = `main` @ `5722dbb` (`dpl_GWhnDXoTixgxASV542o2X8A35XV9`, READY). `joinyoupaid.com` redirects 308 to `www.joinyoupaid.com`; both verified. **There is no separate staging site.** Feature-branch pushes create Preview deployments (this branch: 3, all READY, none promoted). Vercel SSO protection covers all deployments except custom domains, so previews are team-only. Preview builds still serve the current `app.html`/`operator.html`, which point at the **production** Supabase project. Any staging page must hard-pin the staging ref and must not reuse those files.

## Unresolved blockers
2. Backlog: before any real pilot, the consent service must reject anonymous sessions (`is_anonymous`) and require a verified identity. Anonymous sign-ins on staging are enabled **for synthetic testing only**.
4. Deployed functions named in the master context (`capture-funnel`, `create-founder-checkout`, `stripe-founder-webhook`, `workverify-concurrency-lab`, `employer-confirmation-staging`, `evidence-staging-fixture`) have **no source in the repo**. The repo only has `employer-confirmation`. Stripe webhook source is not version-controlled here.

## Required owner decision
None for this milestone. Separately pending: a production fix approval (tracked privately in the project) and the Vercel team grant.

## Next safe engineering task
Build the server-mediated quarantined upload Edge Function (consent check → size/magic validation → server-owned path → artifact + job → reconciliation), then a staging-only member page (`staging/member.html`, pinned to the staging ref with the staging publishable key) that signs in a synthetic user and calls this service. After that, build the server-mediated upload function that calls `evaluateConsent(..., "upload_synthetic_evidence")` before any storage write.
