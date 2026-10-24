# You Paid — OG Pilot 001: controlled external validation protocol
Status: planning and synthetic/low-sensitivity testing only. Owner approval needed before inviting any real person to a document-handling pilot.

## Six gates
1. **Test reliability** — run and document current scanner unit tests in CI, fix failures, and validate the pay-period backend against rollback-only synthetic fixtures. No claims of completion until logs show green.
2. **Data boundaries** — map purpose, consent, minimum required fields, storage locations, retention/deletion windows, member correction channels, staff access and incident response. Conduct a privacy/security review. TLS transport and encryption at rest are minimum baseline checks; E2EE is not inherently necessary for a service that must scan/verify documents, but the design must protect them through processing.
3. **Secure evidence pipeline** — isolated updated ClamAV runtime, private quarantine, no public URLs, bounded file sizes/types, true signature and file-hash verification, leases/recovery, operator review and integration tests before enabling production upload.
4. **Member pilot** — opt-in from adult participant with specific test scope. Member may try existing login, employment and schedule forms. Do not ask for SSN, government-ID images, bank details, full pay stubs or medical/other sensitive records through chat, email, or currently disabled upload flows.
5. **Employer authenticity** — obtain separate express consent for contacting employer; independently verify employer contact through official source; send limited, non-sensitive verification request; obtain employer consent to reply; do not assume employer response or partnership. Confirm only the minimum facts needed (dates, period/attendance via approved channel) without earnings/bank details unless essential.
6. **Evidence-to-WorkScore dry run** — record provenance and exceptions, reconcile calendars/pay periods, let member review/correct, create explainable internal outcome. No score-benefit promises, furnishing or negative-credit record creation. Define success criteria and stop/go review.

## Pilot invitation requirements
- The tester participates voluntarily and may stop, request correction/deletion subject to lawful retention, or decline employer contact without losing ability to test the general portal.
- No uploading sensitive documents until the separate secure intake is operational, tested and disclosed.
- Disclose beta/prelaunch stage and that no employer integration, bureau-reporting or score change is promised.
- Use synthetic pay stubs and fictitious IDs as test *fixtures*, never impersonate a real person or employer.
- Authorized personnel must never access unnecessary ID numbers, SSNs, account numbers, direct-deposit details, health information or other unrelated content.

## First pilot readiness checks
- User can create/sign in and see their own account reference.
- User can submit employment history with accurate month precision; labels self-declared.
- User can submit expected work schedule and workdays; labels self-declared.
- Operator can review permitted metadata only, with audit logs and no cross-member leaks.
- User can find privacy/data-request pathway.
- No evidence verification is represented as live; no credit furnishing implied.
- Do not solicit official documents until gate 3 passes.

## Validation metrics
Form completion, errors, support requests, incorrect assumptions, consent comprehension, employer-response willingness (not assumed), response latency, traceable corrections, privacy incidents. Record aggregate metrics, not unneeded personal details.

## Decision
The first OG tester can start on currently safe, self-declared flows, provided ordinary privacy disclosures are available. Full ID/paystub uploads are **NO-GO** until secure evidence processing and independent safety tests pass.
