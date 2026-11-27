# Staging post-acceptance hardening — 2026-11-27

STAGING ONLY (`rzeodkcvljukaaczeibe`). Synthetic data. No production change.

## Commits
- `3e4ede3` — both audit ledgers: service_role limited to SELECT/INSERT; TRUNCATE blocked for every role.
- `3cf9206` — consent records immutable except a one-time revocation; evidence integrity anchors immutable for
  non-owner roles; inspection attempts cannot decrease; service_role loses DELETE/TRUNCATE on consents, artifacts and
  jobs; review and reconcile RPCs verify server-set operator/owner markers via a service_role-only helper.

## Verification
- Stored function bodies md5-identical to `20261127_consent_integrity_operator_hardening.sql` (6/6).
- 31 rollback-forced probes: every forbidden change BLOCKED, every legitimate workflow update ALLOWED.
- Live consent service: grant 201, revoke 200, repeat revoke no-op, status `consent_revoked`.
- Deployed function source byte-compared with `993e5c6`: all entrypoints and one copy of each shared module MATCH.
- Offline: `tests/test_staging_ledger_hardening.py` (5) added to CI; staging suite 40/40.

## Open (staging code, not yet fixed)
Consent re-check immediately before the vendor call; vendor 401/403 handled as configuration error; operator queue
filtered by active review consent. Independent security review and legal/privacy review remain required before any
real-volunteer pilot.
