# WorkVerify Invalid Input + Dual Gate Check — 2026-10-24

Executed rollback-only SQL tests against Supabase public functions:

- Under a service-role transaction, yp_consume_employer_invitation rejected an invalid response enum ("perhaps").
- Secondary workverify abuse gate configured for two calls allowed the first two calls and refused the third.
- Transaction rolled back. Verified zero synthetic rate rows left and zero issued invitation records.
- Supabase function inventory: employer-confirmation-staging ACTIVE v1 with verify_jwt=true, still hard-disabled. No active production employer-confirmation handler.

Unverified and BLOCKING:
- Real HTTP input validation, JWT requirements, cache response checks, origin/cross-site defenses.
- Concurrent token redemption under simultaneous independent connections.
- Edge-level rate limits for rotating invalid tokens without a shared denial-of-service choke point.
- Live delivery channel, employer contact authentication, operator approval, source provenance, incident monitoring.

Do not enable live employer intake.
