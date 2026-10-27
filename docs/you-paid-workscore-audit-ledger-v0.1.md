# You Paid WorkScore — Audit Ledger Design v0.1
**October 27, 2026 | schema concept only | no production migration**

## Purpose
Make every internal grade reproducible, contestable and auditable without converting a work grade into a credit-payment record. Store evidence links and algorithm version independently from actual credit-account obligations.

## Proposed tables (not created)
**workscore_policy_versions**: `policy_version` (PK); effective_at; disabled_at; weights_json; rounding_rule; confidence_rule; grade_thresholds_json; signed_commit_sha; review_authority; approval_status. Versions immutable after approval, superseded rather than edited.

**workscore_windows**: `window_id` (PK); member_id (FK); period_start; period_end; obligation_source_id; agreed_expected_units; excused_units; verified_completed_units; consent_scope_id; record_state (draft / ready / contested / rescinded / not_gradable). Never fabricate obligations for historic periods.

**workscore_evidence_links**: `link_id` (PK); window_id (FK); evidence_record_id; source_type; source_verification_state; content_digest; original_observation_at; independently_checked_at; access_scope; revoked_at; reviewer_id. Avoid copying sensitive raw documents into grade tables.

**workscore_grade_runs**: `run_id` (PK); window_id; policy_version; prior_run_id (nullable); scored_at; component_inputs_json; eligible_units; grade; numeric_grade; confidence; outcome_code; exact_calculation_hash; calculated_by; reason_codes; manual_review_status. Append-only; no overwriting corrected historical results.

**workscore_grade_events**: `event_id` (PK); run_id; event_at; actor_ref; event_type (created / contested / evidence_corrected / reviewed / superseded); linked_evidence_id; explanation; audit_event_digest. Purpose-limited security access and retention required.

## Fundamental constraints
- Enforce least-privilege RLS and safe administrative roles; no raw document in logs.
- Hash and version both policy and evidence inputs to permit deterministic replay and dispute investigation.
- Unique logical run key should include window, policy version and evidence snapshot digest; retries idempotent.
- No score run can write to any tradeline, Metro 2, payment history, balance, or charge-off table.
- Service does not create a new debt or noncash-payment discharge; these require independently valid contracts and servicing events.
- For members, source confidence and unverified status must remain transparent.
- Manual review must handle disputed evidence, protected leave, employer spoofing and duplicate documents.
- Correct inaccurate data by generating a superseding grade record; do not quietly mutate original.
- Withdrawn consent restricts future processing as applicable; legal retention needs review.
- Invalid/partial evidence returns no grade and requires attention rather than being scored zero.
- WorkScore grades do not imply qualification for a credit product, employment, housing or insurance.

## Release sequence
1. Run cross-language parity tests in CI; no public grades if browser and Python disagree.
2. Submit schema and access model for review before Supabase migrations.
3. Add a synthetic-only deterministic fixture writer with replay/append-only tests.
4. Obtain consumer privacy, labor, fairness and lending/legal review.
5. Enable only after live authorization, monitoring, correction workflow, and verified independence from credit-furnishing pipeline.

**Status:** design document. No tables or migrations run, and no member data processed.
