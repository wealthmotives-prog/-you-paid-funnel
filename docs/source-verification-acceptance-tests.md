# You Paid Source Verification — Integration Acceptance Tests

Status: design-time acceptance matrix. These are required tests, not claims that an external vendor integration is live.

## Test prerequisites
- Sandbox identity provider; sandbox payroll provider; separate member A/B accounts.
- Server-side connector owns all provider credentials and signature verification.
- No raw SSN, ID scan, full payroll payload or OAuth refresh token in the public repository, frontend, or logs.
- Unique provider event identifier hashed with a stable domain-separated encoding; distinguish retries from new observations.

## Identity proofing
1. Correct member/ID yields provider-side success and a separate, operator-auditable identity session.
2. Name/date-of-birth conflict yields manual review, never silent success.
3. Selfie/liveness failure cannot mark verified.
4. Cancelled, expired, or replayed IDV sessions cannot be resurrected by browser input.
5. Provider outage fails closed; redacted customer-facing message.

## Employment authorization
6. Initiation does not equal consent: connection stays initiated/pending until provider confirms it.
7. Consumer consent must include scopes, purpose, source, timestamp, and expiry/renewal where required.
8. Wrong member, wrong employment record or wrong provider must be rejected before source receipt.
9. Revocation prevents further fetch and transmission; retention/deletion follows law and contractual terms.
10. A bank income credit is not automatically a verified workday, clock-in, or tenure event.

## Receipt integrity
11. New observations enter `pending` and cannot be user-asserted as authenticated.
12. A connected source must be active, with the provider and member matching the receipt.
13. Immutable event dates, hashes and provider references cannot be rewritten in place.
14. Duplicated observations are idempotent, preserving original ingestion lineage.
15. Webhook signature failure, expired tolerance, and wrong signing secret fail closed.
16. Server-side fetch confirms source status rather than trusting browser claims.
17. Provider corrections create linked new facts; preserve prior evidence and reasons.
18. Historical event date and later verification date remain distinct.
19. Evidence review never implies bureau reporting or partner eligibility.

## Document ingestion
20. PDF/PNG/JPEG header checks, content-type, size, and malware scanner must all pass.
21. Encrypted private storage; no shared/member-foreign access.
22. Uploaded object and evidence metadata must reconcile; orphan cleanup is logged and reversible where feasible.
23. Test oversize, zero-length, malformed/polyglot documents and attempted decompression bombs.
24. No client-controlled evidence level or verified status.

## Release criteria
- Automated tests run using two independent test members and seeded sandbox observations.
- Operator reviews false positives, conflicting employers, ambiguous pay periods and duplicate income records.
- Security and privacy/compliance review of retention, vendor agreements, ID biometrics, redisclosure and access logging.
- Public UI connection controls remain disabled until contractual and technical gates pass.

## Required vendor questions
- Can we persist normalized derived verification features and original historical dates for a member-authorized ledger?
- Is downstream lender/landlord/API redistribution allowed, and under what separate purpose/contract?
- Are timecards/workdays available, or only payroll pay periods and income?
- Is a standalone non-credit purpose allowed?
- What is coverage, lookback, pricing per link, per refresh and minimum commitment?
- How do consent, deletion, correction, and revocation operate?
