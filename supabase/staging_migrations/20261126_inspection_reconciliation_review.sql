-- STAGING ONLY, for Supabase project rzeodkcvljukaaczeibe. Additive. Never apply to production.
-- 1) Append-only reconciliation audit log.
-- 2) yp_staging_reconcile_artifact(): atomic, audited repair of a reconciliation_required intake.
-- 3) yp_staging_record_review_decision(): atomic, append-only operator decision with server-side checks.
-- All objects: no access for anon/authenticated; service_role only. SECURITY INVOKER (callers are service_role).

create table if not exists public.evidence_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.evidence_artifacts(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('job_recreated', 'reconcile_refused')),
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  verified_sha256 text check (verified_sha256 is null or verified_sha256 ~ '^[a-f0-9]{64}$'),
  before_state jsonb not null,
  after_state jsonb not null,
  recorded_at timestamptz not null default now()
);
alter table public.evidence_reconciliation_events enable row level security;
revoke all on public.evidence_reconciliation_events from public, anon, authenticated;
grant select, insert on public.evidence_reconciliation_events to service_role;

create or replace function public.yp_staging_prevent_reconciliation_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Staging reconciliation events are append-only';
end $$;
revoke all on function public.yp_staging_prevent_reconciliation_change() from public, anon, authenticated;
drop trigger if exists yp_staging_reconciliation_append_only on public.evidence_reconciliation_events;
create trigger yp_staging_reconciliation_append_only
  before update or delete on public.evidence_reconciliation_events
  for each row execute function public.yp_staging_prevent_reconciliation_change();

-- Repair: recreate the missing inspection job after the caller independently re-hashed the stored object.
create or replace function public.yp_staging_reconcile_artifact(
  p_artifact_id uuid, p_actor_id uuid, p_reason text, p_verified_sha256 text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  a public.evidence_artifacts%rowtype;
  v_path text;
  v_job uuid;
  v_before jsonb;
begin
  select * into a from public.evidence_artifacts where id = p_artifact_id for update;
  if not found then raise exception 'artifact_not_found'; end if;
  v_before := jsonb_build_object('review_status', a.review_status,
    'job_exists', exists(select 1 from public.evidence_inspection_jobs j where j.artifact_id = a.id),
    'review_events', (select count(*) from public.pilot_evidence_review_events e where e.artifact_id = a.id));
  if a.metadata->>'intake' is distinct from 'staging-evidence-upload-v0' or (a.metadata->>'synthetic') is distinct from 'true'
     or a.review_status <> 'reconciliation_required'
     or exists(select 1 from public.evidence_inspection_jobs j where j.artifact_id = a.id)
     or exists(select 1 from public.pilot_evidence_review_events e where e.artifact_id = a.id)
     or p_verified_sha256 is distinct from a.content_hash
     or a.storage_reference not like 'you-paid-work-evidence/%' then
    insert into public.evidence_reconciliation_events(artifact_id, actor_id, action, reason, verified_sha256, before_state, after_state)
    values (a.id, p_actor_id, 'reconcile_refused', p_reason, p_verified_sha256, v_before, v_before);
    return jsonb_build_object('reconciled', false, 'refused', true, 'before', v_before);
  end if;
  v_path := substr(a.storage_reference, length('you-paid-work-evidence/') + 1);
  insert into public.evidence_inspection_jobs(artifact_id, bucket_id, object_path, state)
    values (a.id, 'you-paid-work-evidence', v_path, 'queued') returning id into v_job;
  update public.evidence_artifacts set review_status = 'received' where id = a.id;
  insert into public.evidence_reconciliation_events(artifact_id, actor_id, action, reason, verified_sha256, before_state, after_state)
  values (a.id, p_actor_id, 'job_recreated', p_reason, p_verified_sha256, v_before,
          jsonb_build_object('review_status', 'received', 'job_id', v_job, 'job_state', 'queued'));
  return jsonb_build_object('reconciled', true, 'job_id', v_job, 'before', v_before);
end $$;
revoke all on function public.yp_staging_reconcile_artifact(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.yp_staging_reconcile_artifact(uuid, uuid, text, text) to service_role;

-- Operator decision: all eligibility rules enforced in one transaction under a row lock.
create or replace function public.yp_staging_record_review_decision(
  p_artifact_id uuid, p_operator_id uuid, p_event_type text, p_reason_code text, p_rationale text, p_consent_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  a public.evidence_artifacts%rowtype;
  j public.evidence_inspection_jobs%rowtype;
  v_last text;
  v_event uuid;
  v_status text;
begin
  select * into a from public.evidence_artifacts where id = p_artifact_id for update;
  if not found then raise exception 'artifact_not_found'; end if;
  if a.user_id = p_operator_id then raise exception 'self_review_forbidden'; end if;
  if a.metadata->>'intake' is distinct from 'staging-evidence-upload-v0' or (a.metadata->>'synthetic') is distinct from 'true' then
    raise exception 'not_eligible_synthetic_evidence'; end if;
  select * into j from public.evidence_inspection_jobs where artifact_id = a.id;
  if not found then raise exception 'inspection_job_missing'; end if;
  if j.state <> 'quarantined' or j.failure_code is distinct from 'awaiting_human_review'
     or j.actual_sha256 is distinct from a.content_hash then
    raise exception 'scan_not_clean_or_hash_unverified'; end if;
  if not exists (select 1 from public.pilot_evidence_consents c where c.id = p_consent_id and c.user_id = a.user_id
                 and c.revoked_at is null and c.expires_at > now() and 'operator_review' = any(c.scope)) then
    raise exception 'owner_review_consent_missing'; end if;
  select e.event_type into v_last from public.pilot_evidence_review_events e
    where e.artifact_id = a.id order by e.recorded_at desc, e.id desc limit 1;
  if v_last in ('rejected', 'accepted_for_pilot_review') then raise exception 'decision_already_final'; end if;
  if p_event_type <> 'review_started' and v_last is null then raise exception 'review_not_started'; end if;
  insert into public.pilot_evidence_review_events(artifact_id, operator_id, event_type, reason_code, rationale, associated_consent_id, metadata)
    values (a.id, p_operator_id, p_event_type, p_reason_code, p_rationale, p_consent_id,
            jsonb_build_object('job_id', j.id, 'verified_sha256', j.actual_sha256, 'service', 'staging-operator-review-v0'))
    returning id into v_event;
  v_status := case p_event_type when 'review_started' then 'under_review'
                                when 'needs_more_information' then 'needs_more_information'
                                when 'rejected' then 'rejected'
                                else 'accepted_for_pilot_review' end;
  update public.evidence_artifacts set review_status = v_status where id = a.id;
  return jsonb_build_object('event_id', v_event, 'review_status', v_status);
end $$;
revoke all on function public.yp_staging_record_review_decision(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.yp_staging_record_review_decision(uuid, uuid, text, text, text, uuid) to service_role;

-- Rollback (only if no rows must be kept):
--   drop function if exists public.yp_staging_record_review_decision(uuid, uuid, text, text, text, uuid);
--   drop function if exists public.yp_staging_reconcile_artifact(uuid, uuid, text, text);
--   (keep public.evidence_reconciliation_events: it is audit history)
