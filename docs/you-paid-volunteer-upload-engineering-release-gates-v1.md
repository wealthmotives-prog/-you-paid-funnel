# You Paid — Volunteer Upload Release Gate, consolidated engineering handoff
Date: October 28, 2026. Pilot uploads are NOT open.

## Verified connected infrastructure
Private work-evidence storage bucket; allowed PDF/PNG/JPEG and 10 MiB limit. Restrictive authenticated INSERT and SELECT storage policies were applied and confirmed. Existing service-role preflight function detects file signature/hash and returns quarantine only; it is NOT antivirus scanning. Staged employer response handler is disabled. Consent/grant semantics and review approvals must be authenticated on the server before release; web UI switches are not authorization.

## Completed this checkpoint
- Inspect actual evidence_artifacts / evidence_inspection_jobs database fields and deployed edge function inventory.
- Added `research/pilot_evidence_authorization_lab.py`: default-deny model for identity, owner, narrow purpose, explicit consent version/state, independent scan clearance and human approval. The model *cannot* authorize upload or create signed URLs.
- Added `tests/test_pilot_evidence_authorization_lab.py`: thirteen fictional cases, including cross-user access, withdrawn consent, quarantined/revoked artifact, wrong purpose, and scanner-not-reviewed.
- Wired those tests to offline GitHub workflow. **No test result claimed until Actions verification.**

## Remaining release blockers in execution order
1. **Synthetic authenticated HTTP verification:** two isolated Auth test accounts/JWTs; run tested negative requests against storage READ/INSERT restrictions; preserve credentials outside GitHub and chat. DO NOT use volunteer credentials.
2. **Consent service:** signed, scope-limited permission for one specific pilot workflow; server-side version, time, source and withdrawal; transactional ownership validation; RLS and cross-account tests.
3. **Service-mediated secure intake:** authenticated server endpoint validates consent, member/session, quotas, filename/path, size, allowed types, digest and object binding. Direct member storage policies remain restrictive; never expose service-role key.
4. **Independent malware scanner:** deployed and monitored scanner, bounded resource usage, versioned signature/database, evidence hash attestation; scan failures, timeouts, zip bombs, and crashes fail closed. Preflight is not a scan.
5. **Quarantine/release transactions:** atomic state machine with approved reviewer, independent scan attestation bound to exact object; no client-controlled 'clean' result; durable audit and race/revocation tests.
6. **Approved access:** generate limited-lived read authorization only after fresh identity, consent, status and object ownership check; exercise expired/revoked access tests.
7. **Operations and privacy:** privacy notice, retention schedule, redaction, breach response, test files/logging, least-privilege operators, counsel review of payroll/employer use; disable real-person testing if these are unfinished.
8. **End-to-end signed-off test:** validate member A/member B, anonymous, scanner worker, revoked consent, duplicate uploads, disputed records, operator approvals and document deletion with synthetic files and no data leaks.

## Real volunteer instructions
Do not request or transmit paystubs, SSNs, IDs, employer contact details or bank account permissions yet. Bank connection is not required for first evidence verification. First pilot invitation will specify exactly what to provide, where, for how long, and how to withdraw.

## Status definition
- **Ready for synthetic testing** = code review + isolated test accounts & signed-off tests.
- **Ready for volunteer documents** = every above blocker passed, secure intake enabled deliberately by authorized operator, and participant has explicit informed opt-in.
- **Ready for credit furnishing** = completely separate regulated/product/bureau acceptance requirements, not implied by the pilot.
