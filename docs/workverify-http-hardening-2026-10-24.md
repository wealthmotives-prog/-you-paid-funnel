# WorkVerify HTTP Hardening Checkpoint — 2026-10-24

## Implemented in GitHub
- Updated staged, **undeployed** employer response handler to measure actual UTF-8 byte length of request body (max 2048 bytes), instead of JavaScript string length. Handles unreadable request body with HTTP 400.
- Expanded `tests/workverify_http_security_smoke.py` closed-mode tests to try ordinary, invalid-enumeration, and oversized requests, and check fail-closed status and security response headers when reached with a valid staging JWT.
- Commits ee1a0c5 and 26dd5e5.

## Verified
- Source readback has byte-length guard, body read exception handling, and three closed-mode probes.
- Supabase inventory: only `employer-confirmation-staging` is ACTIVE (version 1, JWT verification ON). It is a hardcoded 503 responder. The intended response handler has not been deployed to Supabase.
- No real employer submissions, outreach or furnishing enabled.

## Outstanding release blockers
- Execute HTTP runner on network reachable from a trusted test environment; cannot claim these probes passed until executed.
- Independently validate actual network concurrency using dedicated staging database, test JWT, and synthetic invitation. Current hard-disabled staging endpoint cannot return 202, so concurrency mode cannot be run against it until an isolated, test-enabled environment exists.
- Trusted edge-level abuse defenses, release approval, source contact validation and records retention remain pending.
