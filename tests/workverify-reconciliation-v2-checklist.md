# WorkVerify Reconciliation v2 — release validation checklist
Status: Database functions deployed October 23, 2026. No public pay-period intake enabled yet.

## Implemented protections
- yp_validate_day_allocation serializes claims using a row lock on the parent pay-period row and rejects allocations beyond totals by regular, overtime, and leave categories.
- work_pay_period_reconciliation returns provisional_monthly_allocation_available and verified_monthly_allocation_available=false.
- work_pay_period_monthly_breakdown exposes provisional monthly splits only when all aggregate category totals reconcile. For other conditions, returns empty breakdown with insufficient_date_evidence.
- No automated credit-reporting output.

## Required authenticated synthetic integration tests (NOT YET EXECUTED)
1. Insert a fictional member-owned employment record and pay period 2026-09-28 through 2026-10-11 with 80 regular hours.
2. Query reconciliation before adding days: aggregate_only_unallocated; monthly split absent.
3. Insert ten 8-hour daily allocations covering period; verify category totals reconcile; breakdown has September/October separately according to actual inserted dates; verified_attendance=false.
4. Attempt an additional allocation exceeding period hours: rejected.
5. Attempt date outside period, wrong user, and duplicate date: rejected.
6. Concurrency: two workers claim final permitted hours at once; exactly one should succeed when combined totals would exceed 80.
7. Leave and overtime mismatch: reconciliation incomplete and monthly split absent.
8. Anonymous API read denied; authenticated user B cannot view user A's data or request their breakdown.
9. Confirm no furnished/verified status is created by self-declared data.
10. Roll back synthetic fixtures and inspect audit logs.

## Known limitations
- Reconciled self-declared dates are not verified attendance.
- No pay-stub parsing, source authentication, employer response, protected leave adjudication, or correction workflow enabled.
- Monthly split does not determine actual on-time payment. External furnishing disabled.
- No signed-in browser test for these new functions performed yet.

## Launch gate
Keep pay-period intake out of the public member portal until staging tests and file inspection controls pass. Preserve privacy/correction channels and do not collect sensitive document contents in unverified channels.
