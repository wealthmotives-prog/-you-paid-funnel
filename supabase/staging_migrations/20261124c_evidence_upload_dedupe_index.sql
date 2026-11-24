-- STAGING ONLY, for Supabase project rzeodkcvljukaaczeibe. Additive and reversible.
-- Concurrency-safe duplicate guard for the server-mediated upload service.
-- Partial: covers only rows created by staging-evidence-upload-v0, so pre-existing synthetic rows
-- (which include intentional duplicates from earlier scanner tests) are preserved untouched.
create unique index if not exists evidence_artifacts_upload_v0_dedupe_idx
  on public.evidence_artifacts (user_id, employment_id, content_hash)
  where (metadata->>'intake') = 'staging-evidence-upload-v0';

-- Rollback:
--   drop index if exists public.evidence_artifacts_upload_v0_dedupe_idx;
