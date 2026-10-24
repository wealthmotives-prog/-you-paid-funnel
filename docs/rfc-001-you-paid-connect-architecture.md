# RFC 001 — You Paid Connect Architecture
Status: PROPOSED / NOT DEPLOYED
Date: 2026-10-23
Owner concept: consumer-directed, evidence-aware employment data connectivity.

## Product boundaries
- You Paid Identity: member registration, session security, identity assurance and access permissions.
- WorkVerify: factual claims and attributed provenance; separate self-declared, company identified, respondent authenticated, fact corroborated, disputed.
- WorkScore: contextualized internal interpretation; never convert hours worked into debt/payment transactions.
- Connect: purpose-limited, recipient-specific data exchange; not synonymous with FCRA authorization or bureau furnishing.
- External furnishing: separate legal, contractual, technical and governance program.

## Suggested canonical objects
EmploymentClaim {id, member_id, employer_id, period_start, period_end, asserted_at, status}
EvidenceAssertion {id, claim_id, source_type, source_observed_at, received_at, issuer_id, evidence_hash, verified_scope, confidence_basis, verification_at, supersedes_id}
ConsentGrant {id, member_id, recipient_id, purpose, allowed_claim_types, issued_at, expires_at, revoked_at, notice_version, audit_reference}
VerifiedFact {id, claim_id, value, source_assertions[], review_status, established_at, decision_method, corrections[]}
AccessReceipt {id, consent_id, recipient_id, resource_id, accessed_at, fields_shared, request_reason, outcome}
CorrectionCase {id, member_id, target_id, reason, opened_at, resolution_at, disposition, audit_history}
Never use numeric 'confidence scores' as legal verification conclusions.

## Security model
- TLS transport; private encrypted stores; application-level AEAD for selected high-sensitivity fields; managed keys and audit trails.
- Use established libraries and managed key infrastructure; never invent custom crypto.
- Recipient-bound scopes, short-lived authorization codes, server-side token exchange, rotating refresh mechanisms when needed.
- Check live grant and legal permissible purpose at every access. Revoke future access on request; disclose downstream retention limits.
- Authenticate employers through pragmatic, graduated evidence. Corporate email/domain match is only a preliminary signal.
- No full Social Security number or government ID required by default for ordinary employment verification.
- Keep production service keys off clients and logs; segregate quarantine/scanner/verification/Connect runtime identities.

## Threat model: adversarial cases
1. Self-reported data promoted to 'verified': enforce source attestation and immutable audit trail.
2. Lookalike employer domain: independently cross-check official company source.
3. Stolen employer email: response alone should not prove every payroll fact.
4. Replayed employer invitation: expiring single-use token, hashed at rest, attempt rate limits.
5. Compromised Connect client: client credentials + per-member per-purpose grant + minimal claims.
6. Revoked consent: deny future data access and record revocation, do not falsely promise remote erasure.
7. Duplicate/conflicting payroll claims: versioned corrections with traceable source and reconciled periods.
8. Stale scanner verdict: lease ownership, expiry and valid transition tests.
9. Overbroad commercial reporting: separate CRA/permissible-purpose readiness gate and counsel review.
10. Data breach: incident response, rapid credential revocation, affected-data inventory and notices.
11. Large partner outages: idempotency, retries, circuit breakers, bounded queues and recovery drills.
12. Insider misuse: least privilege, dual review for sensitive exports, immutable access logs.

## Security protocol sketch (future; no live endpoint)
POST /v1/connect/authorizations -> recipient, purpose, scope, expiry, user consent
POST /v1/connect/token -> exchange single-use auth code from trusted backend
GET /v1/employment/facts -> filtered authorized claims, provenance and status
POST /v1/connect/revoke -> revoke future access
GET /v1/connect/access-log -> user-facing access receipts
All endpoints must reject absent/expired/revoked consent, wrong audience, insufficient scope and unapproved purposes.

## Six build milestones
M1: Contract and threat model, data inventory, consent schema proposal (current).
M2: Internal mock recipient + synthetic consent grants, revocation and access-log tests.
M3: Employer single-use invitation and response, provenance and correction flow.
M4: Secure scanner and document intake completion, malware and concurrency validation.
M5: VerifiedFact assembly with explainable member review and corrections.
M6: Partner sandbox, security audit, legal readiness and only then third-party production access.

## Commercialization hypotheses — unvalidated
- Consumer-facing access: clear base membership value independent of scoring outcomes.
- B2B fact-verification request fee, not a fee for higher verification status.
- Enterprise API usage with permitted purpose, contractual limits, oversight and auditability.
- Bureau furnishing requires separate readiness and access agreement, not simply connecting a REST endpoint.

## No-go gates
No live bureau furnishing, external eligibility report sales, E2EE marketing claims, external partner access or production token issuance until implemented/tested and relevant legal/contractual reviews pass.

## Research notes (checked Oct 23, 2026)
- Plaid Link: https://plaid.com/docs/api/link/
- Finch employer connectivity: https://www.tryfinch.com/for-employers
- NIST identity guidelines: https://csrc.nist.gov/pubs/sp/800/63/4/final
- FTC FCRA employment screening: https://www.ftc.gov/business-guidance/resources/what-employment-background-screening-companies-need-know-about-fair-credit-reporting-act
- CFPB personal financial data rights: https://www.consumerfinance.gov/compliance/compliance-resources/other-applicable-requirements/personal-financial-data-rights/
