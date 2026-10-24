# WorkVerify History — 24-Month Member Declaration (checkpoint)
Status: database implemented and rollback-only smoke tested; member UI not yet connected; no bureau furnishing.

## Purpose
Capture authentic periods of past employment separately from evidence verification, any actual You Paid account opening, and any future lawful reporting activity. Never reclassify attendance as financial repayment.

## Schema: public.work_history_period_claims
- Ownership references auth.users and the member's actual employment_records row.
- period_start, period_end; range limited to at most 744 days, ending no later than the current day.
- normal_hours_per_week optional, <=100.
- source_kind always member_declaration; evidence_status always self_declared_unverified.
- declared_at records actual declaration timestamp.
- verified_at, furnished_at and account_opened_at must remain NULL. Those are deliberately not member-assignable.
- RLS permits authenticated members to read/insert only their own employment periods. UPDATE and DELETE not granted to members.
- FK ownership trigger guards even privileged insert paths.

## Synthetic smoke test (2026-10-23)
Transaction-scoped fictional employer (Nov 2024–Oct 2026) and 40 hour/week claim inserted; confirmed unverified status and NULL verified/furnishing dates. Attempted fabricated verified_at and future periods both rejected. Transaction rolled back. No synthetic records persisted.

## Next
- Member-facing one-time period intake with eligibility, useful clear language and appropriate corrections mechanism.
- Employer range confirmation as narrow historical fact, not 24 fictional payments.
- Separate immutable evidence assertion ledger with provenance and date-aware support statuses.
- Operator review and member dispute/redress workflow; never silently overwrite original claims.
- Legal and CRA partner review BEFORE developing any credit-furnishing field mapping.
