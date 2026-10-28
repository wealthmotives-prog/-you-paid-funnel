# You Paid — Live Evidence Storage Authorization Checkpoint
Date: October 28, 2026

## Verified prior posture
Supabase private bucket `you-paid-work-evidence`: `public=false`; 10 MiB maximum; PDF, PNG, JPEG only.
Existing storage.objects policies: `yp_evidence_owner_insert` allowed INSERT into a folder matching auth.uid(); `yp_evidence_owner_read` allowed SELECT for the authenticated owner's folder. Upload buttons being disabled in the browser **did not** prevent a directly authenticated storage API upload.

## Corrective action applied and checked
Applied migration `evidence_upload_hard_pause_20261028` in Supabase project `xknfxcyezchtypaisieu`.
Committed migration source at `supabase/migrations/20261028_evidence_upload_hard_pause.sql`.
Confirmed live `pg_policies` row: `yp_evidence_upload_hard_pause`, `RESTRICTIVE`, `INSERT`, `{authenticated}`, `WITH CHECK (bucket_id <> 'you-paid-work-evidence')`.

Because PostgreSQL restrictive policies combine with any permissive INSERT policies, this prevents direct inserts into this bucket **by the authenticated role**, regardless of the previously permissive owner-folder policy. Other buckets are unaffected by this check. **A service-role backend may still bypass RLS**, so its intake and authorization remain disabled pending independent testing. Existing owner SELECT behavior was not changed. No claim that all possible server write paths are blocked.

## Outstanding security work before live volunteer upload
- Verify with actual authenticated test accounts: member A cannot create new storage object; member B cannot access member A object; anonymous cannot upload/read; service role only within trusted code.
- Complete independent malware scanner, quarantine-to-approved state machine and content validation beyond magic bytes.
- Harden service-side consent, job ownership, identity mapping, path safety, file quotas, idempotence, expiration and revocation.
- Use short-lived signed requests only after strict permissions; no public objects or browser-accessible service key.
- Finish secure deletion/retention, privacy notices, abuse logging, incident response, human reviewer access and audit trail.
- Confirm release sign-off; add narrowly scoped replacement policy only when entire intake pipeline passes. Do not simply remove the restrictive policy to open unguarded direct uploads.
- Pilot participant should provide NO banking credentials, paystubs, SSNs or employer contacts before explicit invitation to tested secure intake.

## Evidence and limits
- Live SQL inspection established bucket configuration and policy row; policy-presence check succeeded.
- We **did not execute a real authenticated upload request or production end-to-end intake test**.
- This security freeze does not itself authorize processing personal documents or establish any furnished consumer credit relationship.
