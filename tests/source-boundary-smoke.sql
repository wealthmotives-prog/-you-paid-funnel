-- You Paid read-only prelaunch smoke checks.
-- Run in Supabase SQL editor against the intended environment.
-- This suite intentionally does not mutate test members, source observations,
-- checkout sessions, payment records, or any provider state.

-- 1: Server-owned identity and source tables must enable RLS and deny
-- ordinary anonymous/authenticated direct SELECT.
select c.relname as table_name,
       c.relrowsecurity as rls_on,
       not has_table_privilege('anon', c.oid, 'SELECT') as anonymous_read_denied,
       not has_table_privilege('authenticated', c.oid, 'SELECT') as member_read_denied,
       has_table_privilege('service_role', c.oid, 'SELECT') as service_can_read
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('identity_verification_sessions',
                    'source_connection_sessions',
                    'source_observation_receipts')
order by c.relname;

-- 2: Provenance and ownership triggers must be present and enabled.
select c.relname as table_name,t.tgname as trigger_name,
       t.tgenabled = 'O' as enabled
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
where c.oid in ('public.source_connection_sessions'::regclass,
                'public.source_observation_receipts'::regclass)
  and not t.tgisinternal
  and t.tgname in ('yp_source_connection_integrity',
                   'yp_source_receipt_link_guard',
                   'yp_source_receipt_immutability_guard')
order by c.relname,t.tgname;

-- 3: Stripe internal payment jobs must not be duplicated.
select jobname,count(*) as jobs,count(*) filter (where active) as active_jobs
from cron.job
where jobname in ('you-paid-integrity-quarter-hour',
                  'you-paid-payment-integrity-hourly')
group by jobname order by jobname;

-- 4: Most recent internal payment integrity snapshot; compare its captured
-- timestamp and details before treating it as a current health result.
select * from public.payment_integrity_runs order by id desc limit 1;

-- 5: Bucket remains private; unauthenticated clients must never fetch raw work evidence.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='you-paid-work-evidence';

-- These checks are configuration assertions, NOT end-to-end role simulations,
-- webhook security tests, or integration validations.
