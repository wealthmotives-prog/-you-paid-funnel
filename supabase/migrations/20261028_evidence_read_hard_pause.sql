-- Work-evidence quarantine safety freeze: restrict direct member reads.
-- Applies to authenticated role and composes with permissive SELECT policies.
-- A service-role backend bypasses RLS and must enforce independent access checks.
CREATE POLICY yp_evidence_read_hard_pause
ON storage.objects
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (bucket_id <> 'you-paid-work-evidence');
