-- STAGING ONLY, applied to Supabase project rzeodkcvljukaaczeibe.
-- Evidence intake remains disabled; backend-only authorization.
create table if not exists public.pilot_evidence_consents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 purpose text not null check (purpose='pilot_work_evidence_review'),
 consent_version text not null check (length(btrim(consent_version)) between 1 and 80),
 scope text[] not null check (cardinality(scope)>0),
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 expires_at timestamptz,
 consent_source text not null default 'staging_member_portal',
 check (revoked_at is null or revoked_at>=granted_at),
 check (expires_at is null or expires_at>granted_at)
);
create index if not exists pilot_evidence_consents_user_active_idx
 on public.pilot_evidence_consents(user_id,granted_at desc)
 where revoked_at is null;
alter table public.pilot_evidence_consents enable row level security;
revoke all on public.pilot_evidence_consents from public, anon, authenticated;
grant select,insert,update on public.pilot_evidence_consents to service_role;

create table if not exists public.pilot_evidence_review_events (
 id uuid primary key default gen_random_uuid(),
 artifact_id uuid not null references public.evidence_artifacts(id) on delete restrict,
 operator_id uuid not null references auth.users(id) on delete restrict,
 event_type text not null check (event_type in ('review_started','needs_more_information','rejected','accepted_for_pilot_review')),
 reason_code text not null check (length(btrim(reason_code)) between 3 and 100),
 rationale text,
 recorded_at timestamptz not null default now(),
 associated_consent_id uuid references public.pilot_evidence_consents(id) on delete restrict,
 metadata jsonb not null default '{}'::jsonb
);
create index if not exists pilot_evidence_review_events_artifact_time_idx
 on public.pilot_evidence_review_events(artifact_id,recorded_at desc);
alter table public.pilot_evidence_review_events enable row level security;
revoke all on public.pilot_evidence_review_events from public, anon, authenticated;
grant select,insert on public.pilot_evidence_review_events to service_role;

create or replace function public.yp_staging_prevent_review_event_change()
returns trigger language plpgsql set search_path = '' as $$
begin
 raise exception 'Staging evidence review events are append-only';
end;
$$;
revoke all on function public.yp_staging_prevent_review_event_change() from public, anon, authenticated;
drop trigger if exists yp_staging_review_append_only on public.pilot_evidence_review_events;
create trigger yp_staging_review_append_only
 before update or delete on public.pilot_evidence_review_events
 for each row execute function public.yp_staging_prevent_review_event_change();
