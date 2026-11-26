# Milestone: staging server-mediated evidence upload v0 — 2026-11-24

- **Agent/session:** Claude (Opus 5.5), session `session_013NTyFKsbEV3gm3ZftoLffv`
- **Branch:** `staging/evidence-upload-v0` (stacked on PR #1 `staging/pilot-consent-service-v0`)
- **Status:** COMMITTED · DEPLOYED to staging only (`staging-evidence-upload` v1, bundle `33ec4d63f3d8f06cd50fb7d2629b17e84d9d310b944d9a7748d050a01f193ea5`, verify_jwt=true) · fail-closed gate TESTED live · upload paths **pending** owner-set secret `YOU_PAID_STAGING_UPLOAD_ENABLED=true` · NOT release-approved.

## Objective
The upload link of the chain: authenticated member → versioned consent → **server-mediated quarantined PDF upload → artifact + inspection job**. Nothing is scanned, approved or released here.

## Request contract
`POST /functions/v1/staging-evidence-upload`. Headers: `Authorization: Bearer <member session>`, `Content-Type: application/pdf`, `X-Employment-Id: <uuid of the member's own employment record>`. The body is the raw PDF bytes (≤ 10 MiB).

## Order of checks (all fail closed)
1. Staging host and `YOU_PAID_STAGING_UPLOAD_ENABLED=true`, else 503
2. Member session (service key refused as bearer), else 401
3. Identity gate: verified account, or server-marked synthetic test account for synthetic scope only, else 403
4. Headers: PDF content-type (415), employment UUID (400), declared length ≤ 10 MiB (413)
5. Active v2 consent with `upload_synthetic_evidence` (403 with reason)
6. Employment record owned by the member, else 404. The composite FK also enforces this.
7. Streaming bounded read (413), then `%PDF-` magic, `%%EOF` trailer, minimum size, and rejection of active content (`/JavaScript /JS /Launch /EmbeddedFile /OpenAction /AA /RichMedia /XFA /SubmitForm /ImportData`) and hex-escaped names (422)
8. SHA-256, then **consent re-checked** right before any write (revocation during upload wins)
9. Idempotent retry: same bytes + member + employment record returns the existing intake (200, `duplicate:true`)
10. Server-generated artifact id. Path `<user_id>/<artifact_id>.pdf` (matches the scanner's path guard), `upsert:false`
11. Artifact row (`review_status=received`, metadata: intake version, consent id/version/text hash, size, synthetic flag). On failure the just-written orphan object is removed and the response is 500 `recorded:false`. A concurrent-duplicate race (partial unique index) returns 409.
12. Inspection job `state=queued`. On failure the artifact is flagged `review_status=reconciliation_required` (never deleted), and the response is 500 `inspection_job_failed`. **It never reports success on a partial write.**
13. 201 with `quarantined:true, scanned:false, approved:false`

## Files and migrations
- `supabase/functions/_shared/evidence_upload_policy.ts` (new, pure)
- `supabase/functions/staging-evidence-upload/index.ts` (new)
- `supabase/staging_migrations/20261124c_evidence_upload_dedupe_index.sql`: partial unique index, applied to staging only. Pre-existing synthetic rows are untouched.
- `tests/evidence_upload_policy.test.ts` (13), `tests/test_staging_evidence_upload_service.py` (8), CI wiring

## Synthetic fixtures created (staging)
Employment records `a417a026-949e-44d1-9fbe-5cd7daafcf8e` (member D, "FICTIONAL Example Logistics Co") and `e6e44eea-5a81-4bdf-9681-6da7aa3b0f92` (member E, "FICTIONAL Sample Staffing LLC").

## Tests so far
| ID | Expected | Observed | Result |
|---|---|---|---|
| Node upload policy suite | 13 pass | 13/13 | PASS |
| Full offline suite | no regression | 127 passed | PASS |
| UPL-00a no auth | 401 | 401 | PASS |
| UPL-00b marked member, gate unset | 503 | 503 staging_upload_not_enabled | PASS |
| Live upload matrix (UPL-01…) | — | pending gate secret | INCONCLUSIVE |

## Security notes and limits
- Service role bypasses RLS; every ownership, consent and identity check is done in code and covered by static tests. The Storage RESTRICTIVE hard pauses remain, so members still cannot write to the bucket directly.
- The PDF marker scan is a cheap pre-filter, **not** antivirus. The Cloudmersive scan remains a separate, locked step.
- `/AA` and similar names inside compressed object streams are not visible to the marker scan; the antivirus step and human review remain required.

## Rollback
Delete the `staging-evidence-upload` function, or leave `YOU_PAID_STAGING_UPLOAD_ENABLED` unset (503). `drop index if exists public.evidence_artifacts_upload_v0_dedupe_idx;`. Synthetic employment rows can stay; they are labelled FICTIONAL.

## Next
Live upload matrix once the gate is set, then wire preflight → scanner job processing for these artifacts on staging (scanner engineering lock stays in production), then the operator review service.
