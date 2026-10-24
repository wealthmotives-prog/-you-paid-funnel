# WorkVerify Secondary Abuse Gate — 2026-10-24

Source updated: supabase/functions/employer-confirmation/index.ts, commit e6a5c714c996e7974620b2091552ea7c05c9c059.

## Implemented
- On enabled path only, server-role client first consults yp_workverify_abuse_gate with a salted hash of constant "workverify:global", using 300 attempts per 3600 seconds.
- This is distinct from token-specific yp_employer_response_rate_gate with 8 attempts per 3600 seconds.
- Both gates are checked before consuming a token. Hashing uses a server secret; raw tokens are not persisted in rate buckets.
- Default feature flag remains OFF.
- Function role check: anonymous=false, authenticated=false, service_role=true. Zero active abuse buckets on check.
- Supabase still lists only employer-confirmation-staging (JWT verification true, deployed hard-disabled), not a live employer-confirmation function.

## Residual risk / shipping blocker
- Global cap reduces rotated token throughput but can be deliberately exhausted, denying service to legitimate invitees. Need trusted edge network-level rate limiting / WAF and monitoring.
- No HTTP-level integration, cross-request concurrency, invitation transport or operator-approved live launch verified.
- Do not enable intake, outreach, or claim readiness.
