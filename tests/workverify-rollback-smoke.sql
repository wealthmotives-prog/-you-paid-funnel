-- Synthetic reconciliation smoke test (execute in a non-production clone by preference).
-- Intentionally rollback-only. Requires a member profile for FK linkage.
BEGIN;
DO $$
DECLARE v_user uuid; v_employer uuid; v_period uuid; v_aggregate jsonb; v_split jsonb;
BEGIN
 SELECT user_id INTO v_user FROM public.member_profiles LIMIT 1;
 IF v_user IS NULL THEN RAISE EXCEPTION 'Fixture prerequisite: at least one member profile'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
 INSERT INTO public.employment_records(user_id,employer_name,employer_address,employment_start,employment_start_precision,employment_status)
 VALUES (v_user,'SYNTHETIC TEST ONLY','123 Fictional Test Street, Example, GA 30000','2026-09-01','month','active') RETURNING id INTO v_employer;
 INSERT INTO public.work_pay_period_declarations(user_id,employment_id,period_start,period_end,regular_hours)
 VALUES(v_user,v_employer,'2026-09-28','2026-10-11',80) RETURNING id INTO v_period;
 SELECT public.work_pay_period_reconciliation(v_period) INTO v_aggregate;
 IF v_aggregate->>'status'<>'aggregate_only_unallocated' THEN RAISE EXCEPTION 'Unallocated period must be unresolved'; END IF;
 INSERT INTO public.work_day_allocations(user_id,pay_period_id,work_date,regular_hours)
 SELECT v_user,v_period,d::date,8
 FROM generate_series('2026-09-28'::timestamp,'2026-10-09'::timestamp,interval '1 day') d
 WHERE extract(isodow FROM d)<=5;
 SELECT public.work_pay_period_monthly_breakdown(v_period) INTO v_split;
 IF v_split->>'monthly_split_status'<>'provisional_self_declared'
 OR jsonb_array_length(v_split->'monthly_breakdown')<>2 THEN RAISE EXCEPTION 'Expected provisional two-month split'; END IF;
 IF (v_split->>'credit_reportable')::boolean OR (v_split->>'verified_attendance')::boolean THEN
 RAISE EXCEPTION 'Self-reported data must not qualify for reporting'; END IF;
END $$;
ROLLBACK;
-- Follow up separately: count any retained SYNTHETIC TEST ONLY employment rows (must be zero).
