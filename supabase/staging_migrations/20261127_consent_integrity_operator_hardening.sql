-- STAGING ONLY, for Supabase project rzeodkcvljukaaczeibe. Additive hardening. Never apply to production.
-- Post-acceptance findings (2026-11-27 audit):
--   H1 pilot_evidence_consents was fully mutable by service_role: a revoked consent could be silently un-revoked,
--      re-scoped, extended or deleted. Now: the only permitted change is recording a revocation (NULL -> timestamp);
--      no DELETE/TRUNCATE for service_role; TRUNCATE blocked for every role.
--   H2 Evidence integrity anchors (artifact owner/record/hash/path, job artifact/bucket/path) were mutable by
--      service_role, and attempts could be reset. Now immutable for non-owner roles; attempts never decrease;
--      no DELETE/TRUNCATE for service_role on artifacts or jobs. (The cleanup runbook runs as the table owner.)
--   H3 Both RPCs trusted the caller-supplied operator/actor id. They now verify server-set markers in auth.users
--      through a narrow SECURITY DEFINER helper executable only by service_role.
-- Nothing is deleted or rewritten. Existing rows are unaffected.

-- H3 helper -------------------------------------------------------------------------------------------------
create or replace function public.yp_staging_user_has_markers(p_user uuid, p_operator boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user
      and coalesce((u.raw_app_meta_data->>'yp_synthetic_test')::boolean, false)
      and (not p_operator or coalesce((u.raw_app_meta_data->>'yp_staging_operator')::boolean, false)));
$$;
revoke all on function public.yp_staging_user_has_markers(uuid, boolean) from public, anon, authenticated;
grant execute on function public.yp_staging_user_has_markers(uuid, boolean) to service_role;

-- H1 consent ledger ------------------------------------------------------------------------------------------
create or replace function public.yp_staging_consent_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Staging consent records cannot be deleted'; end if;
  -- UPDATE: only a revocation may be recorded, exactly once, and nothing else may change.
  if old.revoked_at is not null then raise exception 'Staging consent already revoked; record is final'; end if;
  if new.revoked_at is null then raise exception 'Staging consent update must record a revocation'; end if;
  if (to_jsonb(new) - 'revoked_at') is distinct from (to_jsonb(old) - 'revoked_at') then
    raise exception 'Staging consent terms are immutable; only revoked_at may be set'; end if;
  return new;
end $$;
revoke all on function public.yp_staging_consent_guard() from public, anon, authenticated;
create or replace trigger yp_staging_consent_guard
  before update or delete on public.pilot_evidence_consents
  for each row execute function public.yp_staging_consent_guard();
create or replace trigger yp_staging_consent_no_truncate
  before truncate on public.pilot_evidence_consents
  for each statement execute function public.yp_staging_prevent_ledger_truncate();
revoke delete, truncate, references, trigger on public.pilot_evidence_consents from service_role;
revoke all on public.pilot_evidence_consents from public, anon, authenticated;

-- H2 evidence integrity anchors -------------------------------------------------------------------------------
create or replace function public.yp_staging_artifact_anchor_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'postgres' then return new; end if;  -- table owner (SQL editor / documented fault injection)
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
     or new.employment_id is distinct from old.employment_id or new.content_hash is distinct from old.content_hash
     or new.storage_reference is distinct from old.storage_reference or new.received_at is distinct from old.received_at
     or new.artifact_type is distinct from old.artifact_type then
    raise exception 'Staging evidence integrity anchors are immutable';
  end if;
  return new;
end $$;
revoke all on function public.yp_staging_artifact_anchor_guard() from public, anon, authenticated;
create or replace trigger yp_staging_artifact_anchor_guard
  before update on public.evidence_artifacts
  for each row execute function public.yp_staging_artifact_anchor_guard();

create or replace function public.yp_staging_job_anchor_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'postgres' then return new; end if;
  if new.id is distinct from old.id or new.artifact_id is distinct from old.artifact_id
     or new.bucket_id is distinct from old.bucket_id or new.object_path is distinct from old.object_path then
    raise exception 'Staging inspection job linkage is immutable';
  end if;
  if new.attempts < old.attempts then raise exception 'Staging inspection attempts cannot decrease'; end if;
  return new;
end $$;
revoke all on function public.yp_staging_job_anchor_guard() from public, anon, authenticated;
create or replace trigger yp_staging_job_anchor_guard
  before update on public.evidence_inspection_jobs
  for each row execute function public.yp_staging_job_anchor_guard();
revoke delete, truncate, references, trigger on public.evidence_artifacts from service_role;
revoke delete, truncate, references, trigger on public.evidence_inspection_jobs from service_role;

-- H3 RPCs (bodies identical to 20261126 except the marked defense-in-depth checks) ---------------------------
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
  -- Defense in depth: the actor must be a server-marked staging operator (does not trust the caller).
  if not public.yp_staging_user_has_markers(p_actor_id, true) then raise exception 'operator_not_authorized'; end if;
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
create or replace function public.yp_staging_record_review_decision(
  p_artifact_id uuid, p_operator_id uuid, p_event_type text, p_reason_code text, p_rationale text, p_consent_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  a public.evidence_artifacts%rowtype;
  j public.evidence_inspection_jobs%rowtype;
  c public.pilot_evidence_consents%rowtype;
  v_last text;
  v_event uuid;
  v_status text;
begin
  select * into a from public.evidence_artifacts where id = p_artifact_id for update;
  if not found then raise exception 'artifact_not_found'; end if;
  -- Defense in depth: operator and evidence owner verified against auth.users server markers.
  if not public.yp_staging_user_has_markers(p_operator_id, true) then raise exception 'operator_not_authorized'; end if;
  if not public.yp_staging_user_has_markers(a.user_id, false) then raise exception 'not_eligible_synthetic_evidence'; end if;
  if a.user_id = p_operator_id then raise exception 'self_review_forbidden'; end if;
  if a.metadata->>'intake' is distinct from 'staging-evidence-upload-v0' or (a.metadata->>'synthetic') is distinct from 'true' then
    raise exception 'not_eligible_synthetic_evidence'; end if;
  select * into j from public.evidence_inspection_jobs where artifact_id = a.id;
  if not found then raise exception 'inspection_job_missing'; end if;
  if j.state <> 'quarantined' or j.failure_code is distinct from 'awaiting_human_review'
     or j.actual_sha256 is distinct from a.content_hash then
    raise exception 'scan_not_clean_or_hash_unverified'; end if;
  -- Independent consent verification (does not trust the Edge Function's evaluation).
  -- These constants MUST equal CONSENT_PURPOSE / CURRENT_CONSENT_VERSION / CONSENT_DOCUMENTS[...].sha256 in
  -- supabase/functions/_shared/pilot_consent_policy.ts (cross-checked by tests/test_staging_inspection_review_services.py).
  select * into c from public.pilot_evidence_consents where id = p_consent_id for share;
  if not found
     or c.user_id <> a.user_id
     or c.purpose is distinct from 'pilot_work_evidence_review'
     or c.consent_version is distinct from 'staging-pilot-evidence-consent-v2'
     or c.consent_text_sha256 is distinct from '61009cfa547da4fd893e8df9095440727250546c980e3dabeb3f5c404ddc0e51'
     or c.granted_at is null or c.granted_at > now()
     or c.revoked_at is not null
     or c.expires_at is null or c.expires_at <= now()
     or not ('operator_review' = any(c.scope)) then
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
revoke all on function public.yp_staging_reconcile_artifact(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.yp_staging_reconcile_artifact(uuid, uuid, text, text) to service_role;
revoke all on function public.yp_staging_record_review_decision(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.yp_staging_record_review_decision(uuid, uuid, text, text, text, uuid) to service_role;

-- Rollback (owner approval; restores weaker state): re-run the two function definitions from
-- 20261126_inspection_reconciliation_review.sql; drop triggers yp_staging_consent_guard, yp_staging_consent_no_truncate,
-- yp_staging_artifact_anchor_guard, yp_staging_job_anchor_guard; re-grant the revoked privileges to service_role.
