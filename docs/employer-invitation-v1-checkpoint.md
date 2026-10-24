# WorkVerify Employer Invitation v1 — Backend Checkpoint
Status: Database primitives installed; no public invitation endpoint, delivery or employer page enabled.

## Implemented
- Private invitation token table contains SHA-256 token hash only; expiry, consumption and revocation timestamps.
- Only service role may issue a token, after member consent and contact_check='independently_confirmed'; default 72h, 1–168h permitted.
- Only service role may submit employer answers using token consumption RPC. Inputs are employment/dates/schedule (yes/no/unknown) and respondent role. Successful consumption is single-use and atomic through row lock.
- Employer responses remain unreviewed. RPC explicitly returns employment_verified=false.
- Tokens are secrets; never put in logs, analytics, URLs passed to third parties, screenshots or client instrumentation.
- No messages automatically sent.

## Next build gates
1. Server endpoint with token-exchange and abuse/rate controls; never ship service-role key to browser.
2. Limited response UI with single-use token handling and no query-string leak to analytics/referrers.
3. Protected delivery verified through provider configuration and separate owner approval.
4. A clear employee identifier minimized to the facts needed, and consent/revocation checks at issuance and submission.
5. Operator evidence review; provenance ledger; member correction route and retention/deletion policy.
6. Synthetic integration tests: expiration, replay, revoked token, mismatched employer, concurrency, invalid fields and response log, and cross-account access.
7. Review disclosure and potential FCRA/employment-screening implications before external decision use.

## Security caveat
Current backend consumer RPC accepts a valid bearer token through a service-role invocation and is not a public endpoint. Add request throttling and abuse protections before exposing it to external respondents. Domain email alone is only a candidate authentication signal.
