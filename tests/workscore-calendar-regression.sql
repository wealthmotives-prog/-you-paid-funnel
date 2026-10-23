-- Synthetic WorkScore calendar regression checks.
-- Read-only: does not alter member records.
DO $$
DECLARE oct jsonb; nov jsonb; feb jsonb;
BEGIN
  oct:=public.workscore_calendar_preview('2026-10-01'::date,40,array[1,2,3,4,5]);
  nov:=public.workscore_calendar_preview('2026-11-01'::date,40,array[1,2,3,4,5]);
  feb:=public.workscore_calendar_preview('2026-02-01'::date,40,array[1,2,3,4,5]);
  IF (oct->>'scheduled_day_count')::integer<>22 OR (oct->>'nominal_expected_hours')::numeric<>176 THEN
    RAISE EXCEPTION 'October 2026 expected 22 weekdays / 176 hours';
  END IF;
  IF (nov->>'scheduled_day_count')::integer<>21 OR (nov->>'nominal_expected_hours')::numeric<>168 THEN
    RAISE EXCEPTION 'November 2026 expected 21 weekdays / 168 hours';
  END IF;
  IF (feb->>'scheduled_day_count')::integer<>20 OR (feb->>'nominal_expected_hours')::numeric<>160 THEN
    RAISE EXCEPTION 'February 2026 expected 20 weekdays / 160 hours';
  END IF;
  IF (oct->>'verified_attendance')::boolean OR (oct->>'credit_reportable')::boolean THEN
    RAISE EXCEPTION 'Estimated schedule must not become verified attendance or credit reporting';
  END IF;
END $$;
