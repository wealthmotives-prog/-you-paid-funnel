# You Paid — Evidence-to-Performance Research Specification v0.1
**Date:** 2026-10-26  
**Status:** Design hypothesis only; not deployed, legally approved, empirically calibrated, or accepted for consumer reporting.

## Strategic objective
Develop a defensible, independently auditable grading system that estimates fulfillment of clearly disclosed, consented-to obligations within the You Paid ecosystem, based on available evidence and its provenance. This internal grade is **not** an amount tendered, a loan payment, a bureau payment history code, or proof of a legally reportable credit relationship. The longer-term business objective remains real, accurately furnished consumer credit accounts subject to bureau onboarding, law, and appropriate compliance counsel.

## Two different ledgers, linked but never confused
**Performance evidence ledger:** employment declarations, employer-confirmed periods, pay-period data, attendance attestations, source attribution, consent scope, source inspection, discrepancies, revisions, and human adjudication. Past actual employment dates may be recorded as factual historical dates; verification date is the real review date.

**Financial account obligation ledger (future, separate):** executed terms, lawful creditor and obligor, origination/open date, consideration, amount and timing of each actual contractual obligation, actual discharge/payment/satisfaction evidence, billing due dates if applicable, balance changes, adjustments, delinquency events if applicable, disputes and reversals. Do not populate bureau payment statuses directly from WorkScore.

## Evidence quality and grading proposal (research-only)
For each **defined 28-day evaluation window**, collect five dimensions; assign each component 0–100 if supported, or mark as unavailable (not automatically zero):

| Component | Proposed weight | What it measures | Guardrail |
| --- | ---: | --- | --- |
| Independent evidence / provenance | 30% | Trusted employer confirmation, independently sourced payroll artifacts, reviewer-verified records, source consistency | Self-report alone cannot earn independent-verification points |
| Obligation and schedule definition | 20% | Clearly documented agreed performance expectation and dates, disclosed before the applicable work period | Do not invent retroactive agreements or impose unconsented metrics |
| Verified fulfillment | 30% | Confirmed fulfillment of eligible agreed performance units versus units legitimately due | Authorized leave, protected absences, accommodation and holidays excluded or handled neutrally, never penalized automatically |
| Record integrity | 10% | Internally consistent chronology, reconciliation, corrections, versioning, and defensible provenance | A good-faith dispute or correction request must not lower a grade |
| Verification freshness and coverage | 10% | Timeliness and proportion of the window supported by current credible proof | Old evidence can remain factually true; freshness affects confidence rather than erasing history |

**Illustrative formula:** `raw_grade = .30*provenance + .20*obligation_definition + .30*fulfillment + .10*integrity + .10*freshness`. Apply weights only to **eligible, observed** components and report missing coverage separately; incomplete evidence must never silently become either a perfect score or proof of default.

**Grade bands for testing only:** A 90–100, B 80–89, C 70–79, D 60–69, E below 60. Do **not** present thresholds as validated, predictive of credit outcomes, or publicly certified. Consider abandoning letters if they imply an unsupported financial-risk meaning.

**Separate confidence measure:** high requires independent corroboration of identity, expectation, and fulfillment within the relevant window; medium means partial corroboration; low means principally self-declared; insufficient means no responsibly gradable period. A `raw_grade` of 95 with low confidence is *not equivalent* to a 95 with high confidence. A grade without a disclosed evidence confidence level must not be published.

## Reconciliation and fairness
- Define denominator as *eligible, agreed, documented performance units due*, never default 40 hours/week or a fixed four-week month for all workers.
- Support hourly, salaried, temporary, gig, seasonal, part-time, variable-schedule and multiple-employer cases explicitly; avoid treating hours worked as an intrinsic credit payment.
- Exclude or neutralize protected leave, accommodation, caregiving, religious leave where legally protected, employer closures, holidays and other legitimate nonworking time; obtain specialist legal/fairness review.
- When denominator is zero, mark `not_gradable` rather than 100 or 0.
- Identify duplicate documents, collusion, employer identity spoofing and contradictory sources; contested evidence goes to manual review.
- Preserve appeal and data correction pathways; model transformations versioned, rerunnable and contestable.
- Record scores as historical snapshots with algorithm version and source hashes, not immutable judgments.

## Preliminary research cases
Competitor research to verify from primary sources: Meetava (identity/product spelling unconfirmed), Super+ (product identity unconfirmed), Chime, Kikoff, Self, CreditStrong, Grow Credit, StellarFi, Ava, Extra, Step, Fizz, Current, Kovo, Boom, Piñata, Possible Finance, Credit Sesame, Cushion and others as applicable. Do **not** speculate about competitors' proprietary formulas. Capture exact legal agreement, real account type, price, bank/creditor/furnisher, performance/payment trigger, reporting agency claims, and relevant exceptions. Some are rent-reporting or financial-health tools rather than credit-building obligations; label separately.

## Non-negotiable boundary tests
1. An uploaded pay stub may support that wages/hours were reported; it is not by itself a member's installment payment on a You Paid credit account.
2. A voluntary internal 'performance unit' may be defined in You Paid terms but must never masquerade as cash, a receivable, repayment, or legally extinguished debt absent the actual contractual and accounting facts.
3. A financial account must record adverse or late events when applicable under applicable furnishing policy; no selective positive-only suppression.
4. Human skills, labor potential and experience are not automatically corporate-owned assets recognized on a balance sheet. Evaluate any applicable accounting treatment with accountants before using human-capital theory to justify a booked receivable.
5. WorkScore cannot generate a backdated tradeline or predate an account's genuine opening.
6. No network calls, uploads, employer messages, bureau submissions, charges or account status changes from this specification.

## Implementation milestones
**Milestone A — research and definitions:** compare 10–20 peers using official terms, agreement and bureau policy, map precise economic substance; commission legal memo on permissible consideration and credit structure.  
**Milestone B — schema and replay:** design `scoring_policy_versions`, `performance_window_obligations`, `verified_evidence_links`, `performance_grade_runs`, `grade_revisions` as isolated prototype tables. Do not modify deployed credit/founder/member statuses.  
**Milestone C — synthetic lab:** generate fully fictional scenarios for perfect attendance, documented holiday, approved leave, part-time variable schedules, self-report only, conflicting employers, rescinded consent, dispute/correction, zero expected hours and potentially manipulated documents. Show reproducible inputs/outputs and adjudication trails.  
**Milestone D — review:** benchmark fairness, source-error sensitivity, gaming susceptibility, data retention and privacy; secure counsel's review of proposed financial-account obligations *before* any bureau-format mapping.

## Open research questions
- Can an enforceable product use bona fide noncash performance as contractual consideration? If so, precisely what is owed, by whom and to whom, and what makes it a credit obligation rather than a membership performance metric?
- Which duties are legally enforceable, fairly administered, and concretely verifiable, particularly for workers with protected absences or fluctuating schedules?
- Which actual reportable credit product (if any) is commercially viable, with legitimate payment/discharge events, accurate full-file furnishing and accepted bureau category?
- Who is creditor/furnisher of record, what licenses/partners are necessary, and how are disputes, corrections, delinquency and closure handled?
