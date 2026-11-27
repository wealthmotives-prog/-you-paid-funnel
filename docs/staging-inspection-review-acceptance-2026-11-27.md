# Staging inspection + operator review acceptance — 2026-11-27

Environment: staging `rzeodkcvljukaaczeibe` only. Production untouched. Fictional PDFs and server-marked
synthetic test accounts only. Branch `staging/inspection-review-v0` (reviewed code `993e5c6`, hardening `3e4ede3`).

## Overall: PASS — 40 / 40 checks

## Deployed (staging)
| Function | Version | Bundle (ezbr) |
|---|---|---|
| staging-pilot-consent | v7 | cbbc6ca1… |
| staging-evidence-upload | v7 | 93b23b69… |
| staging-inspection-processor | v1 | 9672f7b8… |
| staging-operator-review | v1 | 7ca6f917… |

All `verify_jwt=true`. Source deployed from the 993e5c6 tree (pre-deploy source hashes matched; operator-review
read back and inspected). Existing `evidence-cloudmersive-scanner` and its engineering lock were not touched.

## Migrations (staging)
1. `20261126_inspection_reconciliation_review.sql` (sha 59d5ab4b…): table RLS on, 0 policies, append-only row
   trigger; both RPCs service_role-only, SECURITY INVOKER, `search_path=''`; consent hash pinned in SQL.
2. `20261127_ledger_truncate_hardening.sql` — **new finding fixed during acceptance**: Supabase default privileges
   gave `service_role` UPDATE/DELETE/TRUNCATE on both audit ledgers, and row triggers do not stop TRUNCATE.
   Revoked; added BEFORE TRUNCATE statement triggers.

## Results
| # | Check | Result |
|---|---|---|
| A1–A4 | Unmarked caller → processor/review 403 `staging_operator_required`; unmarked anon grant 403; member → processor/review 403 | PASS |
| S1 | Clean fictional PDF → `awaiting_human_review`, SHA re-verified, quarantined, approved/released=false (Cloudmersive key present) | PASS |
| S2 | Two parallel `process` calls → one 200, one 409 `claimed_by_another_worker` | PASS |
| S3 | Re-process finished job → 409 `terminal_or_unknown_state`; unknown job → 404 | PASS |
| S4 | Owner with revoked consent → `consent_withdrawn` (no vendor call) | PASS |
| S5 | Fault-injected `content_hash` → `integrity_mismatch`, real hash reported (no vendor call) | PASS |
| S6 | Fresh claim → 409; claim aged 10 min → taken over, attempt 2, clean | PASS |
| S7 | attempts=3 → 409 `retry_budget_exhausted` | PASS |
| R1–R2 | Reconcile `962ba2b3` and `439282a5`: object present, re-hash matches, job recreated, `job_recreated` logged | PASS |
| R3–R6 | Repeat reconcile → 409 refused + logged; healthy artifact refused; non-v0 403; short reason 400 | PASS |
| D1 | Re-upload of bytes already scanned clean → 200 duplicate, same artifact, no new record | PASS |
| V1 | Queue: 3 eligible items, all hash-verified, metadata only (no paths/URLs); non-v0 awaiting item excluded | PASS |
| V2–V5 | Decision before start 409; wrong reason code 422; missing rationale 422; injected operator_id 422 | PASS |
| V6–V9 | start → accept 201; any later decision 409 `decision_already_final`; history shows both events | PASS |
| V10–V15 | Self-review decide/history 403; unknown history 404; non-v0 history/decide 403; unclean scan 409 | PASS |
| V17–V19 | start → needs_more_information → rejected 201 | PASS |
| C0–C4 | Member revokes: review 409 `owner_review_consent_missing`, processing `consent_withdrawn`, upload 403, status revoked | PASS |
| SQL1 | RPC called directly with another user's consent → `owner_review_consent_missing` | PASS |
| SQL2 | RPC called directly with the member's revoked consent → `owner_review_consent_missing` | PASS |
| L1–L12 | UPDATE/DELETE/TRUNCATE on both ledgers as service_role (permission denied) and as table owner (triggers) — with rows present | PASS |
| G1–G3 | After owner removed secrets: upload/processor/review → 503 for a marked operator with a valid session | PASS |

Cloudmersive calls: 3 (existing subscription). Ledgers after testing: 5 review events, 4 reconciliation events.

## Test data and fault injections (all synthetic)
- Operator O `649e5e7c-ec92-452f-a206-b7e097f9646b` (`yp_synthetic_test`, `yp_staging_operator`); member M
  `b845c914-17df-4b0a-9909-d11c828a2517` (`yp_synthetic_test`). Fictional employment records. Both consents revoked.
- `c71673fb…` content_hash set to zeros, then restored to `a71c5557…`; flagged in metadata.
- Job `c12a753b…` set to `scan_in_progress` (fresh, then aged 10 min). Job `89cf02bf…` attempts set to 3.
- Nothing deleted.

## Still open
- Independent security review of this branch and the hardening migration; legal/privacy review of consent v2.
- Byte-level read-back comparison for three of the four deployed functions (operator-review was read back).
- Same TRUNCATE exposure may exist on other append-only tables elsewhere; production not inspected for it here.
- Real-volunteer pilot remains unauthorized; production evidence uploads remain disabled.
