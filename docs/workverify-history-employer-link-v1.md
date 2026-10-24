# WorkVerify Historical Confirmation Link — v1
Status: relational groundwork installed; no employer submission or approval workflow activated.

A historical member declaration may be associated with an employer verification request only when both concern the same user and same employment record. The stated period must sit within the member's declared historical range. This link is not a verification result.

## Database
public.work_history_employer_correspondence:
- Historical claim and employer request FKs; unique pair prevents duplicate link.
- Period boundaries constrained within claim dates using insertion guard.
- Default response_scope=not_received, evidence_channel=not_received, review_status=not_reviewed.
- Authenticated members may only read matching own correspondence via RLS; they cannot create or edit it; anonymous users cannot view.
- No automated propagation into employment verification, WorkScore or CRA reporting.

## Next steps
- Authorized operator linking RPC with explicit approval and audit event.
- Return channel that can safely record actual, source-attributed employer response.
- Distinguish employer confirmation of tenure from attendance/payroll support for month-by-month factual claims.
- Synthetic cross-member, cross-employer, out-of-range and duplicate tests.
- Member-visible historical verification coverage only when source review supports it.

## Deployment
Historical declaration member portal previously deployed at commit 8ce0aec8 and confirmed READY. This document does not claim full browser end-to-end test.
