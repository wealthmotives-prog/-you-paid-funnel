# Employer Response Security Checkpoint — 2026-10-24

Status: database-path synthetic tests passed; public employer intake stays OFF.

## Synthetic tests executed inside rollback-only SQL transactions
1. Rate limiter configured 2 permitted calls / 3600-second window: first two permitted, third denied; counter reached 3. Rolled back.
2. Created synthetic employment and authorized employer request (using a currently existing member id as a transactional fixture). Issued a 1-hour invitation.
3. Consumed invitation with a synthetic employer response; function returned pending_review and never employment_verified.
4. Replayed already-consumed invitation; rejected.
5. Reset test token within the same transaction to simulate expiry; expired attempt rejected.
6. Reset test expiration and applied withdrawn member consent; attempt rejected.
7. Rolled back entire fixture. Verified 0 matching synthetic employments, 0 invitations, 0 employer responses, 0 rate-test buckets after test.

## Existing protections
- Service role only invitation issuance / token consumption / rate limit control functions.
- Token hash only in the database. Public reply never reveals whether a token exists.
- Edge function implementation exists in GitHub source but not deployed to Supabase. Feature gated WORKVERIFY_EMPLOYER_INTAKE_ENABLED=true plus server-only secrets.
- No employer outreach, no member-sensitive evidence upload, no bureau furnishing enabled.

## Release blockers still open
- Deploy only to a controlled staging Supabase function and prove fail-closed flag behavior.
- HTTP-level tests for content-type, body size, invalid tokens, duplicate and expired tokens, third-party embedded requests, leakage, response cache headers.
- Concurrency/replay tests across two separate simultaneous requests; a single SQL transaction does not prove real concurrency.
- Protection from brute-force abuse across *different* candidate tokens, not only per-token bucket; add independent network-level rate limits/WAF and monitoring. Never trust user-controlled X-Forwarded-For without verified edge provenance.
- Authenticated operator issuance and trusted employer contact validation with explicit consent; safe invitation dispatch and bounce handling.
- Employer response page accessible UX and server-side post with no token in logs or referrers.
- End-to-end audit trail, incident handling and data retention.
