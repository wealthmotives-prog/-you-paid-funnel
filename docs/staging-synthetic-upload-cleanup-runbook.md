# Runbook: cleanup and rollback of staging synthetic uploads

**Scope:** Supabase project `rzeodkcvljukaaczeibe` (you-paid-staging) **only**. Never run any step against production `xknfxcyezchtypaisieu`.
**Targets:** only rows created by `staging-evidence-upload-v0` for accounts carrying the server-set `yp_synthetic_test` marker. Pre-existing synthetic rows from earlier scanner tests are out of scope and must not be touched.
**Approval:** steps 1–2 are safe and reversible. Steps 4–6 permanently delete synthetic test data and need the owner's go-ahead each time.

## 1. Stop new uploads (immediate, reversible)
In the Supabase dashboard for `you-paid-staging`, go to Edge Functions → Secrets and remove `YOU_PAID_STAGING_UPLOAD_ENABLED` or set it to anything other than `true`. The function then returns `503 staging_upload_not_enabled` before reading any request.

## 2. Inventory (read-only dry run)
```sql
-- STAGING ONLY. Lists every candidate; deletes nothing.
select a.id as artifact_id, a.user_id, a.storage_reference, a.content_hash, a.review_status,
       j.id as job_id, j.state, j.failure_code, j.scanner_name,
       (select count(*) from public.pilot_evidence_review_events e where e.artifact_id = a.id) as review_events,
       (u.raw_app_meta_data->>'yp_synthetic_test') = 'true' as marked_test_account
from public.evidence_artifacts a
join auth.users u on u.id = a.user_id
left join public.evidence_inspection_jobs j on j.artifact_id = a.id
where a.metadata->>'intake' = 'staging-evidence-upload-v0'
order by a.received_at;
```
Stop and investigate if any row has `marked_test_account = false`. The service should never have produced one.

## 3. Audit-record guard
`pilot_evidence_review_events` is append-only (trigger `yp_staging_review_append_only`), and its FK to artifacts is `ON DELETE RESTRICT`.
**If `review_events > 0` for an artifact, do not delete that artifact or its job.** Keep it for the audit trail; you may remove only its Storage object (step 4). Everything else in steps 4–5 applies only to artifacts with `review_events = 0`.

## 4. Delete the quarantined objects (Storage API, not SQL)
Delete objects through the Storage API or dashboard, never with `delete from storage.objects`, which would leave the underlying files orphaned. Use the exact paths from step 2: `storage_reference` minus the `you-paid-work-evidence/` prefix.
- Dashboard: Storage → `you-paid-work-evidence` → select the listed `<user_id>/<artifact_id>.pdf` files → Delete.
- Or a one-off service-role script run against the **staging** URL: `supabase.storage.from('you-paid-work-evidence').remove([...paths])`.

Verify:
```sql
select count(*) from storage.objects o
where o.bucket_id = 'you-paid-work-evidence'
  and ('you-paid-work-evidence/' || o.name) in (
    select storage_reference from public.evidence_artifacts where metadata->>'intake' = 'staging-evidence-upload-v0');
-- expect 0
```

## 5. Delete the job and artifact rows (guarded transaction)
```sql
-- STAGING ONLY. Deletes only v0-intake rows for marked test accounts with no review events.
begin;
create temp table yp_cleanup on commit drop as
select a.id from public.evidence_artifacts a
join auth.users u on u.id = a.user_id
where a.metadata->>'intake' = 'staging-evidence-upload-v0'
  and (u.raw_app_meta_data->>'yp_synthetic_test') = 'true'
  and not exists (select 1 from public.pilot_evidence_review_events e where e.artifact_id = a.id);
select count(*) as to_delete from yp_cleanup;          -- check this number against step 2
delete from public.evidence_inspection_jobs where artifact_id in (select id from yp_cleanup);
delete from public.evidence_artifacts       where id          in (select id from yp_cleanup);
commit;   -- or ROLLBACK if the count is not what you expected
```

## 6. Close out test identities (optional)
- Revoke any remaining consents. Rows are retained.
  ```sql
  update public.pilot_evidence_consents c set revoked_at = now()
  from auth.users u where u.id = c.user_id and c.revoked_at is null
    and (u.raw_app_meta_data->>'yp_synthetic_test') = 'true';
  ```
- Remove the marker so the accounts can do nothing: `update auth.users set raw_app_meta_data = raw_app_meta_data - 'yp_synthetic_test' where (raw_app_meta_data->>'yp_synthetic_test') = 'true';`
- Turn off anonymous sign-ins (Authentication → Sign In / Providers) once synthetic testing is over.

## 7. Code and schema rollback
- Functions: delete `staging-evidence-upload` (dashboard, or `supabase functions delete staging-evidence-upload --project-ref rzeodkcvljukaaczeibe`). For consent, redeploy an earlier commit's source or unset `YOU_PAID_STAGING_CONSENT_ENABLED` (it fails closed with 503).
- Indexes and columns (after step 5): `drop index if exists public.evidence_artifacts_upload_v0_dedupe_idx;` and optionally `alter table public.pilot_evidence_consents drop column if exists consent_text_sha256;`.
- Synthetic employment rows labelled `FICTIONAL …` may stay. They reference only test accounts.

## What a failed upload can leave behind
| Failure point | Left behind | Accessible? | Cleanup |
|---|---|---|---|
| Before storage write (auth, consent, ownership, validation) | nothing | — | none |
| Storage write fails | nothing (`recorded:false`) | — | none |
| Artifact insert fails | object removed; if removal also failed, an orphan object with no DB reference | No: private bucket, RESTRICTIVE read pause, no signed URLs | step 4 by listing `storage.objects` under the user prefix with no matching artifact |
| Job insert fails | object + artifact with `review_status = reconciliation_required` | No | steps 4–5 (artifact matches the inventory) |
