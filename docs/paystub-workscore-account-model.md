# You Paid Pay-Stub WorkScore and Account Model v0.1
Status: design specification only; no credit furnishing, billing changes, or live enrollment.

## Evidence inputs
- Member employment type: hourly, salaried, gig, or variable; role; agreed expected shifts or hours; pay frequency; effective schedule dates; and approved absences.
- Pay stub: pay period start/end, payment date, regular hours, overtime hours, other compensated hours, gross pay, pay codes, issuer, hash, authentication status.
- Member attestations are self-reported and never independently verified until corroborated by authenticated source evidence.

## Calendar-aware calculation
1. Generate expected shifts on actual dates for each local calendar month, rather than assuming four weeks per month or dividing paycheck totals by 30.
2. Exclude non-scheduled days, employer-cancelled shifts and verified approved/protected leave from the eligible required denominator. Do not request sensitive leave reasons.
3. Eligible required hours = sum of required shift hours after legitimate exclusions.
4. Creditable hours = sum of independently documented hours aligned with required shifts, capped at each shift requirement. Overtime cannot erase missed scheduled shifts.
5. Hours coverage % = 100 × credible required hours / eligible required hours, when denominator >0 and evidence suffices.
6. Shift coverage % = 100 × verified attended required shifts / eligible required shifts, only when date-specific verification is available.
7. A recognition requires >=90% coverage, sufficient schedule evidence, trustworthy authenticated source(s), and no material unresolved disputes. Missing data is UNVERIFIED, never a failing score.
8. A pay stub showing aggregate hours but no shift dates supports total paid hours, not specific days attended. Cross-month biweekly stubs cannot be arbitrarily assigned to months.
9. Salaried workers may have no hours on pay stubs; rely on independently confirmed expected shifts and attendance or report insufficient evidence. Gig workers are assessed against accepted committed work, not arbitrary full-time norms.
10. Overtime hours and verified holiday shifts may earn separate bonus badges, not replace attendance or fabricate payment history.
11. Four weekly Yes/No questions prompt date-level exception details but are not themselves four equal scoring units.
12. For verified internal scores: A >=90%, B >=80%, C >=70%, D <70%; below-A is no positive recognition only. No adverse credit furnishing.

## Examples
- 22 required 8-hour shifts = 176 required hours. Documented 160 eligible hours => 90.91% hours coverage, but without daily timecards this does not establish shift coverage.
- Two approved 8-hour absences lower 176 required hours to 160; 152 authenticated eligible hours => 95%.
- 40 regular and 8 overtime hours does not prove attendance at every scheduled shift.
- A payroll period crossing September and October requires dated shift allocations before either month's exact attendance can be verified.

## Internal account number, lifecycle and fees
- Upon signup reserve a random, opaque, unique internal member reference not derived from email, SSN or telephone; keep member UUID separately. Mask display where appropriate.
- Proposed states: RESERVED, IDENTITY_PENDING, CONSENT_PENDING, ENROLLMENT_PENDING, SUBSCRIPTION_PENDING, ACTIVE_INTERNAL, HOLD, CANCELLED; keep detailed readiness checks separate.
- Portal text: Account reference pending activation. Do not claim credit-bureau reporting or a bureau account identifier.
- Proposed enrollment fee waiver: active secured Founder program Builder tier >= $10 cumulative or Cornerstone >= $100 cumulative; $1 Founder alone not eligible. This policy must be approved against final founder terms. Waiver does not silently waive a recurring subscription.
- Any subscription requires agreed price, disclosures, explicit authorization, cancellation logic, webhook reconciliation and refunds handling; none are initiated by this spec.
- Future credit-report account identifier is separate and NULL until legal product design, bureau approval and reporting readiness.
- Attendance is NOT debt payment. Never convert work consistency to an on-time credit payment merely by scoring 90%.
- Do not furnish negative absence, unverified status, below-threshold month, or missed day as adverse credit information.

## Mandatory controls
- Fraud checks, independently validated employer contacts, consent, schedule dispute process, audit trails, file authenticity, protected leave safeguards.
- Before any consumer report furnishing: FCRA and Regulation V counsel review, reporting partner agreement, accurate underlying obligation and accepted data layout. See 12 CFR 1022.41 and 1022.42.
- All calculations and policy changes must be regression-tested with synthetic examples.