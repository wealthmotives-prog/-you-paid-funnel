-- Safety freeze: keep direct authenticated uploads to the work-evidence bucket disabled.
-- This restrictive policy prevents even permissive storage INSERT policies from allowing it.
-- Does not revoke service-role actions; trusted backend must independently enforce consent,
-- file validation and malware scanning before any real evidence intake.
CREATE POLICY yp_evidence_upload_hard_pause
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (bucket_id <> 'you-paid-work-evidence');
