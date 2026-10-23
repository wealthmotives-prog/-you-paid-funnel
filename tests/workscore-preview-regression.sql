-- You Paid WorkScore v0.1 regression checks (synthetic values only)
-- Run in an isolated staging/test database. No user records are modified.
begin;
do $$
declare a jsonb; b jsonb; c jsonb;
begin
  a := public.workscore_preview(176,160,0,false);
  if (a->>'hours_coverage_percent')::numeric <> 90.91 or a->>'status' <> 'self_reported_preview' then
    raise exception 'Case 1: 160/176 expected 90.91 self-reported';
  end if;
  b := public.workscore_preview(176,152,16,true);
  if (b->>'hours_coverage_percent')::numeric <> 95 or b->>'status' <> 'hours_ratio_only' then
    raise exception 'Case 2: 152/(176-16) expected 95 hours-only';
  end if;
  c := public.workscore_preview(0,0,0,false);
  if c->>'status' <> 'unverified' then raise exception 'Case 3: no schedule must be unverified'; end if;
  if coalesce((a->>'credit_reportable')::boolean,true)
    or coalesce((b->>'positive_recognition_eligible')::boolean,true)
    or coalesce((b->>'adverse_furnishing_allowed')::boolean,true) then
    raise exception 'Case 4: no furnishing/recognition from aggregate hours';
  end if;
end $$;
rollback;
