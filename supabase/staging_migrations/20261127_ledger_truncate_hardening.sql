-- STAGING ONLY, for Supabase project rzeodkcvljukaaczeibe. Additive hardening. Never apply to production.
-- Finding (2026-11-27 acceptance): Supabase default privileges grant service_role UPDATE/DELETE/TRUNCATE on new
-- tables. Row-level append-only triggers block UPDATE/DELETE but NOT TRUNCATE, so both audit ledgers could be
-- emptied by the service role. This migration:
--   1) limits service_role on the two ledgers to SELECT + INSERT;
--   2) adds BEFORE TRUNCATE statement triggers, which also stop the table owner.
-- Nothing is deleted or rewritten.

revoke update, delete, truncate, references, trigger on public.pilot_evidence_review_events from service_role;
revoke update, delete, truncate, references, trigger on public.evidence_reconciliation_events from service_role;
revoke all on public.pilot_evidence_review_events from public, anon, authenticated;
revoke all on public.evidence_reconciliation_events from public, anon, authenticated;

create or replace function public.yp_staging_prevent_ledger_truncate()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Staging audit ledgers cannot be truncated (%)', tg_table_name;
end $$;
revoke all on function public.yp_staging_prevent_ledger_truncate() from public, anon, authenticated;

drop trigger if exists yp_staging_review_no_truncate on public.pilot_evidence_review_events;
create trigger yp_staging_review_no_truncate
  before truncate on public.pilot_evidence_review_events
  for each statement execute function public.yp_staging_prevent_ledger_truncate();

drop trigger if exists yp_staging_reconciliation_no_truncate on public.evidence_reconciliation_events;
create trigger yp_staging_reconciliation_no_truncate
  before truncate on public.evidence_reconciliation_events
  for each statement execute function public.yp_staging_prevent_ledger_truncate();

-- Rollback (restores the previous, weaker state; only with owner approval):
--   drop trigger if exists yp_staging_review_no_truncate on public.pilot_evidence_review_events;
--   drop trigger if exists yp_staging_reconciliation_no_truncate on public.evidence_reconciliation_events;
--   grant update, delete, truncate on public.pilot_evidence_review_events, public.evidence_reconciliation_events to service_role;
