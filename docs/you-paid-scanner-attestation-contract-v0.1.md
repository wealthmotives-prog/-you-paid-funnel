# You Paid — Evidence Scanner Attestation Contract v0.1
October 28, 2026. Research-only contract, not malware detection, not deployment.

## Completed
`research/evidence_scan_receipt_lab.py` models a HMAC-authenticated scan verdict bound to a **specific content SHA-256**, scanner ID, unique job ID and expiration time. A valid receipt must state `clean`, be non-expired, match a trusted scanner identity and match the exact object and job. Explicit failures cover forged verdict, modified hash, wrong scanner, wrong job, expired receipt, scanner errors and infected results. `tests/test_evidence_scan_receipt_lab.py` has 11 synthetic tests.

## Critical production differences
- This code NEVER scans documents. A real malware scanner must be deployed and monitored before enabling evidence intake.
- The scanner must independently retrieve the exact quarantined object from a trusted server-side path; clients must never submit their own 'clean' receipt.
- The scanner service secret must be generated securely and stored only server-side with rotation, compartmentalization and strict audit. A shared HMAC secret authenticates a message but does not prove a scan occurred if the signer is compromised.
- Bind any attestation to the entire exact object content, a single-use job and immutable object version, then rehash before release to prevent swap/race.
- Maintain a trusted scanner definition, pattern/signature update process, failure alerts, timeout policy, file bomb protections and false-negative treatment.
- Only release through an authenticated, consent-checked, server-mediated path after human review and an independently verified scan result. Never turn on direct authenticated bucket read/write in the name of speed.
- Actual authenticated dual-member HTTP tests are still outstanding. This is not a real volunteer-ready upload capability.

## Next prerequisites
1. Stand up supported independent malware scanner (infrastructure, secrets, monitoring and policy owner).
2. Provision **two isolated test member accounts** and execute HTTP Storage denial tests.
3. Implement and verify authenticated service-mediated intake with consent, record ownership, quotas, idempotency, bounded signed URLs and safe retention.
4. Perform complete synthetic E2E tests including scanner timeout, infected file, cross-owner, revoked consent, stale scan and mistaken reviewer approval.
5. Independent legal/privacy and security signoff before requesting pilot participant's documents.

The overall pilot release remains **NO-GO**.
