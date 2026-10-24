# Employer Confirmation Staging Gate — 2026-10-24

Deployed Supabase Edge Function: employer-confirmation-staging, version 1, status ACTIVE; verify_jwt=true.

The deployed source is an intentionally hard-coded 503 response with error employer_confirmation_not_live; it does not read environment variables, process user-submitted data, or call a database. Source readback from Supabase was inspected.

The production employer confirmation Edge Function was not deployed. Public website remains preview only. Real invitation issuance/outreach and employer intake remain disabled.

An external HTTP smoke test could not be completed from the current container (DNS unavailable). ACTIVE status and source readback must not be mistaken for proof of an actual 503 HTTP response.

Next: verify unauthenticated 401/authorized 503 over a real network path; implement independent anti-abuse gate for rotating invalid tokens; isolated concurrent replay and malformed request HTTP tests; audited release authorization before any live submissions.
