# You Paid — Volunteer Pilot 001 Readiness Protocol
Date: October 28, 2026
Status: PREPARATION ONLY. No permission to collect live sensitive information, initiate an employer request, or connect a bank account.

## Goal
A willing prospective member can validate the truthful WorkScore workflow from declaration -> consent -> employer corroboration -> evidence reconciliation -> internal grade -> contest/correction, before any consumer reporting. The volunteer is never promised a tradeline, credit-score increase, bank access, or approval. A pilot of an internal score is not proof of reportable credit-account payment activity.

## Phase 0 — Recruit without data capture (NOW)
- Explain prototype scope, material risks, privacy rights and optional participation.
- Record only an anonymous pilot ID (e.g., VOL-001) in planning notes; do not place name, DOB, address, employer, SSN, bank credentials, or paystubs in GitHub, ChatGPT chat, email threads or source code.
- Obtain preliminary interest without requesting documents. Any person can decline without penalty or reduced founder standing.
- Ask participant to identify categories they *would be comfortable authorizing*, not specific sensitive values.

## Phase 1 — Privacy and security gate (NOT COMPLETE)
Before requesting any real uploads or connections:
- Have counsel review consent, privacy notice, data minimization, retention/deletion, participant's rights and applicable financial/consumer-reporting rules.
- Complete threat model, restricted service-role access, operator RLS, audit logging, secure object storage with controlled access, malware screening for documents, breach response, secure identity verification and authorized deletion workflow.
- Perform signed-in end-to-end penetration/abuse QA and malware scanning; remove open or unused intake endpoints.
- Distinguish self-declared data, independently verified payroll/employment, and a genuine credit obligation. Prevent scoring data from being exported as a synthetic payment.
- Approve the participant-facing consent language and disclose if any vendors will receive data.
- A privacy/consent screen must record consent scope, time, version and revocation; it cannot be an undifferentiated blanket permission.
- Securely test with synthetic data first and obtain sign-off from responsible operator/security owner.

## Phase 2 — Separate explicit optional consents
A. Basic work-history declaration: names/dates only to extent needed for agreed testing, clearly labeled self-declared.
B. Paystub uploads: only to secured verified intake after scanning, with least-data extraction and selective redaction for SSN, bank routing, home address, etc., where compatible with verification.
C. Employer contact: member must review exact employer contact and the exact requested facts; no outreach until express, revocable consent and employer identity validation. Employer's cooperation is voluntary; HR/payroll channels should be used appropriately.
D. Bank account verification: NOT REQUIRED for the first pilot of WorkScore. If later needed, use a properly configured authorized financial-data integration and permissions, not banking passwords or screenshots in chat. Define data fields, read-only scopes, revocation and third-party terms before any connection.
E. Research publication and testimonials: separate opt-in; default no sharing identifiable material or quotes.

## Phase 3 — Limited live workflow only after readiness approval
1. Volunteer signs in via production-approved authenticated flow.
2. Volunteer consents to a defined purpose and enters limited work history.
3. Secure document intake reviews sanitized records (only after scanner and operator access tested).
4. Authorized employer verification asks limited tenure or work-period questions (only after employer service, anti-abuse gates, and member consent are tested).
5. Human reviewer adjudicates discrepancies, leave/exception treatment and evidence quality; both original and corrected record remain auditable.
6. WorkScore policy run is versioned and reproduced from fixed evidence; results clearly labeled internal experimental.
7. Volunteer can see provenance and dispute an error; reviewer records response.
8. Retire or archive trial information per published retention policy and applicable duties.

## Go / no-go checklist
- [ ] Signed pilot brief explaining scope and what is *not* live
- [ ] Counsel review of privacy, financial, labor and employment permissions
- [ ] Security threat model and privacy-impact assessment
- [ ] Real authenticated intake with restricted file storage and document malware scan
- [ ] Employer communications gated by verified employee consent and approved trusted contacts
- [ ] Bank connection explicitly not needed for initial pilot
- [ ] Incident response, access logging, revocation and deletion mechanism QA
- [ ] Test every workflow with synthetic records before first personal record
- [ ] A named security/privacy operator signs off
- [ ] Pilot participant has an opt-out and data-question contact
- [ ] No bureau reporting, score promise or false on-time payment claim

## Pilot success criteria
- Volunteer understands current vs future features correctly.
- Source can be traced and distinctions between declaration/verification remain correct.
- All scores are reproducible, with explicit confidence and leave/dispute exception handling.
- No sensitive data leaves approved systems and all consent/revocation tests pass.
- Employer contact (if reached) respects scope; unresponsive employer does not produce invented confirmation.
- Evaluate operational cost/time and participant comprehension; do not use a single willing participant as scientific predictive validation.

## Immediate founder message
"Thank you for volunteering to help shape You Paid. We're preparing a limited pilot. Please don't send any bank credentials, paystubs, IDs, account numbers, or employer contact details yet. Once our secure intake and consent procedures have passed testing, we'll provide instructions for anything we'd like you to share. Participating won't guarantee bureau reporting, a credit account or credit-score changes. You may opt out."

## Operational reality
As previously verified on October 24: evidence intake disabled; scanner worker not deployed; employer confirmation endpoint staged but real intake disabled; authenticated E2E and HTTP concurrency tests incomplete. Current work is a pilot blueprint, NOT an invitation to upload sensitive records now.
