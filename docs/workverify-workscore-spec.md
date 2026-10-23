# You Paid WorkVerify / WorkScore — design specification v0.1
Status: prototype specification only. No automated employer outreach, credit furnishing, or real attendance scoring enabled.

## Core principles
1. Obtain specific informed worker authorization before contacting an employer and explain what will be requested.
2. Employer contacts provided by workers are leads, not proof of organizational authority. Verify the contact independently using official employer domains/directories, verified work identity, callback, and abuse checks; prevent self-attestation.
3. Prefer employer timekeeping/payroll schedules, authenticated records, and authorized attestations. Keep source provenance and immutable event timelines.
4. A work-attendance metric is **not** a loan repayment or on-time credit payment. Never convert it into a credit tradeline/payment history without a legitimate underlying obligation, permitted data model, bureau/partner approval, and compliance counsel review.
5. **Never furnish negative attendance, missed-day, nonresponse, or insufficient-evidence outcomes as adverse credit items**. No credit furnishing is enabled.
6. Store raw coverage, verification confidence, and eligibility separately. Do not call unverified months failures.
7. Do not penalize legally protected leave, approved PTO, rest days, holidays, schedule cancellations, accommodations, or other excused/non-required days. Consider disparate impact and labor-law review before launch.
8. A score under 90 is internal 'not eligible for positive recognition', not delinquent, missed payment, bad debt, or a negative report. Corrections and appeal required.
9. Employer response is not the sole path; independently authenticated timekeeping can substitute and the worker may submit corroboration. No source -> unverified (neutral).

## Employer outreach UX
- Member submits employer and work period and selects authorized contact method; consent is specific, versioned, revocable.
- Verify business and contact through independent channel; throttle requests and dedupe contacts; avoid sending SSN, sensitive documents, entire calendar, or needless personal details.
- Employer receives short-lived one-use URL with organizational authentication; do not disclose detailed data in SMS/email itself.
- Verification questions: (1) employment for dates? (2) scheduled workdays/hours for each week? (3) required shifts attended or approved-excused? (4) any corrections, unknown dates, or exceptions? Each answer asks responder role and attestation of firsthand or official-record basis.
- If 'No/partial' weekly, expand to day-specific shifts with statuses: attended, missed_unexcused, approved_excused, schedule_cancelled, not_scheduled, unknown, disputed. Capture expected time, actual/approved status, reason category only when necessary; no health/disability detail.
- Employer can respond 'I do not know' and forward request to an authorized contact. No-pressure reminders at most 2; expiry -> unverified, not adverse.
- Suppress member-attested contact from high-confidence category until independently confirmed. Cross-check against payroll/timekeeping.
- All actions produce consent/source/observation/audit records.

## Attendance scoring v0.1
Unit: employer-confirmed required shifts, never raw calendar days or 4 weekly yes/no responses.
eligible_required_shifts = scheduled_required_shifts - approved_excused - cancelled_by_employer - excluded_protected_absences.
attended_shifts = verified attended among eligible_required_shifts.
attendance_percent = 100 * attended_shifts / eligible_required_shifts when denominator > 0, data completeness sufficient, and no material unresolved conflicts.
'Positive attendance recognition': percent >= 90, verified coverage >= 90% of required shifts, source confidence meets threshold, no unresolved material disputes. Pending/unknown -> unverified instead of scored.
Grades: A 90-100, B 80-<90, C 70-<80, D <70 (internal coaching only; grades B-D never sent as adverse credit data). All scores explicitly attendance consistency, not payment performance.
Example 20 scheduled required shifts, 2 unexcused missed => 18/20 = 90%, A.
Example 20 scheduled, 3 unexcused missed => 17/20 = 85%, B, no positive recognition and NO negative furnishing.
Example 20 scheduled, 2 approved absences and 1 unexcused: 17/18 = 94.44%, A, if fully verified.
Four weekly Yes/No questions serve as a triage interface, not score denominator. Expand exceptions to exact shifts.

## Evidence confidence & abuse prevention
- Levels: verified direct timekeeping integration; authenticated employer official-record attestation; corroborated employer document; self-submitted evidence pending validation.
- Require role verification, randomized challenges, domain checks, rate limits, duplicate checks, fraud/risk flags, signed event timestamps, immutable source objects, dispute workflows.
- Do not disclose employee performance/disciplinary details or protected leave reasons in outreach.
- Maintain source observed date vs work date vs review decision date. Never manufacture historical pay or work facts.
- Access only necessary information; define retention, encryption, deletion, member corrections.

## Pilot acceptance tests (synthetic-only)
- 4 yes weeks over 20 shifts -> 20/20, A only if authenticated details confirm.
- Weeks 1 and 3 each one missed day (20 shifts) -> 18/20, A exactly 90.
- 3 missed -> 17/20 B; never create adverse data.
- 2 excused, 1 unexcused -> 17/18 A.
- Unsupplied weekly schedules -> unverified, not zero.
- Employer nonresponse -> unverified, no member penalty.
- Spoofed contact -> cannot reach high-confidence verified.
- Disputed or contradictory timecard -> pending.
- Unauthenticated source -> no positive recognition.
- No outgoing email/SMS in pilot until permission and deliverability tests.
- No credit bureau transmission pathways in this pilot.

## Next engineering steps
1. Add provider-neutral employer verification request/contact/challenge/response tables with consent and RLS.
2. Build admin-reviewed employer contact verification; outbound invites only after controlled testing.
3. Implement schedule-shift canonical model with statuses and exclusion rules.
4. Add score engine + deterministic fixtures, and member-facing correction/dispute controls.
5. Keep furnishing entirely separate and disabled; obtain specialized FCRA/Reg V, CRA product and labor/privacy reviews before any external reporting.
